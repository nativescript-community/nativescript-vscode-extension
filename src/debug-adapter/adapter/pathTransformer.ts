/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as utils from '../utilities';
import {Logger} from '../../services/Logger';
import {DebugProtocol} from 'vscode-debugprotocol';
import * as path from 'path';

interface IPendingBreakpoint {
    resolve: () => void;
    reject: (e: Error) => void;
    args: DebugProtocol.ISetBreakpointsArgs;
}

/**
 * Converts a local path from Code to a path on the target.
 */
export class PathTransformer implements DebugProtocol.IDebugTransformer {
    private _webRoot: string;
    private _platform: string;
    private _clientPathToWebkitUrl = new Map<string, string>();
    private _webkitUrlToClientPath = new Map<string, string>();
    private _pendingBreakpointsByPath = new Map<string, IPendingBreakpoint>();
    private inferedDeviceRoot :string = null;

    public launch(args: DebugProtocol.ILaunchRequestArgs): void {
        this._webRoot = utils.getAppRoot(args);
        this._platform = args.platform;
        this.inferedDeviceRoot = (this._platform === 'ios') ? 'file://' : this.inferedDeviceRoot;
    }

    public attach(args: DebugProtocol.IAttachRequestArgs): void {
        this._webRoot = utils.getAppRoot(args);
        this._platform = args.platform;
    }

    public setBreakpoints(args: DebugProtocol.ISetBreakpointsArgs): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!args.source.path) {
                resolve();
                return;
            }

            if (utils.isURL(args.source.path)) {
                // already a url, use as-is
                Logger.log(`Paths.setBP: ${args.source.path} is already a URL`);
                resolve();
                return;
            }

            const url = utils.canonicalizeUrl(args.source.path);
            if (this._clientPathToWebkitUrl.has(url)) {
                args.source.path = this._clientPathToWebkitUrl.get(url);
                Logger.log(`Paths.setBP: Resolved ${url} to ${args.source.path}`);
                resolve();
            }
            else if (this.inferedDeviceRoot) {
                let inferedUrl = url.replace(this._webRoot, this.inferedDeviceRoot).replace(/\\/g, "/");

                //change device path if {N} core module or {N} module
                if (inferedUrl.indexOf("/node_modules/tns-core-modules/") != -1)
                {
                    inferedUrl = inferedUrl.replace("/node_modules/tns-core-modules/", "/app/tns_modules/");
                }
                else if (inferedUrl.indexOf("/node_modules/") != -1)
                {
                    inferedUrl = inferedUrl.replace("/node_modules/", "/app/tns_modules/");
                }

                //change platform specific paths
                inferedUrl = inferedUrl.replace(`.${this._platform}.`, '.');

                args.source.path = inferedUrl;
                Logger.log(`Paths.setBP: Resolved (by infering) ${url} to ${args.source.path}`);
                resolve();
            }
            else {
                Logger.log(`Paths.setBP: No target url cached for client path: ${url}, waiting for target script to be loaded.`);
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

    public scriptParsed(event: DebugProtocol.Event): void {
        const webkitUrl: string = event.body.scriptUrl;
        if (!this.inferedDeviceRoot && this._platform === "android")
        {
            this.inferedDeviceRoot = utils.inferDeviceRoot(this._webRoot, this._platform, webkitUrl);
             Logger.log("\n\n\n ***Inferred device root: " + this.inferedDeviceRoot + "\n\n\n");

            if (this.inferedDeviceRoot.indexOf("/data/user/0/") != -1)
            {
                this.inferedDeviceRoot = this.inferedDeviceRoot.replace("/data/user/0/", "/data/data/");
            }
        }

        const clientPath = utils.webkitUrlToClientPath(this._webRoot, this._platform, webkitUrl);

        if (!clientPath) {
            Logger.log(`Paths.scriptParsed: could not resolve ${webkitUrl} to a file in the workspace. webRoot: ${this._webRoot}`);
        } else {
            Logger.log(`Paths.scriptParsed: resolved ${webkitUrl} to ${clientPath}. webRoot: ${this._webRoot}`);
            this._clientPathToWebkitUrl.set(clientPath, webkitUrl);
            this._webkitUrlToClientPath.set(webkitUrl, clientPath);

            event.body.scriptUrl = clientPath;
        }

        if (this._pendingBreakpointsByPath.has(event.body.scriptUrl)) {
            Logger.log(`Paths.scriptParsed: Resolving pending breakpoints for ${event.body.scriptUrl}`);
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(event.body.scriptUrl);
            this._pendingBreakpointsByPath.delete(event.body.scriptUrl);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }
    }

    public stackTraceResponse(response: DebugProtocol.IStackTraceResponseBody): void {
        response.stackFrames.forEach(frame => {
            // Try to resolve the url to a path in the workspace. If it's not in the workspace,
            // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
            if (frame.source && frame.source.path) {
                const clientPath = this._webkitUrlToClientPath.has(frame.source.path) ?
                    this._webkitUrlToClientPath.get(frame.source.path) :
                    utils.webkitUrlToClientPath(this._webRoot, this._platform, frame.source.path);
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