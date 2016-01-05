interface INSDebugConnection {
    on(eventName: string, handler: (msg: any) => void): void;

    attach(port: number, host?: string): Promise<void>;

    close(): void;

    debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse>

    debugger_removeBreakpoint(breakpointId: string): Promise<WebKitProtocol.Response>

    debugger_stepOver(): Promise<WebKitProtocol.Response>;

    debugger_stepIn(): Promise<WebKitProtocol.Response>;

    debugger_stepOut(): Promise<WebKitProtocol.Response>;

    debugger_resume(): Promise<WebKitProtocol.Response>;

    debugger_pause(): Promise<WebKitProtocol.Response>;

    debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup?, returnByValue?: boolean): Promise<WebKitProtocol.Debugger.EvaluateOnCallFrameResponse>;

    debugger_setPauseOnExceptions(state: string): Promise<WebKitProtocol.Response>;

    debugger_getScriptSource(scriptId: WebKitProtocol.Debugger.ScriptId): Promise<WebKitProtocol.Debugger.GetScriptSourceResponse>;

    runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<WebKitProtocol.Runtime.GetPropertiesResponse>;

    runtime_evaluate(expression: string, objectGroup?: any, contextId?: number, returnByValue?: boolean): Promise<WebKitProtocol.Runtime.EvaluateResponse>;

    page_setOverlayMessage(message: string): Promise<WebKitProtocol.Response>;

    page_clearOverlayMessage(): Promise<WebKitProtocol.Response>;
}

interface INSProject {
    platform(): string;
    projectPath(): string;
    debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void>;
    createConnection() : Promise<INSDebugConnection>;
    getDebugPort() :  Promise<number>;
}

