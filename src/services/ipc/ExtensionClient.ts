import * as path from 'path';
import * as extProtocol from './ExtensionProtocol';
let ipc = require('node-ipc');

export class ExtensionClient {
    private static _appRoot: string;
    private static _instance: ExtensionClient;

    private _idCounter = 0;
    private _pendingRequests: Object;

    private _ipcClientInitialized: Promise<any>;

    public static getInstance() {
        if (!this._instance) {
            this._instance = new ExtensionClient();
        }
        return this._instance;
    }

    public static getAppRoot() {
        return this._appRoot;
    }

    public static setAppRoot(appRoot: string) {
        this._appRoot = appRoot;
    }

    constructor() {
        if (!ExtensionClient.getAppRoot()) {
            throw new Error(`Unable to connect to extension host. App root is '${ExtensionClient.getAppRoot()}'`);
        }

        this._idCounter = 0;
        this._pendingRequests = {};

        ipc.config.id = 'debug-adpater-' + process.pid;
        ipc.config.retry = 1500;

        this._ipcClientInitialized = new Promise((res, rej) => {
            ipc.connectTo(
                'extHost',
                path.join(ExtensionClient.getAppRoot(), 'temp-nativescript-vscode-extension-pipe-handle'),
                () => {
                    ipc.of.extHost.on('connect', () => {
                        res();
                    });
                    ipc.of.extHost.on('extension-protocol-message', (response: extProtocol.Response) => {
                        (<(result: Object) => void>this._pendingRequests[response.requestId])(response.result);
                    });
                }
            );
        });
    }

    private callRemoteMethod(method: string, args: Object): Promise<Object> {
        let request: extProtocol.Request = { id: 'req' + (++this._idCounter), method: method, args: args };
        return new Promise<Object>((res, rej) => {
            this._pendingRequests[request.id] = res;
            ipc.of.extHost.emit('extension-protocol-message', request);
        });
    }

    public analyticsLaunchDebugger(args: extProtocol.AnalyticsLaunchDebuggerArgs): Promise<any> {
        return this.callRemoteMethod('analyticsLaunchDebugger', args);
    }

    public runRunCommand(args: extProtocol.AnalyticsRunRunCommandArgs): Promise<any> {
        return this.callRemoteMethod('runRunCommand', args);
    }
}