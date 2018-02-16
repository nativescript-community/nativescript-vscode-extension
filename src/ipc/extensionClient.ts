import * as extProtocol from './extensionProtocol';
import {Services} from "../services/debugAdapterServices";
import {getSocketId} from "./sockedId";

const ipc = require('node-ipc');

export class ExtensionClient {
    private _appRoot: string;
    private _idCounter = 0;
    private _pendingRequests: Object;
    private _socketId: string;

    private _ipcClientInitialized: Promise<any>;

    constructor(appRoot: string) {
        this._appRoot = appRoot;
        this._idCounter = 0;
        this._pendingRequests = {};

        this._socketId = getSocketId();

        ipc.config.id = 'debug-adapter-' + process.pid;
        ipc.config.retry = 1500;
        ipc.config.maxRetries = 5;

        this._ipcClientInitialized = new Promise((res, rej) => {
            ipc.connectTo(
                this._socketId,
                () => {
                    ipc.of[this._socketId].on('connect', () => {
                        res();
                    });

                    ipc.of[this._socketId].on('error', error => {
                        Services.logger().log(`[ExtensionClient] error: ${JSON.stringify(error)}\n`);
                    });

                    ipc.of[this._socketId].on('extension-protocol-message', (response: extProtocol.Response) => {
                        (<(result: Object) => void>this._pendingRequests[response.requestId])(response.result);
                    });
                }
            );
        });
    }

    private callRemoteMethod(method: string, args?: Object): Promise<Object> {
        let request: extProtocol.Request = {id: 'req' + (++this._idCounter), method: method, args: args};
        return new Promise<Object>((res, rej) => {
            this._pendingRequests[request.id] = res;
            ipc.of[this._socketId].emit('extension-protocol-message', request);
        });
    }

    public getInitSettings(): Promise<extProtocol.InitSettingsResult> {
        return <Promise<extProtocol.InitSettingsResult>>(this.callRemoteMethod('getInitSettings'));
    }

    public analyticsLaunchDebugger(args: extProtocol.AnalyticsLaunchDebuggerArgs): Promise<any> {
        return this.callRemoteMethod('analyticsLaunchDebugger', args);
    }

    public runRunCommand(args: extProtocol.AnalyticsRunRunCommandArgs): Promise<any> {
        return this.callRemoteMethod('runRunCommand', args);
    }

    public selectTeam(): Promise<{ id: string, name: string }> {
        return <Promise<{ id: string, name: string }>>(this.callRemoteMethod('selectTeam'));
    }
}