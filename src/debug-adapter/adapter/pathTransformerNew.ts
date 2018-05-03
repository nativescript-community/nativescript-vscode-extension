import { BasePathTransformer, ISetBreakpointsArgs, ILaunchRequestArgs, IAttachRequestArgs, IStackTraceResponseBody } from 'vscode-chrome-debug-core';
import * as utils from '../../common/utilities';
import {Services} from '../../services/debugAdapterServices';
import {DebugProtocol} from 'vscode-debugprotocol';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: ISetBreakpointsArgs;
}


export class PathTransformerNew extends BasePathTransformer {
    private _appRoot: string;
    private _platform: string;
    private _clientPathToWebkitUrl = new Map<string, string>();
    private _webkitUrlToClientPath = new Map<string, string>();
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    private inferedDeviceRoot :string = null;

    public launch(args: ILaunchRequestArgs): Promise<void> {
        this._appRoot = args.appRoot;
        this._platform = args.platform;
        this.inferedDeviceRoot = (this._platform === 'ios') ? 'file://' : this.inferedDeviceRoot;
        return Promise.resolve();
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        this._appRoot = args.appRoot;
        this._platform = args.platform;
        return Promise.resolve();
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!args.source.path) {
                resolve();
                return;
            }

            if (utils.isURL(args.source.path)) {
                // already a url, use as-is
                Services.logger().log(`Paths.setBP: ${args.source.path} is already a URL`);
                resolve();
                return;
            }

            const url = utils.canonicalizeUrl(args.source.path);
            if (this._clientPathToWebkitUrl.has(url)) {
                args.source.path = this._clientPathToWebkitUrl.get(url);
                Services.logger().log(`Paths.setBP: Resolved ${url} to ${args.source.path}`);
                resolve();
            }
            else if (this.inferedDeviceRoot) {
                let inferedUrl = url.replace(this._appRoot, this.inferedDeviceRoot).replace(/\\/g, "/");
                inferedUrl = inferedUrl.replace("/node_modules/", "/app/tns_modules/");

                //change platform specific paths
                inferedUrl = inferedUrl.replace(`.${this._platform}.`, '.');

                args.source.path = inferedUrl;
                Services.logger().log(`Paths.setBP: Resolved (by infering) ${url} to ${args.source.path}`);
                resolve();
            }
            else {
                Services.logger().log(`Paths.setBP: No target url cached for client path: ${url}, waiting for target script to be loaded.`);
                args.source.path = url;
                this._pendingBreakpointsByPath.set(args.source.path, { resolve, reject, args });
            }
        });
    }

    public clearClientContext(): void {
        this._pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    }

    public clearTargetContext(): void {
        this._clientPathToWebkitUrl = new Map<string, string>();
        this._webkitUrlToClientPath = new Map<string, string>();
    }

    public scriptParsed(scriptPath: string): Promise<string> {
        const webkitUrl: string = scriptPath;
        if (!this.inferedDeviceRoot && this._platform === "android")
        {
            this.inferedDeviceRoot = utils.inferDeviceRoot(this._appRoot, this._platform, webkitUrl);
            if (this.inferedDeviceRoot)
            {
                Services.logger().log("\n\n\n ***Inferred device root: " + this.inferedDeviceRoot + "\n\n\n");

                if (this.inferedDeviceRoot.indexOf("/data/user/0/") != -1)
                {
                    this.inferedDeviceRoot = this.inferedDeviceRoot.replace("/data/user/0/", "/data/data/");
                }
            }
        }

        const clientPath = utils.webkitUrlToClientPath(this._appRoot, this._platform, webkitUrl);

        if (!clientPath) {
            Services.logger().log(`Paths.scriptParsed: could not resolve ${webkitUrl} to a file in the workspace. webRoot: ${this._appRoot}`);
        } else {
            Services.logger().log(`Paths.scriptParsed: resolved ${webkitUrl} to ${clientPath}. webRoot: ${this._appRoot}`);
            this._clientPathToWebkitUrl.set(clientPath, webkitUrl);
            this._webkitUrlToClientPath.set(webkitUrl, clientPath);

            scriptPath = clientPath;
        }

        if (this._pendingBreakpointsByPath.has(scriptPath)) {
            Services.logger().log(`Paths.scriptParsed: Resolving pending breakpoints for ${scriptPath}`);
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(scriptPath);
            this._pendingBreakpointsByPath.delete(scriptPath);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }

        return Promise.resolve(scriptPath);
    }

    public stackTraceResponse(response: IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            // Try to resolve the url to a path in the workspace. If it's not in the workspace,
            // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
            if (frame.source && frame.source.path) {
                const clientPath = this._webkitUrlToClientPath.has(frame.source.path) ?
                    this._webkitUrlToClientPath.get(frame.source.path) :
                    utils.webkitUrlToClientPath(this._appRoot, this._platform, frame.source.path);
                // Incoming stackFrames have sourceReference and path set. If the path was resolved to a file in the workspace,
                // clear the sourceReference since it's not needed.
                if (clientPath) {
                    frame.source.path = clientPath;
                    frame.source.sourceReference = 0;
                }
            }
        });
    }
}