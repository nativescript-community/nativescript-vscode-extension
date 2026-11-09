import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ILogger } from '../common/logger';
import * as utils from '../common/utilities';
import { getBundler, isVitestProject } from '../project/projectInfo';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { IDebugResult, Project, ProjectOptions } from '../project/project';
import { services } from './extensionHostServices';

export interface BuildArgs {
  appRoot: string;
  platform: string;
  request: string;
  watch?: boolean;
  stopOnEntry?: boolean;
  launchTests?: boolean;
  tnsArgs?: string[];
  /** Replaces the ns CLI; the command then runs exactly as given, with no flags added. */
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  /** Working directory for the command; relative paths resolve against workspaceRoot. Defaults to appRoot. */
  cwd?: string;
  env?: utils.EnvOverrides;
  workspaceRoot?: string;
}

/** Ignore repeated port announcements closer together than this; the CLI can print the same port twice. */
const DUPLICATE_PORT_WINDOW_MS = 2000;

/** How long the CLI gets to clean up after SIGINT before it is killed. */
export const CLI_EXIT_TIMEOUT_MS = 5000;

/**
 * One running `ns debug`/`ns test` process.
 *
 * Events: `newPort` (port: number) when the app restarted and opened a new debug port,
 * `closed` (code: number | null) when the CLI process exited.
 */
export class BuildSession extends EventEmitter {
  /** Resolves with the first debug port, or `undefined` if the process exits or is stopped first. */
  public readonly initialPort: Promise<number | undefined>;

  private resolveInitialPort?: (port: number | undefined) => void;
  private lastPortTimestamp = 0;
  private process: ChildProcess | null;
  private exited: Promise<void> = Promise.resolve();

  constructor(
    command: IDebugResult,
    private readonly logger: ILogger,
  ) {
    super();
    this.process = command.tnsProcess;
    this.initialPort = new Promise((resolve) => (this.resolveInitialPort = resolve));

    command.tnsProcess.stdout!.on('data', (data: Buffer | string) => this.logger.log(data.toString()));
    command.tnsProcess.stderr!.on('data', (data: Buffer | string) => this.logger.log(data.toString()));

    command.tnsProcess.on('error', (error) => {
      this.logger.log(`[NativeScript] Failed to start the ns command: ${error.message}\n`);
      this.finish(null);
    });
    command.tnsProcess.on('close', (code) => {
      this.logger.log(`[NativeScript] The ns command finished with code ${code}.\n`);
      this.finish(code);
    });

    command.tnsOutputEventEmitter.on('readyForConnection', (connectionToken: string | number) =>
      this.onPort(typeof connectionToken === 'string' ? parseInt(connectionToken, 10) : connectionToken),
    );
  }

  /** Stops the CLI and resolves once it has exited (or was force-killed after CLI_EXIT_TIMEOUT_MS). */
  public disconnect(): Promise<void> {
    const child = this.process;
    if (!child) return this.exited;

    this.process = null;
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
    child.removeAllListeners();
    this.resolveInitialPort?.(undefined);
    this.resolveInitialPort = undefined;

    this.exited = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        this.logger.log('[NativeScript] The ns command did not exit in time, killing it\n');
        utils.killProcess(child, this.logger, 'SIGKILL');
        resolve();
      }, CLI_EXIT_TIMEOUT_MS);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    utils.killProcess(child, this.logger);
    return this.exited;
  }

  private onPort(port: number): void {
    const now = Date.now();
    this.logger.log(`[NativeScript] Ready to attach on port ${port}\n`);

    if (this.resolveInitialPort) {
      this.resolveInitialPort(port);
      this.resolveInitialPort = undefined;
      this.lastPortTimestamp = now;
    } else if (now - this.lastPortTimestamp > DUPLICATE_PORT_WINDOW_MS) {
      this.lastPortTimestamp = now;
      this.emit('newPort', port);
    } else {
      this.logger.log('[NativeScript] Ignoring duplicate port notification\n');
    }
  }

  private finish(code: number | null): void {
    if (!this.process) return;

    this.process = null;
    this.resolveInitialPort?.(undefined);
    this.resolveInitialPort = undefined;
    this.emit('closed', code);
  }
}

export class BuildService {
  constructor(private readonly logger: ILogger) {}

