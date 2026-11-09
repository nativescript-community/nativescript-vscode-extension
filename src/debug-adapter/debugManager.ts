import * as vscode from 'vscode';
import { ILogger } from '../common/logger';
import { BuildSession } from '../services/buildService';
import { services } from '../services/extensionHostServices';
import { computeSourceMapOptions, SourceMapOptions } from './sourceMaps';

export type SessionTerminatedCallback = () => void;

/** The launch.json attributes declared in package.json (contributes.debuggers[0].configurationAttributes). */
export interface NativeScriptDebugConfiguration extends vscode.DebugConfiguration {
  platform: string;
  appRoot?: string;
  webRoot?: string;
  watch?: boolean;
  stopOnEntry?: boolean;
  launchTests?: boolean;
  tnsArgs?: string[];
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  cwd?: string;
  env?: Record<string, string | null>;
  address?: string;
  sourceMaps?: boolean;
  sourceMapPathOverrides?: Record<string, string>;
  resolveSourceMapLocations?: string[] | null;
  skipFiles?: string[];
  smartStep?: boolean;
  trace?: boolean | Record<string, unknown>;
  diagnosticLogging?: boolean;
}

/** Stamped on child configs so onDidStartDebugSession can tell which parent a js-debug session belongs to. */
export const PARENT_SESSION_KEY = '__nativescriptParentSessionId';

/** How long to wait for the app to come back with a new debug port after its socket drops in watch mode. */
export const RECONNECT_TIMEOUT_MS = 60_000;

const CHILD_START_ATTEMPTS = 3;
const CHILD_RETRY_DELAY_MS = 1000;
const CHILD_STOP_SETTLE_MS = 500;

interface ActiveSession {
  parentSession: vscode.DebugSession;
  config: NativeScriptDebugConfiguration;
  appRoot: string;
  folder: vscode.WorkspaceFolder | undefined;
  onTerminated: SessionTerminatedCallback;
  buildSession: BuildSession | null;
  sourceMapOptions: Promise<SourceMapOptions> | null;
  childSession: vscode.DebugSession | null;
  /** Child sessions we stopped on purpose; their termination must not end the parent. */
  replacedChildIds: Set<string>;
  /** Serializes child (re)starts so two quick port announcements can't race. */
  childQueue: Promise<void>;
  reconnectTimer: NodeJS.Timeout | null;
  stopping: boolean;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class DebugManager implements vscode.Disposable {
  private activeSessions = new Map<string, ActiveSession>();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly logger: ILogger) {
    this.disposables.push(
      vscode.debug.onDidStartDebugSession((session) => this.onSessionStarted(session)),
      vscode.debug.onDidTerminateDebugSession((session) => this.onSessionTerminated(session)),
    );
  }

