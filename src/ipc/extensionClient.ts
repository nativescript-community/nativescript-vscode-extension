import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as extProtocol from './extensionProtocol';
let ipc = require('node-ipc');

export class ExtensionClient {
    private _appRoot: string;
    private _idCounter = 0;
    private _pendingRequests: Object;

    private _ipcClientInitialized: Promise<any>;

    public static getTempFilePathForDirectory(directoryPath: string) {
        let fileName: string = 'vsc-ns-ext-' + crypto.createHash('md5').update(directoryPath).digest("hex") + '.sock';
        return path.join(os.tmpdir(), fileName);
    }

    constructor(appRoot: string) {
        this._appRoot = appRoot;
        this._idCounter = 0;
        this._pendingRequests = {};

        ipc.config.id = 'debug-adpater-' + process.pid;
        ipc.config.retry = 1500;

        this._ipcClientInitialized = new Promise((res, rej) => {
            ipc.connectTo(
                'extHost',
                ExtensionClient.getTempFilePathForDirectory(this._appRoot),
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

    private callRemoteMethod(method: string, args?: Object): Promise<Object> {
        let request: extProtocol.Request = { id: 'req' + (++this._idCounter), method: method, args: args };
        return new Promise<Object>((res, rej) => {
            this._pendingRequests[request.id] = res;
            ipc.of.extHost.emit('extension-protocol-message', request);
        });
    }

    public getInitSettings(): Promise<extProtocol.InitSettingsResult> {
        return this.callRemoteMethod('getInitSettings');
    }

    public analyticsLaunchDebugger(args: extProtocol.AnalyticsLaunchDebuggerArgs): Promise<any> {
        return this.callRemoteMethod('analyticsLaunchDebugger', args);
    }

    public runRunCommand(args: extProtocol.AnalyticsRunRunCommandArgs): Promise<any> {
        return this.callRemoteMethod('runRunCommand', args);
    }

    public selectTeam(): Promise<{ id: string, name: string }> {
        return this.callRemoteMethod('selectTeam');
    }
}