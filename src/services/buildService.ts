import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ILogger } from '../common/logger';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { IDebugResult } from '../project/project';
import * as utils from '../common/utilities';
import { services } from './extensionHostServices';

export interface BuildSession {
  initialPort: Promise<number | undefined>;
  portEmitter: EventEmitter;
  disconnect(): void;
}

export class BuildService {
  private _tnsProcess: ChildProcess | null = null;
  private _logger: ILogger;

  constructor(logger: ILogger) {
    this._logger = logger;
  }

  public async startBuild(args: {
    appRoot: string;
    platform: string;
    request: string;
    watch?: boolean;
    stopOnEntry?: boolean;
    launchTests?: boolean;
    tnsArgs?: string[];
  }): Promise<BuildSession> {
    const nsPath = services.workspaceConfigService.nsPath;

    this._logger.log(`[NativeScript] Using ns CLI on path '${nsPath}'\n`);
    const nsPathResolved = nsPath !== 'ns' && !path.isAbsolute(nsPath) ? path.join(args.appRoot, nsPath) : nsPath;
    const cli = new NativeScriptCli(nsPathResolved, this._logger);

    const project = args.platform === 'ios' ? new IosProject(args.appRoot, cli) : new AndroidProject(args.appRoot, cli);

    services.analyticsService.launchDebugger(args.request, args.platform);

    const version = project.cli.executeGetVersion();
    this._logger.log(`[NativeScript] Using ns CLI v${version} on path '${project.cli.path}'\n`);
    this._logger.log('[NativeScript] Running ns command...\n');

    let cliCommand: IDebugResult;

    if (args.request === 'launch') {
      let tnsArgs = args.tnsArgs;

      if (args.platform?.toLowerCase() === 'ios') {
        const teamId = this.getTeamId(path.join(args.appRoot, 'app'), tnsArgs);

        if (!teamId) {
          const selectedTeam = await services.iOSTeamService.selectTeam();

          if (selectedTeam) {
            tnsArgs = (tnsArgs ?? []).concat(['--teamId', selectedTeam.id]);
            this._logger.log(`[NativeScript] Using iOS Team ID '${selectedTeam.id}'\n`);
          }
        }
      }

      cliCommand = project.debug(
        {
          stopOnEntry: args.stopOnEntry ?? false,
          watch: args.watch ?? false,
          launchTests: args.launchTests ?? false,
        },
        tnsArgs,
      );
    } else {
      cliCommand = project.attach(args.tnsArgs);
    }

    const portEmitter = new EventEmitter();
    let firstPortResolve: ((port: number | undefined) => void) | null = null;
    let lastPortTimestamp = 0;

    const initialPort = new Promise<number | undefined>((resolve) => {
      firstPortResolve = resolve;
    });

    if (cliCommand.tnsProcess) {
      this._tnsProcess = cliCommand.tnsProcess;
      cliCommand.tnsProcess.stdout!.on('data', (data: Buffer) => {
        this._logger.log(data.toString());
      });
      cliCommand.tnsProcess.stderr!.on('data', (data: Buffer) => {
        this._logger.log(data.toString());
      });

      cliCommand.tnsProcess.on('close', (code) => {
        this._logger.log(`[NativeScript] The ns command finished with code ${code}.\n`);
        if (firstPortResolve) {
          firstPortResolve(undefined);
          firstPortResolve = null;
        }
        portEmitter.emit('closed', code);
      });
    }

    this._logger.log('[NativeScript] Watching ns CLI output for connection token\n');

    cliCommand.tnsOutputEventEmitter.on('readyForConnection', (connectionToken: string | number) => {
      const port = typeof connectionToken === 'string' ? parseInt(connectionToken, 10) : connectionToken;
      const now = Date.now();
      this._logger.log(`[NativeScript] Ready to attach on port ${port}\n`);

      if (firstPortResolve) {
        firstPortResolve(port);
        firstPortResolve = null;
        lastPortTimestamp = now;
      } else if (now - lastPortTimestamp > 2000) {
        lastPortTimestamp = now;
        portEmitter.emit('newPort', port);
      } else {
        this._logger.log(`[NativeScript] Ignoring duplicate port notification\n`);
      }
    });

    return {
      initialPort,
      portEmitter,
      disconnect: () => this.disconnect(),
    };
  }

  public disconnect(): void {
    if (this._tnsProcess) {
      this._tnsProcess.stdout?.removeAllListeners();
      this._tnsProcess.stderr?.removeAllListeners();
      this._tnsProcess.removeAllListeners();
      utils.killProcess(this._tnsProcess);
      this._tnsProcess = null;
    }
  }

  private getTeamId(appRoot: string, tnsArgs?: string[]): string | null {
    if (tnsArgs) {
      const teamIdArgIndex = tnsArgs.indexOf('--teamId');
      if (teamIdArgIndex > 0 && teamIdArgIndex + 1 < tnsArgs.length) {
        return tnsArgs[teamIdArgIndex + 1];
      }
    }

    return this.readTeamId(appRoot);
  }

  private readXCConfig(appRoot: string, flag: string): string | null {
    const xcconfigFile = path.join(appRoot, 'App_Resources/iOS/build.xcconfig');

    if (fs.existsSync(xcconfigFile)) {
      const text = fs.readFileSync(xcconfigFile, { encoding: 'utf8' });
      let teamId: string | undefined;

      text.split(/\r?\n/).forEach((line) => {
        line = line.replace(/\/(\/)[^\n]*$/, '');
        if (line.indexOf(flag) >= 0) {
          teamId = line.split('=')[1]?.trim();
          if (teamId && teamId[teamId.length - 1] === ';') {
            teamId = teamId.slice(0, -1);
          }
        }
      });
      if (teamId) {
        return teamId;
      }
    }

    const fileName = path.join(appRoot, 'teamid');
    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, { encoding: 'utf8' });
    }

    return null;
  }

  private readTeamId(appRoot: string): string | null {
    return this.readXCConfig(appRoot, 'DEVELOPMENT_TEAM');
  }
}
