import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from '../common/utilities';

import { ChildProcess } from 'child_process';
import { ILogger } from '../common/logger';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { IDebugResult } from '../project/project';
import { services } from './extensionHostServices';

export class BuildService {
    private _tnsProcess: ChildProcess;
    private _logger: ILogger;

    constructor(logger: ILogger) {
        this._logger = logger;
    }

    public async processRequest(args: any): Promise<any> {
        const tnsPath = services.workspaceConfigService.tnsPath;
        const cli = new NativeScriptCli(tnsPath, this._logger);

        const project = args.platform === 'ios' ?
            new IosProject(args.appRoot, cli) :
            new AndroidProject(args.appRoot, cli);

        services.analyticsService.launchDebugger(args.request, args.platform);

        // Run CLI Command
        const version = project.cli.executeGetVersion();

        this._logger.log(`[NSDebugAdapter] Using tns CLI v${version} on path '${project.cli.path}'\n`);
        this._logger.log('[NSDebugAdapter] Running tns command...\n');

        let cliCommand: IDebugResult;

        if (args.request === 'launch') {
            let tnsArgs = args.tnsArgs;

            // For iOS the TeamID is required if there's more than one.
            // Therefore if not set, show selection to the user.
            if (args.platform && args.platform.toLowerCase() === 'ios') {
                const teamId = this.getTeamId(path.join(args.appRoot, 'app'), tnsArgs);

                if (!teamId) {
                    const selectedTeam = await services.iOSTeamService.selectTeam();

                    if (selectedTeam) {
                        // add the selected by the user Team Id
                        tnsArgs = (tnsArgs || []).concat(['--teamId', selectedTeam.id]);
                        this._logger.log(`[NSDebugAdapter] Using iOS Team ID '${selectedTeam.id}', you can change this in the workspace settings.\n`);
                    }
                }
            }

            cliCommand = project.debug({ stopOnEntry: args.stopOnEntry, watch: args.watch }, tnsArgs);
        } else if (args.request === 'attach') {
            cliCommand = project.attach(args.tnsArgs);
        }

        return new Promise<string | number> ((res, rej) => {
            if (cliCommand.tnsProcess) {
                this._tnsProcess = cliCommand.tnsProcess;
                cliCommand.tnsProcess.stdout.on('data', (data) => { this._logger.log(data.toString()); });
                cliCommand.tnsProcess.stderr.on('data', (data) => { this._logger.log(data.toString()); });

                cliCommand.tnsProcess.on('close', (code, signal) => {
                    this._logger.log(`[NSDebugAdapter] The tns command finished its execution with code ${code}.\n`);

                    // Sometimes we execute "tns debug android --start" and the process finishes
                    // which is totally fine. If there's an error we need to Terminate the session.
                    if (code !== 0) {
                        const errorMessage = `The tns command finished its execution with code ${code}`;

                        this._logger.log(errorMessage);
                    }

                    res();
                });
            }

            this._logger.log('[NSDebugAdapter] Watching the tns CLI output to receive a connection token\n');

            cliCommand.tnsOutputEventEmitter.on('readyForConnection', (connectionToken: string | number) => {
                this._logger.log(`[NSDebugAdapter] Ready to attach to application on ${connectionToken}\n`);
                args.port = connectionToken;
                vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.customRequest('onPortReceived', { port: connectionToken });

                res(connectionToken);
            });
        });
    }

    public disconnect(): void {
        if (this._tnsProcess) {
            this._tnsProcess.stdout.removeAllListeners();
            this._tnsProcess.stderr.removeAllListeners();
            this._tnsProcess.removeAllListeners();
            utils.killProcess(this._tnsProcess);
        }
    }

    private getTeamId(appRoot: string, tnsArgs?: string[]): string {
        // try to get the TeamId from the TnsArgs
        if (tnsArgs) {
            const teamIdArgIndex = tnsArgs.indexOf('--teamId');

            if (teamIdArgIndex > 0 && teamIdArgIndex + 1 < tnsArgs.length) {
                return tnsArgs[ teamIdArgIndex + 1 ];
            }
        }

        // try to get the TeamId from the buildxcconfig or teamid file
        const teamIdFromConfig = this.readTeamId(appRoot);

        if (teamIdFromConfig) {
            return teamIdFromConfig;
        }

        // we should get the Teams from the machine and ask the user if they are more than 1
        return null;
    }

    private readXCConfig(appRoot: string, flag: string): string {
        const xcconfigFile = path.join(appRoot, 'App_Resources/iOS/build.xcconfig');

        if (fs.existsSync(xcconfigFile)) {
            const text = fs.readFileSync(xcconfigFile, { encoding: 'utf8'});
            let teamId: string;

            text.split(/\r?\n/).forEach((line) => {
                line = line.replace(/\/(\/)[^\n]*$/, '');
                if (line.indexOf(flag) >= 0) {
                    teamId = line.split('=')[1].trim();
                    if (teamId[teamId.length - 1] === ';') {
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

    private readTeamId(appRoot): string {
        return this.readXCConfig(appRoot, 'DEVELOPMENT_TEAM');
    }
}
