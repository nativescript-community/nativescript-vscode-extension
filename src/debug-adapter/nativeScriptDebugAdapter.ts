import { existsSync, readFileSync } from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import {
    ChromeDebugAdapter,
    IRestartRequestArgs,
    ISetBreakpointsArgs,
    ISetBreakpointsResponseBody,
    ITelemetryPropertyCollector,
} from 'vscode-chrome-debug-core';
import { Event, TerminatedEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as extProtocol from '../common/extensionProtocol';
import { NativeScriptSourceMapTransformer } from './nativeScriptSourceMapTransformer';

const reconnectAfterLiveSyncTimeout = 10 * 1000;

export class NativeScriptDebugAdapter extends ChromeDebugAdapter {
    private _idCounter = 0;
    private _pendingRequests: object = {};
    private isLiveSync: boolean = false;
    private portWaitingResolve: any;
    private isDisconnecting: boolean = false;
    private isLiveSyncRestart: boolean = false;
    private breakPointsCache: { [file: string]: { args: ISetBreakpointsArgs, requestSeq: number, ids: number[] } } = {};

    public attach(args: any): Promise<void> {
        return this.processRequestAndAttach(args);
    }

    public launch(args: any): Promise<void> {
        return this.processRequestAndAttach(args);
    }

    public onPortReceived(port) {
        this.portWaitingResolve && this.portWaitingResolve(port);
    }

    public onExtensionResponse(response) {
        this._pendingRequests[response.requestId](response.result);
        delete this._pendingRequests[response.requestId];
    }

    public disconnect(args: any): void {
        this.isDisconnecting = true;
        if (!this.isLiveSyncRestart) {
            this.callRemoteMethod('buildService', 'disconnect');
        }

        super.disconnect(args);
    }

    public async setCachedBreakpointsForScript(script: string): Promise<void> {
        const breakPointData = this.breakPointsCache[script];

        if (breakPointData) {
            await this.setBreakpoints(breakPointData.args, null, breakPointData.requestSeq, breakPointData.ids);
        }
    }

    public async setBreakpoints(
        args: ISetBreakpointsArgs,
        telemetryPropertyCollector: ITelemetryPropertyCollector,
        requestSeq: number,
        ids?: number[]): Promise<ISetBreakpointsResponseBody> {

        if (args && args.source && args.source.path) {
            this.breakPointsCache[args.source.path] = { args: _.cloneDeep(args), requestSeq, ids };
        }

        return super.setBreakpoints(args, telemetryPropertyCollector, requestSeq, ids);
    }

    protected async terminateSession(reason: string, disconnectArgs?: DebugProtocol.DisconnectArguments, restart?: IRestartRequestArgs): Promise<void> {
        let restartRequestArgs = restart;
        let timeoutId;

        if (!this.isDisconnecting && this.isLiveSync) {
            const portProm = new Promise<any>((res, rej) => {
                this.portWaitingResolve = res;

                timeoutId = setTimeout(() => {
                    res();
                }, reconnectAfterLiveSyncTimeout);
            });

            restartRequestArgs = await portProm;
            this.isLiveSyncRestart = restartRequestArgs && !!restartRequestArgs.port;
            clearTimeout(timeoutId);
        }

        await super.terminateSession(reason, disconnectArgs, restartRequestArgs);
    }

    protected hookConnectionEvents(): void {
        super.hookConnectionEvents();

        this.chrome.Log.on('entryAdded', (params) => this.onEntryAdded(params));
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

        const appDirPath = this.getAppDirPath(transformedArgs.webRoot);

        (this.pathTransformer as any).setTransformOptions(args.platform, appDirPath, transformedArgs.webRoot);
        (this.sourceMapTransformer as NativeScriptSourceMapTransformer).setTransformOptions(args.platform.toLowerCase(), this);
        (ChromeDebugAdapter as any).SET_BREAKPOINTS_TIMEOUT = 20000;

        this.isLiveSync = args.watch;

        return super.attach(transformedArgs);
    }

    private getAppDirPath(webRoot: string): string {
        const pathToNsconfig = join(webRoot, 'nsconfig.json');

        if (existsSync(pathToNsconfig)) {
            try {
                const content = readFileSync(pathToNsconfig).toString();
                const jsonContent = JSON.parse(content);

                return jsonContent.appPath;
            } catch (err) {
                // Ignore the error for the moment
            }
        }
    }

    private translateArgs(args): any {
        if (args.diagnosticLogging) {
            args.trace = args.diagnosticLogging;
        }

        if (args.appRoot) {
            args.webRoot = args.appRoot;
        }

        if (!args.sourceMapPathOverrides) {
            args.sourceMapPathOverrides = {};
        }

        if (!args.sourceMapPathOverrides['webpack:///*']) {
            const appDirPath = this.getAppDirPath(args.webRoot) || 'app';
            const fullAppDirPath = join(args.webRoot, appDirPath);

            args.sourceMapPathOverrides['webpack:///*'] = `${fullAppDirPath}/*`;
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
}
