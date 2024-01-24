import { existsSync, readFileSync } from 'fs';
import * as stripJsonComments from 'strip-json-comments';
import * as _ from 'lodash';
import { join } from 'path';
import {
    ChromeDebugAdapter,
    IRestartRequestArgs,
    ISetBreakpointsArgs,
    ISetBreakpointsResponseBody,
    ITelemetryPropertyCollector,
} from 'vscode-chrome-debug-core';
import { Event, logger, TerminatedEvent } from 'vscode-debugadapter';
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
            const portProm = new Promise<void>((res, rej) => {
                this.portWaitingResolve = res;

                timeoutId = setTimeout(() => {
                    res();
                }, reconnectAfterLiveSyncTimeout);
            });

            restartRequestArgs = await portProm as any;
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
        transformedArgs.address = this.applyLoopbackAddress(transformedArgs.address, args.platform.toLowerCase());

        return super.attach(transformedArgs);
    }

    private getAppDirPath(webRoot: string): string {
        const pathToNsconfig = join(webRoot, 'nsconfig.json');
        const pathToNativeScriptConfig = join(webRoot, 'nativescript.config.ts');

        if (existsSync(pathToNsconfig)) {
            try {
                const content = readFileSync(pathToNsconfig).toString();
                const jsonContent = JSON.parse(stripJsonComments(content));

                return jsonContent.appPath;
            } catch (err) {
                // Ignore the error for the moment
            }
        } else if (existsSync(pathToNativeScriptConfig)) {
            try {
                const nativeScriptConfigTSContent = readFileSync(pathToNativeScriptConfig, {
                    encoding: 'utf8'
                });
                if (nativeScriptConfigTSContent) {
                    // need a AST parser here - ridumentary check for now
                    // assuming 3 likely values: www, build or dist
                    if (nativeScriptConfigTSContent.indexOf(`appPath: 'src'`) === -1) {
                        // not using default, parse it out
                        const appPath = nativeScriptConfigTSContent.split(/appPath:\s*["'`](\w+)["'`]/gim)[1];
                        return appPath;
                    }
                }
            } catch (err) {
                // ignore
            }
        }
    }

    /**
     * Determines if the NativeScript project being debugged is an Angular based
     * project by returning true if an **angular.json** file exists at the base
     * of the project or returns false if not found.
     * @param webRoot The root of the project.
     */
    private isAngularProject(webRoot): boolean {
        let isAngularProject = existsSync(join(webRoot, 'angular.json'));

        if (isAngularProject) {
            logger.log('Angular project detected, found angular.json file.');
        } else {
            let packageJson = existsSync(join(webRoot, 'package.json'));
            if (packageJson) {
                try {
                    const packageJsonContent = readFileSync(join(webRoot, 'package.json'), {
                        encoding: 'utf8',
                    });
                    const jsonContent = JSON.parse(stripJsonComments(packageJsonContent));
                    if (jsonContent && jsonContent.dependencies && jsonContent.dependencies['@angular/core']) {
                        isAngularProject = true;
                    }
                } catch (err) {

                }
            }
        }

        return isAngularProject;
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

        const appDirPath = this.getAppDirPath(args.webRoot) || (this.isAngularProject(args.webRoot) ? 'src' : 'app');
        const fullAppDirPath = join(args.webRoot, appDirPath);

        if (!args.sourceMapPathOverrides['webpack:///*']) {
            args.sourceMapPathOverrides['webpack:///*'] = `${fullAppDirPath}/*`;
        }

        const webpackConfigFile = join(args.webRoot, 'webpack.config.js');

        if (existsSync(webpackConfigFile)) {
            try {
                const webpackConfig = require(webpackConfigFile);
                const platform = args.platform && args.platform.toLowerCase();
                const config = webpackConfig({ [`${platform}`]: platform });

                if (config && config.output && config.output.library) {
                    const sourceMapPathOverrideWithLib = `webpack://${config.output.library}/*`;

                    args.sourceMapPathOverrides[sourceMapPathOverrideWithLib] = args.sourceMapPathOverrides[sourceMapPathOverrideWithLib] ||
                        `${fullAppDirPath}/*`;
                }
            } catch (err) {
                logger.warn(`Error when trying to require webpack.config.js file from path '${webpackConfigFile}'. Error is: ${err}`);
            }
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

    private applyLoopbackAddress(address: string, platform: string) {
        if (address === undefined && platform === "ios") {
            // If it is undefined it will use 127.0.0.1 and will fail on iOS
            return "localhost";
        }
        return address;
    }
}
