import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildSession } from '../services/buildService';
import { services } from '../services/extensionHostServices';
import { ILogger } from '../common/logger';

export type SessionTerminatedCallback = () => void;

interface ActiveSession {
  buildSession: BuildSession;
  childSession: vscode.DebugSession | null;
  config: vscode.DebugConfiguration;
  folder: vscode.WorkspaceFolder | undefined;
  onTerminated: SessionTerminatedCallback;
  stopping: boolean;
  restartPending: boolean;
}

export class DebugManager {
  private activeSessions = new Map<string, ActiveSession>();
  private logger: ILogger;
  private disposables: vscode.Disposable[] = [];

  constructor(logger: ILogger) {
    this.logger = logger;

    this.disposables.push(
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.logger.log(`[NativeScript] Session terminated: ${session.name} (type=${session.type})\n`);

        if (session.type === 'nativescript') {
          this.onParentSessionTerminated(session);
          return;
        }

        for (const [parentId, active] of this.activeSessions) {
          if (active.childSession === session) {
            active.childSession = null;

            if (active.stopping) return;

            if (!active.restartPending) {
              this.logger.log('[NativeScript] Child session ended, stopping parent\n');
              active.onTerminated();
              this.cleanup(parentId);
            } else {
              this.logger.log('[NativeScript] Child session ended, restart pending\n');
            }
          }
        }
      }),
    );
  }

  public async startDebugging(
    parentSession: vscode.DebugSession,
    config: vscode.DebugConfiguration,
    onTerminated: SessionTerminatedCallback,
  ): Promise<boolean> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const appRoot = config.appRoot || config.webRoot || folder?.uri.fsPath || '';

    this.logger.log(`[NativeScript] appRoot: ${appRoot}\n`);

    const buildSession = await services.buildService.startBuild({
      appRoot,
      platform: config.platform,
      request: config.request,
      watch: config.watch,
      stopOnEntry: config.stopOnEntry,
      launchTests: config.launchTests,
      tnsArgs: config.tnsArgs,
    });

    const active: ActiveSession = {
      buildSession,
      childSession: null,
      config,
      folder,
      onTerminated,
      stopping: false,
      restartPending: false,
    };

    this.activeSessions.set(parentSession.id, active);

    buildSession.portEmitter.on('newPort', (port: number) => {
      if (active.stopping) return;
      this.logger.log(`[NativeScript] LiveSync restart detected, new port: ${port}\n`);
      active.restartPending = true;
      this.startChildSession(parentSession, active, port);
    });

    buildSession.portEmitter.on('closed', () => {
      this.logger.log('[NativeScript] ns process closed\n');
      if (!active.stopping) {
        active.onTerminated();
        this.cleanup(parentSession.id);
      }
    });

    const port = await buildSession.initialPort;

    if (!port) {
      this.logger.log('[NativeScript] No debug port received, terminating\n');
      this.cleanup(parentSession.id);
      return false;
    }

    await this.startChildSession(parentSession, active, port);
    return true;
  }

  public stopDebugging(parentSessionId: string): void {
    this.cleanup(parentSessionId);
  }

  public dispose(): void {
    for (const [id] of this.activeSessions) {
      this.cleanup(id);
    }
    this.disposables.forEach((d) => d.dispose());
  }

  private async startChildSession(
    parentSession: vscode.DebugSession,
    active: ActiveSession,
    port: number,
  ): Promise<void> {
    if (active.stopping) return;

    if (active.childSession) {
      await vscode.debug.stopDebugging(active.childSession);
      active.childSession = null;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (active.stopping) return;

    const config = active.config;
    const address = this.getNormalizedAddress(config.address, config.platform);
    const sourceMapPathOverrides = this.computeSourceMapPathOverrides(config);

    const childConfig: vscode.DebugConfiguration = {
      type: 'pwa-node',
      request: 'attach',
      name: config.name,
      websocketAddress: `ws://${address}:${port}`,
      sourceMapPathOverrides,
      skipFiles: config.skipFiles,
      smartStep: config.smartStep,
      trace: config.diagnosticLogging ? true : config.trace,
      stopOnEntry: config.stopOnEntry,
    };

    this.logger.log(`[NativeScript] Starting child debug session on ws://${address}:${port}\n`);

    for (let attempt = 0; attempt < 3; attempt++) {
      if (active.stopping) return;

      const started = await vscode.debug.startDebugging(active.folder, childConfig, {
        parentSession,
        lifecycleManagedByParent: true,
        compact: true,
      });

      if (started) {
        const childSession = vscode.debug.activeDebugSession;
        if (childSession && childSession.parentSession === parentSession) {
          active.childSession = childSession;
        }
        active.restartPending = false;
        return;
      }

      this.logger.log(`[NativeScript] Child session attempt ${attempt + 1} failed, retrying...\n`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    active.restartPending = false;
    this.logger.log('[NativeScript] Failed to start child debug session after 3 attempts\n');
  }

  private onParentSessionTerminated(session: vscode.DebugSession): void {
    this.cleanup(session.id);
  }

  private cleanup(parentSessionId: string): void {
    const active = this.activeSessions.get(parentSessionId);
    if (!active) return;

    active.stopping = true;
    active.buildSession.portEmitter.removeAllListeners();
    active.buildSession.disconnect();

    if (active.childSession) {
      vscode.debug.stopDebugging(active.childSession);
    }

    this.activeSessions.delete(parentSessionId);
  }

  private getNormalizedAddress(address: string | undefined, platform: string): string {
    if (address) return address;
    return platform?.toLowerCase() === 'ios' ? 'localhost' : '127.0.0.1';
  }

  private computeSourceMapPathOverrides(config: vscode.DebugConfiguration): Record<string, string> {
    const overrides: Record<string, string> = config.sourceMapPathOverrides ? { ...config.sourceMapPathOverrides } : {};
    const webRoot = config.appRoot || config.webRoot || '';
    const appDirPath = this.getAppDirPath(webRoot);
    const fullAppDirPath = appDirPath
      ? path.join(webRoot, appDirPath)
      : path.join(webRoot, this.isAngularProject(webRoot) ? 'src' : 'app');

    if (!overrides['webpack:///*']) {
      overrides['webpack:///*'] = `${fullAppDirPath}/*`;
    }

    const packageFilePath = path.join(webRoot, 'package.json');
    if (fs.existsSync(packageFilePath)) {
      try {
        const packageFile = JSON.parse(fs.readFileSync(packageFilePath, 'utf8')) as { name?: string };
        const extensions = ['js', 'ts', 'vue', 'svelte', 'jsx', 'tsx'];

        const webpackConfig = this.getWebpackConfig(webRoot, config.platform?.toLowerCase());
        let sourceMap = packageFile.name ?? '';
        if (webpackConfig?.output?.devtoolNamespace) {
          sourceMap = webpackConfig.output.devtoolNamespace;
        }

        for (const ext of extensions) {
          overrides[`webpack://${sourceMap}/*.${ext}`] = `${webRoot}/*.${ext}`;
        }

        if (webpackConfig?.output?.library) {
          const key = `webpack://${webpackConfig.output.library}/*`;
          overrides[key] = overrides[key] || `${fullAppDirPath}/*`;
        }
      } catch {
        this.logger.log(`[NativeScript] Warning: could not read ${packageFilePath}\n`);
      }
    }

    return overrides;
  }

  private getAppDirPath(webRoot: string): string | undefined {
    const pathToNsconfig = path.join(webRoot, 'nsconfig.json');
    const pathToNativeScriptConfig = path.join(webRoot, 'nativescript.config.ts');

    if (fs.existsSync(pathToNsconfig)) {
      try {
        const content = fs.readFileSync(pathToNsconfig, 'utf8');
        const jsonContent = JSON.parse(content);
        return jsonContent.appPath;
      } catch {
        // ignore
      }
    } else if (fs.existsSync(pathToNativeScriptConfig)) {
      try {
        const configContent = fs.readFileSync(pathToNativeScriptConfig, 'utf8');
        if (configContent.indexOf(`appPath: 'src'`) === -1) {
          const appPath = configContent.split(/appPath:\s*["'`](\w+)["'`]/im)[1];
          return appPath;
        }
      } catch {
        // ignore
      }
    }

    return undefined;
  }

  private isAngularProject(webRoot: string): boolean {
    if (fs.existsSync(path.join(webRoot, 'angular.json'))) {
      return true;
    }

    const packageJsonPath = path.join(webRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return !!content?.dependencies?.['@angular/core'];
      } catch {
        // ignore
      }
    }

    return false;
  }

  private getWebpackConfig(
    webRoot: string,
    platform?: string,
  ): { output?: { library?: string; devtoolNamespace?: string } } | null {
    const webpackConfigFile = path.join(webRoot, 'webpack.config.js');
    if (!fs.existsSync(webpackConfigFile) || !platform) return null;

    const savedCwd = process.cwd();
    try {
      process.chdir(webRoot);
      const webpackConfig = require(webpackConfigFile);
      const result = webpackConfig({ [platform]: platform });
      process.chdir(savedCwd);
      return result;
    } catch {
      process.chdir(savedCwd);
      return null;
    }
  }
}