  public async startDebugging(
    parentSession: vscode.DebugSession,
    config: NativeScriptDebugConfiguration,
    onTerminated: SessionTerminatedCallback,
  ): Promise<boolean> {
    const fallbackFolder = parentSession.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
    const appRoot = config.appRoot || config.webRoot || fallbackFolder?.uri.fsPath || '';
    const folder = (appRoot && vscode.workspace.getWorkspaceFolder(vscode.Uri.file(appRoot))) || fallbackFolder;

    this.logger.log(`[NativeScript] appRoot: ${appRoot}\n`);

    const active: ActiveSession = {
      parentSession,
      config,
      appRoot,
      folder,
      onTerminated,
      buildSession: null,
      sourceMapOptions: null,
      childSession: null,
      replacedChildIds: new Set(),
      childQueue: Promise.resolve(),
      reconnectTimer: null,
      stopping: false,
    };

    // Registered before any await so a stop during the build (or the iOS team picker) is honored.
    this.activeSessions.set(parentSession.id, active);

    let buildSession: BuildSession | null;
    try {
      buildSession = await services.buildService.startBuild(
        {
          appRoot,
          platform: config.platform,
          request: config.request,
          watch: config.watch,
          stopOnEntry: config.stopOnEntry,
          launchTests: config.launchTests,
          tnsArgs: config.tnsArgs,
          runtimeExecutable: config.runtimeExecutable,
          runtimeArgs: config.runtimeArgs,
          cwd: config.cwd,
          env: config.env,
          workspaceRoot: folder?.uri.fsPath,
        },
        () => active.stopping,
      );
    } catch (e) {
      void this.cleanup(parentSession.id);
      void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
      throw e;
    }

    if (!buildSession || active.stopping) {
      void buildSession?.disconnect();
      void this.cleanup(parentSession.id);
      return false;
    }

    active.buildSession = buildSession;

    buildSession.on('newPort', (port: number) => {
      if (active.stopping) return;
      this.logger.log(`[NativeScript] App restarted, new debug port: ${port}\n`);
      this.clearReconnectTimer(active);
      void this.queueChildStart(active, port);
    });

    buildSession.on('closed', () => {
      this.logger.log('[NativeScript] ns process closed\n');
      this.terminate(active);
    });

    const port = await buildSession.initialPort;

    if (!port || active.stopping) {
      this.logger.log('[NativeScript] No debug port received, terminating\n');
      void this.cleanup(parentSession.id);
      return false;
    }

    const attached = await this.queueChildStart(active, port);
    if (!attached && !active.stopping) {
      void this.cleanup(parentSession.id);
      void vscode.window.showErrorMessage(`Could not attach the debugger to the app on port ${port}.`);
      return false;
    }
    return !active.stopping;
  }

  /** Resolves once the ns process has exited, so a restart can't race the old CLI. */
  public stopDebugging(parentSessionId: string): Promise<void> {
    return this.cleanup(parentSessionId);
  }

