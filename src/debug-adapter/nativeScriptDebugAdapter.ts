import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ChromeDebugAdapter, logger } from 'vscode-chrome-debug-core';
import { Event, OutputEvent, TerminatedEvent } from 'vscode-debugadapter';
import * as extProtocol from '../common/extensionProtocol';
import * as utils from '../common/utilities';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { IDebugResult } from '../project/project';

export function nativeScriptDebugAdapterGenerator(iosProject: typeof IosProject,
                                                  androidProject: typeof AndroidProject,
                                                  nativeScriptCli: typeof NativeScriptCli) {
    return class NativeScriptDebugAdapter extends ChromeDebugAdapter {
        private _tnsProcess: ChildProcess;
        private _idCounter = 0;
        private _pendingRequests: object = {};

        public attach(args: any): Promise<void> {
            return this.processRequestAndAttach(args);
        }

        public launch(args: any): Promise<void> {
            return this.processRequestAndAttach(args);
        }

        public disconnect(args: any): void {
            super.disconnect(args);

            if (this._tnsProcess) {
                this._tnsProcess.stdout.removeAllListeners();
                this._tnsProcess.stderr.removeAllListeners();
                this._tnsProcess.removeAllListeners();
                utils.killProcess(this._tnsProcess);
            }
        }

        public onExtensionResponse(response) {
            this._pendingRequests[response.requestId](response.result);
            delete this._pendingRequests[response.requestId];
        }

        private async processRequestAndAttach(args: any) {
            const transformedArgs = await this.processRequest(args);

            (this.pathTransformer as any).setTargetPlatform(args.platform);
            (ChromeDebugAdapter as any).SET_BREAKPOINTS_TIMEOUT = 20000;

            return super.attach(transformedArgs);
        }

        private async processRequest(args: any): Promise<any> {
            args = this.translateArgs(args);

            this._session.sendEvent(new Event(extProtocol.BEFORE_DEBUG_START));

            const tnsPath = await this.callRemoteMethod<string>('workspaceConfigService', 'tnsPath');
            const cli = new nativeScriptCli(tnsPath, logger);

            const project = args.platform === 'ios' ?
                new iosProject(args.appRoot, cli) :
                new androidProject(args.appRoot, cli);

            this.callRemoteMethod('analyticsService', 'launchDebugger', args.request, args.platform);

            // Run CLI Command
            const version = project.cli.executeGetVersion();

            this.log(`[NSDebugAdapter] Using tns CLI v${version} on path '${project.cli.path}'\n`);
            this.log('[NSDebugAdapter] Running tns command...\n');
            let cliCommand: IDebugResult;

            if (args.request === 'launch') {
                let tnsArgs = args.tnsArgs;

                // For iOS the TeamID is required if there's more than one.
                // Therefore if not set, show selection to the user.
                if (args.platform && args.platform.toLowerCase() === 'ios') {
                    const teamId = this.getTeamId(path.join(args.appRoot, 'app'), tnsArgs);

                    if (!teamId) {
                        const selectedTeam = await this.callRemoteMethod<{ id: string, name: string }>('iOSTeamService', 'selectTeam');

                        if (selectedTeam) {
                            // add the selected by the user Team Id
                            tnsArgs = (tnsArgs || []).concat(['--teamId', selectedTeam.id]);
                            this.log(`[NSDebugAdapter] Using iOS Team ID '${selectedTeam.id}', you can change this in the workspace settings.\n`);
                        }
                    }
                }

                cliCommand = project.debug({ stopOnEntry: args.stopOnEntry, watch: args.watch }, tnsArgs);
            } else if (args.request === 'attach') {
                cliCommand = project.attach(args.tnsArgs);
            }

            if (cliCommand.tnsProcess) {
                this._tnsProcess = cliCommand.tnsProcess;
                cliCommand.tnsProcess.stdout.on('data', (data) => { this.log(data.toString()); });
                cliCommand.tnsProcess.stderr.on('data', (data) => { this.log(data.toString()); });

                cliCommand.tnsProcess.on('close', (code, signal) => {
                    this.log(`[NSDebugAdapter] The tns command finished its execution with code ${code}.\n`);

                    // Sometimes we execute "tns debug android --start" and the process finishes
                    // which is totally fine. If there's an error we need to Terminate the session.
                    if (code !== 0) {
                        this.log(`The tns command finished its execution with code ${code}`);
                        this._session.sendEvent(new TerminatedEvent());
                    }
                });
            }

            this.log('[NSDebugAdapter] Watching the tns CLI output to receive a connection token\n');

            return new Promise<string | number> ((res, rej) => {
                cliCommand.tnsOutputEventEmitter.on('readyForConnection', (connectionToken: string | number) => {
                    this.log(`[NSDebugAdapter] Ready to attach to application on ${connectionToken}\n`);
                    args.port = connectionToken;

                    res(args);
                });
            });
        }

        private translateArgs(args): any {
            if (args.diagnosticLogging) {
                args.trace = args.diagnosticLogging;
            }

            if (args.appRoot) {
                args.webRoot = args.appRoot;
            }

            return args;
        }

        private log(text: string): void {
            this._session.sendEvent(new OutputEvent(text));
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

        private callRemoteMethod<T>(service: string, method: string, ...args: any[]): Promise<T> {
            const request: extProtocol.IRequest = { id: `req${++this._idCounter}`, service, method, args };

            return new Promise<T>((res, rej) => {
                this._pendingRequests[request.id] = res;

                this._session.sendEvent(new Event(extProtocol.NS_DEBUG_ADAPTER_MESSAGE, request));
            });
        }
    };
}
