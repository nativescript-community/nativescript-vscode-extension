import * as http from 'http';
import {EventEmitter} from 'events';
import * as utils from '../../webkit/utilities';
import {Logger} from '../../webkit/utilities';
import * as Net from 'net';
import * as ns from '../NativeScript'


interface IMessageWithId {
    id: number;
    method: string;
    params?: string[];
}

class Callbacks {
    private lastId: number = 1;
    private callbacks: any = {};

    public wrap(callback: any): number {
        var callbackId = this.lastId++;
        this.callbacks[callbackId] = callback || function() { };
        return callbackId;
    }

    public processResponse(callbackId: any, args: any) {

        var callback = this.callbacks[callbackId];

        if (callback) {
            callback.apply(null, args);
        }

        delete this.callbacks[callbackId];
    }

    public removeResponseCallbackEntry(callbackId: any) {
        delete this.callbacks[callbackId];
    }

}


class ResReqNetSocket extends EventEmitter {
    private _pendingRequests = new Map<number, any>();

    private connected = false;
    private debugBuffer: any = '';
    private msg: any = false;
    private conn: Net.Socket;
    private offset: number;
    private contentLengthMatch: any;
    private lastError: string;
    private callbacks: Callbacks;
    private isRunning: boolean;

    public attach(port: number, timeout: number = 10000) {
        var that = this;
        this.callbacks = new Callbacks();

        return new Promise<void>((resolve, reject) => {

            that.conn = Net.createConnection(port),
            that.conn.setEncoding('utf8');

            setTimeout(() => {
                reject('Connection timed out')
            }, timeout);

            that.conn.on('error', reject);

            that.conn.on('connect', function() {

                // Replace the promise-rejecting handler
                that.conn.removeListener('error', reject);

                that.conn.on('error', e => {
                    Logger.log('socket error: ' + e.toString());

                    if (e.code == 'ECONNREFUSED') {
                        e.helpString = 'Is node running with --debug port ' + port + '?';
                    } else if (e.code == 'ECONNRESET') {
                        e.helpString = 'Check there is no other debugger client attached to port ' + port + '.';
                    }

                    that.lastError = e.toString();
                    if (e.helpString) {
                        that.lastError += '. ' + e.helpString;
                    }


                    that.emit('error', e);
                });

                that.conn.on('data', function(data) {
                    that.debugBuffer += data;
                    that.parse();
                });


                that.conn.on('end', function() {
                    that.close();
                });

                that.conn.on('close', function() {
                    that.connected = false;
                    that.emit('close', that.lastError || 'Debugged process exited.');
                });

                that.connected = true;
                resolve();
            });
        });
    }

    private makeMessage() {
        return {
            headersDone: false,
            headers: null,
            contentLength: 0
        };
    }

    private parse() {
        var b, obj;
        if (this.msg && this.msg.headersDone) {
            //parse body
            if (Buffer.byteLength(this.debugBuffer) >= this.msg.contentLength) {
                b = new Buffer(this.debugBuffer);
                this.msg.body = b.toString('utf8', 0, this.msg.contentLength);
                this.debugBuffer = b.toString('utf8', this.msg.contentLength, b.length);
                if (this.msg.body.length > 0) {
                    obj = JSON.parse(this.msg.body);
                    if (typeof obj.running === 'boolean') {
                        this.isRunning = obj.running;
                    }
                    if (obj.type === 'response' && obj.request_seq > 0) {
                        console.log('response: ' + this.msg.body);
                        this.callbacks.processResponse(obj.request_seq, [obj]);
                    }
                    else if (obj.type === 'event') {
                        //debugProtocol('event: ' + msg.body);
                        console.log('event: ' + obj.event + " obj: " + JSON.stringify(obj));
                        this.emit(obj.event, obj);
                    }
                    else {
                        console.log('unknown: ' + this.msg.body);
                    }
                }
                this.msg = false;
                this.parse();
            }
            return;
        }

        if (!this.msg) {
            this.msg = this.makeMessage();
        }

        this.offset = this.debugBuffer.indexOf('\r\n\r\n');
        if (this.offset > 0) {
            this.msg.headersDone = true;
            this.msg.headers = this.debugBuffer.substr(0, this.offset + 4);
            this.contentLengthMatch = /Content-Length: (\d+)/.exec(this.msg.headers);
            if (this.contentLengthMatch[1]) {
                this.msg.contentLength = parseInt(this.contentLengthMatch[1], 10);
            }
            else {
                console.warn('no Content-Length');
            }
            this.debugBuffer = this.debugBuffer.slice(this.offset + 4);
            this.parse();
        }
    }