  public dispose(): void {
    for (const id of [...this.activeSessions.keys()]) {
      void this.cleanup(id);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  /** Resolves with whether a child session was started. */
  private queueChildStart(active: ActiveSession, port: number): Promise<boolean> {
    const result = active.childQueue
      .then(() => this.startChildSession(active, port))
      .catch((e: unknown) => {
        this.logger.log(`[NativeScript] Failed to start child debug session: ${String(e)}\n`);
        return false;
      });
    active.childQueue = result.then(() => undefined);
    return result;
  }

  private async startChildSession(active: ActiveSession, port: number): Promise<boolean> {
    if (active.stopping) return false;

    const previous = active.childSession;
    if (previous) {
      active.replacedChildIds.add(previous.id);
      active.childSession = null;
      await this.disconnectChild(previous);
      await delay(CHILD_STOP_SETTLE_MS);
    }

    if (active.stopping) return false;

    const config = active.config;
    const address = getNormalizedAddress(config.address, config.platform);
    // Computed on first attach: platforms/ (used for device map fallbacks) only exists once the build finished.
    active.sourceMapOptions ??= computeSourceMapOptions(
      active.appRoot,
      {
        platform: config.platform,
        sourceMapPathOverrides: config.sourceMapPathOverrides,
        resolveSourceMapLocations: config.resolveSourceMapLocations,
      },
      this.logger,
    );
    const sourceMapOptions = await active.sourceMapOptions;

    const childConfig: vscode.DebugConfiguration = {
      type: 'pwa-node',
      request: 'attach',
      name: config.name,
      websocketAddress: `ws://${address}:${port}`,
      ...sourceMapOptions,
      sourceMaps: config.sourceMaps,
      skipFiles: config.skipFiles,
      smartStep: config.smartStep,
      trace: config.trace ?? (config.diagnosticLogging || undefined),
      [PARENT_SESSION_KEY]: active.parentSession.id,
    };

    this.logger.log(`[NativeScript] Starting child debug session on ws://${address}:${port}\n`);

    for (let attempt = 1; attempt <= CHILD_START_ATTEMPTS; attempt++) {
      if (active.stopping) return false;

      const started = await vscode.debug.startDebugging(active.folder, childConfig, {
        parentSession: active.parentSession,
        lifecycleManagedByParent: true,
        compact: true,
      });

      if (started) return true;

      this.logger.log(`[NativeScript] Child session attempt ${attempt} failed\n`);
      await delay(CHILD_RETRY_DELAY_MS);
    }

    this.logger.log(`[NativeScript] Failed to start child debug session after ${CHILD_START_ATTEMPTS} attempts\n`);
    return false;
  }

  private onSessionStarted(session: vscode.DebugSession): void {
    const parentId: unknown = session.configuration[PARENT_SESSION_KEY];
    if (typeof parentId !== 'string') return;

    const active = this.activeSessions.get(parentId);
    if (!active) {
      // The parent was stopped while this child's startDebugging was still in flight.
      void this.disconnectChild(session);
      return;
    }

    active.childSession = session;
    this.clearReconnectTimer(active);
  }

  private onSessionTerminated(session: vscode.DebugSession): void {
    this.logger.log(`[NativeScript] Session terminated: ${session.name} (type=${session.type})\n`);

    if (this.activeSessions.has(session.id)) {
      void this.cleanup(session.id);
      return;
    }

    const parentId: unknown = session.configuration[PARENT_SESSION_KEY];
    const active = typeof parentId === 'string' ? this.activeSessions.get(parentId) : undefined;
    if (!active) return;

    if (active.childSession?.id === session.id) {
      active.childSession = null;
    }

    if (active.replacedChildIds.delete(session.id) || active.stopping) return;

    if (active.config.watch && active.buildSession) {
      // A LiveSync restart drops the socket before the CLI announces the new port.
      this.logger.log('[NativeScript] Debugger disconnected, waiting for the app to restart\n');
      this.clearReconnectTimer(active);
      active.reconnectTimer = setTimeout(() => {
        this.logger.log('[NativeScript] App did not reconnect in time, stopping\n');
        this.terminate(active);
      }, RECONNECT_TIMEOUT_MS);
      return;
    }

    this.logger.log('[NativeScript] Child session ended, stopping parent\n');
    this.terminate(active);
  }

  private terminate(active: ActiveSession): void {
    if (active.stopping) return;
    // Notify only after the CLI exited, so an immediate relaunch can't overlap the old ns process.
    void this.cleanup(active.parentSession.id).then(() => active.onTerminated());
  }

  /**
   * Children are started with lifecycleManagedByParent, so vscode.debug.stopDebugging(child) would be routed to the
   * NativeScript parent and end the whole session. Sending DAP disconnect straight to js-debug detaches only the child.
   */
  private async disconnectChild(session: vscode.DebugSession): Promise<void> {
    try {
      await session.customRequest('disconnect', { terminateDebuggee: false });
    } catch (e) {
      this.logger.log(`[NativeScript] Failed to disconnect child debug session: ${String(e)}\n`);
    }
  }

  private clearReconnectTimer(active: ActiveSession): void {
    if (active.reconnectTimer) {
      clearTimeout(active.reconnectTimer);
      active.reconnectTimer = null;
    }
  }

  private async cleanup(parentSessionId: string): Promise<void> {
    const active = this.activeSessions.get(parentSessionId);
    if (!active) return;

    active.stopping = true;
    this.activeSessions.delete(parentSessionId);
    this.clearReconnectTimer(active);

    let buildExited: Promise<void> | undefined;
    if (active.buildSession) {
      active.buildSession.removeAllListeners();
      buildExited = active.buildSession.disconnect();
    }

    if (active.childSession) {
      void this.disconnectChild(active.childSession);
      active.childSession = null;
    }

    await buildExited;
  }
}

export function getNormalizedAddress(address: string | undefined, platform: string | undefined): string {
  if (address) return address;
  return platform?.toLowerCase() === 'ios' ? 'localhost' : '127.0.0.1';
}