  /**
   * @param isCancelled checked after each await so a session stopped mid-startup never spawns the CLI.
   */
  public async startBuild(args: BuildArgs, isCancelled: () => boolean = () => false): Promise<BuildSession | null> {
    const cli = services.createCli(args.appRoot);
    const platform = args.platform?.toLowerCase();
    const projectOptions: ProjectOptions = { cwd: this.resolveCwd(args), env: args.env };

    if (args.runtimeExecutable) {
      return this.startCustomCommand(
        args,
        platform,
        this.createProject(platform, args.appRoot, cli, projectOptions),
        isCancelled,
      );
    }

    this.logger.log(`[NativeScript] Using ns CLI on path '${cli.path}'\n`);
    const version = await cli.getSupportedVersion(services.minCliVersion);
    this.logger.log(`[NativeScript] Using ns CLI v${version}\n`);

    if (args.launchTests && isVitestProject(args.appRoot)) {
      throw new Error(
        "Debugging unit tests is not supported for projects using the Vitest test runner. Run 'ns test' from a terminal instead.",
      );
    }

    const project = this.createProject(platform, args.appRoot, cli, projectOptions);
    void services.analyticsService.trackDebug(args.request, platform);

    let tnsArgs = [...(args.tnsArgs ?? [])];

    if (getBundler(args.appRoot) === 'vite' && !tnsArgs.some((arg) => /^--(no-)?hmr$/.test(arg))) {
      // Vite HMR serves app code over HTTP without source maps, so breakpoints can't bind.
      tnsArgs.push('--no-hmr');
    }

    if (args.request === 'launch' && platform === 'ios' && !this.getTeamId(args.appRoot, tnsArgs)) {
      const selectedTeam = await services.iOSTeamService.selectTeam();

      if (selectedTeam) {
        tnsArgs = tnsArgs.concat(['--teamId', selectedTeam.id]);
        this.logger.log(`[NativeScript] Using iOS Team ID '${selectedTeam.id}'\n`);
      }
    }

    if (isCancelled()) return null;

    this.logger.log('[NativeScript] Running ns command...\n');

    const command =
      args.request === 'launch'
        ? project.debug(
            {
              stopOnEntry: args.stopOnEntry ?? false,
              watch: args.watch ?? false,
              launchTests: args.launchTests ?? false,
            },
            tnsArgs,
          )
        : project.attach(tnsArgs);

    this.logger.log('[NativeScript] Watching ns CLI output for connection token\n');

    return new BuildSession(command, this.logger);
  }

  private startCustomCommand(
    args: BuildArgs,
    platform: string,
    project: Project,
    isCancelled: () => boolean,
  ): BuildSession | null {
    const runtimeArgs = args.runtimeArgs ?? [];
    if (args.tnsArgs?.length) {
      this.logger.log("[NativeScript] 'tnsArgs' is ignored when 'runtimeExecutable' is set; use 'runtimeArgs'\n");
    }

    void services.analyticsService.trackDebug(args.request, platform);

    if (isCancelled()) return null;

    // Each runtimeArgs entry is one argument, as in js-debug launch configs.
    const commandLine = [args.runtimeExecutable!, ...runtimeArgs].map((arg) => utils.quoteShellArg(arg)).join(' ');
    const cwd = this.resolveCwd(args);
    this.logger.log(`[NativeScript] Running: ${commandLine} (in ${cwd})\n`);
    const child = utils.spawnInShell(commandLine, { cwd, env: args.env });

    this.logger.log('[NativeScript] Watching command output for the debug port\n');
    return new BuildSession(project.monitor(child, runtimeArgs), this.logger);
  }

  private createProject(platform: string, appRoot: string, cli: NativeScriptCli, options: ProjectOptions): Project {
    return platform === 'ios' ? new IosProject(appRoot, cli, options) : new AndroidProject(appRoot, cli, options);
  }

  private resolveCwd(args: BuildArgs): string {
    if (!args.cwd) return args.appRoot;
    return path.resolve(args.workspaceRoot ?? args.appRoot, args.cwd);
  }

  private getTeamId(appRoot: string, tnsArgs: string[]): string | null {
    const teamIdArgIndex = tnsArgs.indexOf('--teamId');
    if (teamIdArgIndex >= 0 && teamIdArgIndex + 1 < tnsArgs.length) {
      return tnsArgs[teamIdArgIndex + 1];
    }

    return this.readTeamId(path.join(appRoot, 'app')) ?? this.readTeamId(appRoot);
  }

  private readTeamId(appDir: string): string | null {
    const xcconfigFile = path.join(appDir, 'App_Resources/iOS/build.xcconfig');

    if (fs.existsSync(xcconfigFile)) {
      let teamId: string | undefined;

      for (let line of fs.readFileSync(xcconfigFile, { encoding: 'utf8' }).split(/\r?\n/)) {
        line = line.replace(/\/\/[^\n]*$/, '');
        if (line.includes('DEVELOPMENT_TEAM')) {
          teamId = line.split('=')[1]?.trim().replace(/;$/, '');
        }
      }

      if (teamId) {
        return teamId;
      }
    }

    const fileName = path.join(appDir, 'teamid');
    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, { encoding: 'utf8' }).trim();
    }

    return null;
  }
}