    public send(data) {
        if (this.connected) {
            this.conn.write('Content-Length: ' + data.length + '\r\n\r\n' + data);
        }
    }

    public request(command, params, callback) {
        var msg = {
            seq: 0,
            type: 'request',
            command: command
        };

        if (typeof callback == 'function') {
            msg.seq = this.callbacks.wrap(callback);
        }

        if (params) {
            Object.keys(params).forEach(function(key) {
                msg[key] = params[key];
            });
        }
        this.send(JSON.stringify(msg));
    }

    public close() {
        this.conn.end();
    }
}


export class AndroidDebugConnection implements ns.INSDebugConnection {
    private _nextId = 1;
    //private _socket: ResReqWebSocket;
    //private _socket: ResReqHttpSocket;
    private _socket: ResReqNetSocket;

    constructor() {
        //this._socket = new ResReqWebSocket();
        let that = this;
        this._socket = new ResReqNetSocket();

        this._socket.on("afterCompile", function(params) {

            let scriptData = <WebKitProtocol.Debugger.Script>{
                scriptId: String(params.body.script.id),
                url: params.body.script.name,
                startLine: params.body.script.lineOffset,
                startColumn: params.body.script.columnOffset
            };

            that._socket.emit("Debugger.scriptParsed", scriptData);
        });


        this._socket.on("break", function(params) {
            //send backtrace request and then populate the callstacks as in
            //CallFramesProvider.fetchCallFrames
            that.handleBreakEvent(params);
        });

         this._socket.on("messageAdded", function(params) {
            that._socket.emit("Console.messageAdded", params.body);
        });
    }

    private handleBreakEvent(params: any): Promise<any> {
        let that = this;
        return this.fetchCallFrames().then(callFrames => {
            let scriptData = <WebKitProtocol.Debugger.PausedParams>{
                reason: "other",
                hitBreakpoints: params ? (params.breakpoints || []) : [],
                callFrames: callFrames
            };

            that._socket.emit("Debugger.paused", scriptData);
        });
    }

    private v8ScopeTypeToString(v8ScopeType: number): string {
        switch (v8ScopeType) {
            case 0:
                return 'global';
            case 1:
                return 'local';
            case 2:
                return 'with';
            case 3:
                return 'closure';
            case 4:
                return 'catch';
            default:
                return 'unknown';
        }
    }

    private v8ResultToInspectorResult(result: any): any {
        if (['object', 'function', 'regexp', 'error'].indexOf(result.type) > -1) {
            return this.v8RefToInspectorObject(result);
        }

        if (result.type == 'null') {
            // workaround for the problem with front-end's setVariableValue
            // implementation not preserving null type
            result.value = null;
        }

        return {
            type: result.type,
            value: result.value,
            description: String(result.value)
        };
    }

