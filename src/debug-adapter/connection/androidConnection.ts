import { Services } from '../../services/debugAdapterServices';
import { INSDebugConnection } from './INSDebugConnection';
import { ChromeConnection } from 'vscode-chrome-debug-core';
import Crdp from 'vscode-chrome-debug-core/lib/crdp/crdp';

export class AndroidConnection implements INSDebugConnection {
    private _chromeConnection: ChromeConnection;

    constructor() {
        this._chromeConnection = new ChromeConnection((address: string, port: number, targetFilter?: any, targetUrl?: string): Promise<string> => Promise.resolve(`ws://${address}:${port}`));
    }

    private get api(): Crdp.CrdpClient {
        return this._chromeConnection.api;
    }

    public on(eventName: string, handler: (msg: any) => void): void {
        let domainMethodPair = eventName.split(".");
        if (domainMethodPair.length == 2)
        {
            let domain = domainMethodPair[0];
            let method = domainMethodPair[1];
            method = "on" + method.charAt(0).toUpperCase() + method.slice(1);
            this.api[domain][method](handler);
        }
        else
        {
            (<any>(this._chromeConnection))._socket.on(eventName, handler);
        }
    }

    public attach(port: number, url?: string): Promise<void> {
        Services.logger().log('Attempting to attach on port ' + port);
        return this._chromeConnection.attach(url, port);
    }

    public enable(): Promise<void> {
        return this.api.Debugger.enable();
    }

    public close(): void {
        this._chromeConnection.close();
    }

    public debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number, condition: string, ignoreCount: number): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse> {
        return this.api.Debugger.setBreakpointByUrl({ urlRegex: url, lineNumber: lineNumber, columnNumber: columnNumber, condition })
            .then(response =>
            {
                return <WebKitProtocol.Debugger.SetBreakpointByUrlResponse>
                    {
                        result: {
                            breakpointId: response.breakpointId.toString(),
                            locations: response.locations
                        },
                    }
            });
    }

    public debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response> {
        return this.api.Debugger.removeBreakpoint({ breakpointId }).then(response => {
                return <WebKitProtocol.Response>{};
            });
    }

    public debugger_stepOver(): Promise<WebKitProtocol.Response> {
        return this.api.Debugger.stepOver().then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_stepIn(): Promise<WebKitProtocol.Response> {
        return this.api.Debugger.stepInto().then(reponse => {
           return <WebKitProtocol.Response>{};
        });
    }

    public debugger_stepOut(): Promise<WebKitProtocol.Response> {
        return this.api.Debugger.stepOut().then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_resume(): Promise<WebKitProtocol.Response> {
         return this.api.Debugger.resume().then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_pause(): Promise<WebKitProtocol.Response> {
        return this.api.Debugger.pause().then(reponse => {
            return <WebKitProtocol.Response>{};
        });
    }

    public debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup = 'dummyObjectGroup', returnByValue?: boolean): Promise<WebKitProtocol.Debugger.EvaluateOnCallFrameResponse> {
         return this.api.Debugger.evaluateOnCallFrame({ callFrameId, expression, silent: true, generatePreview: true }).then(response => {
            return <WebKitProtocol.Debugger.EvaluateOnCallFrameResponse> {
                result: {
                    result: <any>response.result,
                    wasThrown: false
                }
            }
        });
    }

    public debugger_setPauseOnExceptions(args: string): Promise<WebKitProtocol.Response> {
        let state: 'all' | 'uncaught' | 'none';
        if (args.indexOf('all') >= 0) {
            state = 'all';
        } else if (args.indexOf('uncaught') >= 0) {
            state = 'uncaught';
        } else {
            state = 'none';
        }

        return this.api.Debugger.setPauseOnExceptions({ state })
           .then(reponse => {
               return <WebKitProtocol.Response>{} ;
        });
    }

    public debugger_getScriptSource(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<WebKitProtocol.Debugger.GetScriptSourceResponse> {
        return this.api.Debugger.getScriptSource({ scriptId: scriptId }).then(response =>
            {
                return <WebKitProtocol.Debugger.GetScriptSourceResponse>
                    {
                         result: {
                            scriptSource: response.scriptSource
                        }
                    }
            });
    }

    public runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<WebKitProtocol.Runtime.GetPropertiesResponse> {
        return this.api.Runtime.getProperties({objectId, ownProperties, accessorPropertiesOnly, generatePreview: true}).then(response => {
            return <WebKitProtocol.Runtime.GetPropertiesResponse>{
                result: {
                    result: <any>response.result
                }
        }});
    }

    public runtime_evaluate(expression: string, objectGroup = 'dummyObjectGroup', contextId?: number, returnByValue = false): Promise<WebKitProtocol.Runtime.EvaluateResponse> {
        return this.api.Runtime.evaluate({expression, objectGroup, contextId, returnByValue}).then(response => {
            return <WebKitProtocol.Runtime.EvaluateResponse>{
                result: {
                    result: <any>response.result
                }
        }});
    }
}
