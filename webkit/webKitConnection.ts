/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as net from 'net';
import * as stream from 'stream';
import {EventEmitter} from 'events';
import * as utils from './utilities';
import {Logger} from './utilities';

interface IMessageWithId {
    id: number;
    method: string;
    params?: string[];
}

export class PacketStream extends stream.Transform {
	private buffer: Buffer;
	private offset: number;

	constructor(opts?: stream.TransformOptions) {
		super(opts);
	}

	public _transform(packet: any, encoding: string, done: Function): void {
		while (packet.length > 0) {
			if (!this.buffer) {
				// read length
				let length = packet.readInt32BE(0);
				this.buffer = new Buffer(length);
				this.offset = 0;
				packet = packet.slice(4);
			}

			packet.copy(this.buffer, this.offset);
			let copied = Math.min(this.buffer.length - this.offset, packet.length);
			this.offset += copied;
			packet = packet.slice(copied);

			if (this.offset === this.buffer.length) {
				this.push(this.buffer);
				this.buffer = undefined;
			}
		}
		done();
	}
}

/**
 * Implements a Request/Response API on top of a TCP Socket for messages that are marked with an `id` property.
 * Emits `message.method` for messages that don't have `id`.
 */
class ResReqTcpSocket extends EventEmitter {
    private _pendingRequests = new Map<number, any>();
    private _tcpSocketAttached: Promise<net.Socket>;

    /**
     * Attach to the given port and host
     */
    public attach(port: number, host?: string): Promise<void> {
        this._tcpSocketAttached = new Promise((resolve, reject) => {

            let tcp: net.Socket;
            try {
                tcp = net.connect(port);
                tcp.on('connect', () => {
                    resolve(tcp);
                });

                tcp.on('close', () => {
                    Logger.log('TCP socket closed');
                    this.emit('close');
                });

                let packetsStream = new PacketStream();
                tcp.pipe(packetsStream);

                packetsStream.on('data', (buffer: Buffer) => {
                    let packet = buffer.toString('utf16le');
                    Logger.log('From target: ' + packet);
                    this.onMessage(JSON.parse(packet));
                });
            } catch (e) {
                // invalid url e.g.
                reject(e.message);
                return;
            }
        });

        return <Promise<void>><any>this._tcpSocketAttached;
    }

    public close(): void {
        if (this._tcpSocketAttached) {
            this._tcpSocketAttached.then(tcpSocket => tcpSocket.destroy());
        }
    }

    /**
     * Send a message which must have an id. Ok to call immediately after attach. Messages will be queued until
     * the websocket actually attaches.
     */
    public sendMessage(message: IMessageWithId): Promise<any> {
        return new Promise((resolve, reject) => {
            this._pendingRequests.set(message.id, resolve);
            this._tcpSocketAttached.then(tcpSocket => {
                const msgStr = JSON.stringify(message);
                Logger.log('To target: ' + msgStr);
                let encoding = "utf16le";
                let length = Buffer.byteLength(msgStr, encoding);
				let payload = new Buffer(length + 4);
				payload.writeInt32BE(length, 0);
				payload.write(msgStr, 4, length, encoding);
                tcpSocket.write(payload);
            });
        });
    }

    private onMessage(message: any): void {
        if (message.id) {
            if (this._pendingRequests.has(message.id)) {
                // Resolve the pending request with this response
                this._pendingRequests.get(message.id)(message);
                this._pendingRequests.delete(message.id);
            } else {
                console.error(`Got a response with id ${message.id} for which there is no pending request, weird.`);
            }
        } else if (message.method) {
            this.emit(message.method, message.params);
        }
    }
}

/**
 * Connects to a target supporting the webkit protocol and sends and receives messages
 */
export class WebKitConnection implements INSDebugConnection {
    private _nextId = 1;
    private _socket: ResReqTcpSocket;

    constructor() {
        this._socket = new ResReqTcpSocket();
    }

    public on(eventName: string, handler: (msg: any) => void): void {
        this._socket.on(eventName, handler);
    }

    /**
     * Attach the websocket to the first available tab in the chrome instance with the given remote debugging port number.
     */
    public attach(port: number, host?: string): Promise<void> {
        Logger.log('Attempting to attach on port ' + port);
        return utils.retryAsync(() => this._attach(port, host), 6000)
            .then(() => this.sendMessage('Debugger.enable'))
            .then(() => this.sendMessage('Console.enable'))
            .then(() => { });
    }

    public _attach(port: number, host?: string): Promise<void> {
        return this._socket.attach(port, host);
    }

    public close(): void {
        this._socket.close();
    }

    public debugger_setBreakpoint(location: WebKitProtocol.Debugger.Location, condition?: string): Promise<WebKitProtocol.Debugger.SetBreakpointResponse> {
        return this.sendMessage('Debugger.setBreakpoint', <WebKitProtocol.Debugger.SetBreakpointParams>{ location, condition });
    }

    public debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse> {
        return this.sendMessage('Debugger.setBreakpointByUrl', <WebKitProtocol.Debugger.SetBreakpointByUrlParams>{ url, lineNumber, columnNumber: 0 /* a columnNumber different from 0 confuses the debugger */ });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.removeBreakpoint', <WebKitProtocol.Debugger.RemoveBreakpointParams>{ breakpointId });
    }

    public debugger_stepOver(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepOver');
    }

    public debugger_stepIn(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepInto');
    }

    public debugger_stepOut(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.stepOut');
    }

    public debugger_resume(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.resume');
    }

    public debugger_pause(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.pause');
    }

    public debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup = 'dummyObjectGroup', returnByValue?: boolean): Promise<WebKitProtocol.Debugger.EvaluateOnCallFrameResponse> {
        return this.sendMessage('Debugger.evaluateOnCallFrame', <WebKitProtocol.Debugger.EvaluateOnCallFrameParams>{ callFrameId, expression, objectGroup, returnByValue });
    }

    public debugger_setPauseOnExceptions(state: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Debugger.setPauseOnExceptions', <WebKitProtocol.Debugger.SetPauseOnExceptionsParams>{ state });
    }

    public debugger_getScriptSource(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<WebKitProtocol.Debugger.GetScriptSourceResponse> {
        return this.sendMessage('Debugger.getScriptSource', <WebKitProtocol.Debugger.GetScriptSourceParams>{ scriptId });
    }

    public runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<WebKitProtocol.Runtime.GetPropertiesResponse> {
        return this.sendMessage('Runtime.getProperties', <WebKitProtocol.Runtime.GetPropertiesParams>{ objectId, ownProperties, accessorPropertiesOnly });
    }

    public runtime_evaluate(expression: string, objectGroup = 'dummyObjectGroup', contextId?: number, returnByValue = false): Promise<WebKitProtocol.Runtime.EvaluateResponse> {
        return this.sendMessage('Runtime.evaluate', <WebKitProtocol.Runtime.EvaluateParams>{ expression, objectGroup, contextId, returnByValue });
    }

    public page_setOverlayMessage(message: string): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Page.setOverlayMessage', { message });
    }

    public page_clearOverlayMessage(): Promise<WebKitProtocol.Response> {
        return this.sendMessage('Page.setOverlayMessage');
    }

    private sendMessage(method: any, params?: any): Promise<WebKitProtocol.Response> {
        return this._socket.sendMessage({
            id: this._nextId++,
            method,
            params
        });
    }
}
