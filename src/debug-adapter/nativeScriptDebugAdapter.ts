import { ChromeDebugAdapter, IRestartRequestArgs, logger } from 'vscode-chrome-debug-core';
import { Event, TerminatedEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as extProtocol from '../common/extensionProtocol';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';

const reconnectAfterLiveSyncTimeout = 10 * 1000;

export function nativeScriptDebugAdapterGenerator(iosProject: typeof IosProject,
                                                  androidProject: typeof AndroidProject,
                                                  nativeScriptCli: typeof NativeScriptCli) {
    return class NativeScriptDebugAdapter extends ChromeDebugAdapter {
        private _idCounter = 0;
        private _pendingRequests: object = {};
        private isLiveSync: boolean = false;
        private portWaitingResolve: any;

        public attach(args: any): Promise<void> {
            return this.processRequestAndAttach(args);
        }

        public launch(args: any): Promise<void> {
            return this.processRequestAndAttach(args);
        }

        public disconnect(args: any): void {
            super.disconnect(args);

            if (!args.restart) {
                this.callRemoteMethod('buildService', 'disconnect');
            }
        }

        public onPortReceived(port) {
            this.portWaitingResolve && this.portWaitingResolve(port);
        }

        public onExtensionResponse(response) {
            this._pendingRequests[response.requestId](response.result);
            delete this._pendingRequests[response.requestId];
        }

        protected async terminateSession(reason: string, disconnectArgs?: DebugProtocol.DisconnectArguments, restart?: IRestartRequestArgs): Promise<void> {
            let restartRequestArgs;
            let timeoutId;

            if (this.isLiveSync) {
                const portProm = new Promise<any>((res, rej) => {
                    this. portWaitingResolve = res;

                    timeoutId = setTimeout(() => {
                        res();
                    }, reconnectAfterLiveSyncTimeout);
                });

                restartRequestArgs = await portProm;
                clearTimeout(timeoutId);
            }

            await super.terminateSession(reason, disconnectArgs, restartRequestArgs);
        }

        protected hookConnectionEvents(): void {
            super.hookConnectionEvents();

            this.chrome.Log.onEntryAdded((params) => this.onEntryAdded(params));
        }

        protected onEntryAdded(params: any): void {
            if (params && params.entry && params.entry.level) {
                const message = params.entry;

                message.type = message.level;

                const that = this as any;
                const script = that.getScriptByUrl && that.getScriptByUrl(params.entry.url);

                if (script) {
                    message.stack = {
                        callFrames: [
                            {
                                columnNumber: 0,
                                lineNumber: params.entry.lineNumber,
                                scriptId: script.scriptId,
                                url: params.entry.url,
                            },
                        ],
                    };
                }

                this.onMessageAdded({
                    message,
                });
            }
        }

        private async processRequestAndAttach(args: any) {
            const transformedArgs = this.translateArgs(args);

            if (args.__restart) {
                transformedArgs.port = args.__restart.port;
            } else {
                this._session.sendEvent(new Event(extProtocol.BEFORE_DEBUG_START));
                transformedArgs.port = await this.callRemoteMethod('buildService', 'processRequest', transformedArgs);
            }

            if (!transformedArgs.port) {
                this._session.sendEvent(new TerminatedEvent());
            }

            (this.pathTransformer as any).setTargetPlatform(args.platform);
            (ChromeDebugAdapter as any).SET_BREAKPOINTS_TIMEOUT = 20000;

            this.isLiveSync = args.watch;

            return super.attach(transformedArgs);
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

        private callRemoteMethod<T>(service: string, method: string, ...args: any[]): Promise<T> {
            const request: extProtocol.IRequest = { id: `req${++this._idCounter}`, service, method, args };

            return new Promise<T>((res, rej) => {
                this._pendingRequests[request.id] = res;

                this._session.sendEvent(new Event(extProtocol.NS_DEBUG_ADAPTER_MESSAGE, request));
            });
        }
    };
}