    private inspectorUrlToV8Name(url: string): string {
        let path = url.replace(/^file:\/\//, '');
        if (/^\/[a-zA-Z]:\//.test(path))
            return path.substring(1).replace(/\//g, '\\'); // Windows disk path
        if (/^\//.test(path))
            return path; // UNIX-style
        if (/^file:\/\//.test(url))
            return '\\\\' + path.replace(/\//g, '\\'); // Windows UNC path

        return url;
    };

    private v8LocationToInspectorLocation(v8loc: any): any {
        return {
            scriptId: v8loc.script_id.toString(),
            lineNumber: v8loc.line,
            columnNumber: v8loc.column
        };
    };

    private v8RefToInspectorObject(ref: any): any {
        var desc = '',
            type = ref.type,
            size,
            name,
            objectId;

        switch (type) {
            case 'object':
                name = /#<(\w+)>/.exec(ref.text);
                if (name && name.length > 1) {
                    desc = name[1];
                    if (desc === 'Array' || desc === 'Buffer') {
                        size = ref.properties.filter(function(p) { return /^\d+$/.test(p.name); }).length;
                        desc += '[' + size + ']';
                    }
                } else if (ref.className === 'Date') {
                    desc = new Date(ref.value).toString();
                    type = 'date';
                } else {
                    desc = ref.className || 'Object';
                }
                break;
            case 'function':
                desc = ref.text || 'function()';
                break;
            case 'error':
                type = 'object';
                desc = ref.text || 'Error';
                break;
            default:
                desc = ref.text || '';
                break;
        }
        if (desc.length > 100) {
            desc = desc.substring(0, 100) + '\u2026';
        }

        objectId = ref.handle;
        if (objectId === undefined)
            objectId = ref.ref;

        return {
            type: type,
            objectId: String(objectId),
            className: ref.className,
            description: desc
        };
    }

    private v8ErrorToInspectorError(message: any) {
        var nameMatch = /^([^:]+):/.exec(message);
        return {
            type: 'object',
            objectId: 'ERROR',
            className: nameMatch ? nameMatch[1] : 'Error',
            description: message
        };
    };

    private fetchCallFrames(): Promise<any> {

        let that = this;
        return this.request("backtrace",
            {
                inlineRefs: true,
                fromFrame: 0,
                toFrame: 50
            })
            .then(response => {
                var debuggerFrames = <Array<any>>response.frames || [];
                let frames = debuggerFrames.map(function(frame) {
                    var scopeChain = frame.scopes.map(function(scope) {
                        return {
                            object: {
                                type: 'object',
                                objectId: 'scope:' + frame.index + ':' + scope.index,
                                className: 'Object',
                                description: 'Object'
                            },
                            type: that.v8ScopeTypeToString(scope.type)
                        };
                    });


                    return {
                        callFrameId: frame.index.toString(),
                        functionName: frame.func.inferredName || frame.func.name,
                        location: {
                            scriptId: String(frame.func.scriptId),
                            lineNumber: frame.line,
                            columnNumber: frame.column
                        },
                        scopeChain: scopeChain,
                        this: that.v8RefToInspectorObject(frame.receiver)
                    }
                });

                return frames;
            });
    }



    public on(eventName: string, handler: (msg: any) => void): void {
        this._socket.on(eventName, handler);
    }

    public attach(port: number, url?: string): Promise<void> {
        Logger.log('Attempting to attach on port ' + port);
        return this._attach(port, url);
        //.then(() => this.sendMessage('Console.enable'))
    }

    private _attach(port: number, url?: string): Promise<void> {
        return this._socket.attach(port);
    }

    public close(): void {
        this._socket.close();
    }

    public debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse> {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.setBreakpointByUrl', <WebKitProtocol.Debugger.SetBreakpointByUrlParams>{ url, lineNumber, columnNumber });

        let that = this;
        var requestParams = {
            type: 'script',
            target: that.inspectorUrlToV8Name(url),
            line: lineNumber,
            column: columnNumber
        };

        return this.request("setbreakpoint", requestParams)
            .then(response => {
                return <WebKitProtocol.Debugger.SetBreakpointByUrlResponse>
                    {
                        result: {
                            breakpointId: response.breakpoint.toString(),
                            locations: response.actual_locations.map(that.v8LocationToInspectorLocation),
                        },
                    }
            });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response> {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.removeBreakpoint', <WebKitProtocol.Debugger.RemoveBreakpointParams>{ breakpointId });

        //ok

        return this.request("clearbreakpoint", {
            breakpoint: breakpointId
            })
            .then(response => {
                return <WebKitProtocol.Response>{};
            });
    }

    public debugger_stepOver(): Promise<WebKitProtocol.Response> {
        //throw new Error("Not implemented");
        //return this.sendMessage('Debugger.stepOver');


        //locations: response.actual_locations.map(that.v8LocationToInspectorLocation)

        return this.sendContinue('next').then(reponse => {
            return <WebKitProtocol.Response>{};
        });

        //ok
    }

    private sendContinue(stepAction: string): Promise<any> {
        let that = this;
        let args = stepAction ? { stepaction: stepAction } : undefined;
        return this.request("continue", args).then(response => {
            that._socket.emit("'Debugger.resumed");
            return response;
        })
    }

    public debugger_stepIn(): Promise<WebKitProtocol.Response> {

        //return this.sendMessage('Debugger.stepInto');
        //throw new Error("Not implemented");

        //ok
        return this.sendContinue('in').then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_stepOut(): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Debugger.stepOut');
        //throw new Error("Not implemented");

        //ok
        return this.sendContinue('out').then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_resume(): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Debugger.resume');
        //throw new Error("Not implemented");

        //ok
        return this.sendContinue(null).then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_pause(): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Debugger.pause');
        //throw new Error("Not implemented");

        //ok
        let that = this;
        return this.request("suspend", {})
            .then(reponse => that.handleBreakEvent(null));
        // .then(reponse => {
        //     return <WebKitProtocol.Response>{};
        // });
    }

    public debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup = 'dummyObjectGroup', returnByValue?: boolean): Promise<WebKitProtocol.Debugger.EvaluateOnCallFrameResponse> {
        //return this.sendMessage('Debugger.evaluateOnCallFrame', <WebKitProtocol.Debugger.EvaluateOnCallFrameParams>{ callFrameId, expression, objectGroup, returnByValue });
        //throw new Error("Not implemented");

        var requestParams = {
            expression: expression,
            frame: callFrameId
        };


        let messageId = this._nextId++;
        let that = this;
        return this.request("evaluate", requestParams).then(response => {
            return <WebKitProtocol.Debugger.EvaluateOnCallFrameResponse>{
              result: {
                    result : that.v8ResultToInspectorResult(response),
                    wasThrown : false
                }
            }
        });
    }

    public debugger_setPauseOnExceptions(state: string): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Debugger.setPauseOnExceptions', <WebKitProtocol.Debugger.SetPauseOnExceptionsParams>{ state });

        var requestParams = {
            type: state,
            enabled: state !== 'none'
        };

        let messageId = this._nextId++;
        return this.request("setexceptionbreak", requestParams).then(response => {
            return new Promise((resolve, reject) => {
                if (response.error) {
                    reject(response.error);
                    return;
                }
                resolve(<WebKitProtocol.Response>{ id: messageId });
            });
        });
    }

    public debugger_getScriptSource(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<WebKitProtocol.Debugger.GetScriptSourceResponse> {

        //return this.sendMessage('Debugger.getScriptSource', //<WebKitProtocol.Debugger.GetScriptSourceParams>{ scriptId });

        var requestParams = {
            includeSource: true,
            types: 4,
            ids: [Number(scriptId)]
        };

        let messageId = this._nextId++;
        return this.request("scripts", requestParams).then(response => {
            return new Promise((resolve, reject) => {
                if (response.error) {
                    reject(response.error);
                    return;
                }

                let source = undefined;
                if (response.result)
                {
                    source = response.result[0].source;
                }
                else if (response.source) {
                    source = response.source;
                }


                let result = <WebKitProtocol.Debugger.GetScriptSourceResponse>{
                    id: messageId,
                    result: {
                        scriptSource: source
                    }
                }

                resolve(result);
            });
        });
    }

    private request(command, args): Promise<any> {

        return new Promise((resolve, reject) => {
            this._socket.request(command, { arguments: args }, response => {
                if (!response.success) {
                    reject(new Error(response.message));
                    return;
                }


                if (response.refs) {

                    let refsLookup = {};
                    response.refs.forEach(function(r) { refsLookup[r.handle] = r; });

                    //TODO: response.body may be undefined in that case set it to {} here
                    response.body.refsLookup = refsLookup;
                }

                resolve(response.body);
            });
        });
    }


    ////getProperties Functions. Implementation in RuntimeAgent.js
    public runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<WebKitProtocol.Runtime.GetPropertiesResponse> {

        //return this.sendMessage('Runtime.getProperties', <WebKitProtocol.Runtime.GetPropertiesParams>{ objectId, ownProperties, accessorPropertiesOnly });
        //throw new Error("Not implemented");


        return this.isScopeId(objectId).then(response => {
            if (response) {
                return this.getPropertiesOfScopeId(objectId);
            }
            else {
                if (!ownProperties || accessorPropertiesOnly) {
                    // Temporary fix for missing getInternalProperties() implementation
                    // See the comment in RuntimeAgent.js->getProperties and GH issue #213 (node-inspector repo)
                    return { result: [] };
                }

                return this.getPropertiesOfObjectId(objectId);
            }
        }).then(response => {
            let properties = response.result;
            let result = [];
            for (var i = 0; properties && i < properties.length; ++i) {
                let property = properties[i];
                //convert the result to <WebKitProtocol.Runtime.PropertyDescriptor>
                result.push({
                    name: property.name,
                    writeable: property.writable,
                    enumerable: property.enumerable,
                    value: property.value
                });
            }

            return <WebKitProtocol.Runtime.GetPropertiesResponse>{
                result: {
                    result: result
                }
            };
        });
    }

    private isScopeId(objectId: string): Promise<boolean> {
        let SCOPE_ID_MATCHER = /^scope:(\d+):(\d+)$/;
        return Promise.resolve(SCOPE_ID_MATCHER.test(objectId))
    }

    private getPropertiesOfScopeId(scopeId: string): Promise<any> {

        let SCOPE_ID_MATCHER = /^scope:(\d+):(\d+)$/;
        let scopeIdMatch = SCOPE_ID_MATCHER.exec(scopeId);

        if (!scopeIdMatch) {
            return Promise.reject(new Error('Invalid scope id "' + scopeId + '"'));
        }
        let that = this;
        return this.request("scope",
            {
                number: Number(scopeIdMatch[2]),
                frameNumber: Number(scopeIdMatch[1])
            })
            .then(response => {
                return response.object.ref;
            }).then(response => {
                return that.getPropertiesOfObjectId(response);
            });
    };

    private getPropertiesOfObjectId(objectId: string): Promise<any> {
        let handle = parseInt(objectId, 10);
        let request = { handles: [handle], includeSource: false };
        let that = this;
        return this.request("lookup", request)
            .then(response => {
                let obj;
                let proto;
                let props;

                obj = response[handle];
                proto = obj.proto;
                props = obj.properties;

                if (props) {
                    props = props.map(function(p) {
                        var ref = response.refsLookup[p.ref];
                        return {
                            name: String(p.name),
                            writable: (p.attributes & 1) != 1,
                            enumerable: (p.attributes & 2) != 2,
                            value: that.v8ResultToInspectorResult(ref)
                        };
                    });
                }

                if (proto)
                    props.push({
                        name: '__proto__',
                        value: that.v8RefToInspectorObject(response.refsLookup[proto.ref])
                    });

                return { result: props };
            });
    }

    ////getProperties Functions END

    public runtime_evaluate(expression: string, objectGroup = 'dummyObjectGroup', contextId?: number, returnByValue = false): Promise<WebKitProtocol.Runtime.EvaluateResponse> {
        //return this.sendMessage('Runtime.evaluate', <WebKitProtocol.Runtime.EvaluateParams>{ expression, objectGroup, contextId, returnByValue });
        throw new Error("Not implemented");
    }

    public page_setOverlayMessage(message: string): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Page.setOverlayMessage', { message });
        //throw new Error("Not implemented");
        return Promise.resolve();
    }

    public page_clearOverlayMessage(): Promise<WebKitProtocol.Response> {
        //return this.sendMessage('Page.setOverlayMessage');
        //throw new Error("Not implemented");
        return Promise.resolve();
    }

    // private sendMessage(method: any, params?: any): Promise<WebKitProtocol.Response> {
    //     return this._socket.sendMessage({
    //         id: this._nextId++,
    //         method,
    //         params
    //     });
    // }
}

/**
 * Helper function to GET the contents of a url
 */
function getUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            let jsonResponse = '';
            response.on('data', chunk => jsonResponse += chunk);
            response.on('end', () => {
                resolve(jsonResponse);
            });
        }).on('error', e => {
            reject('Cannot connect to the target: ' + e.message);
        });
    });
}
