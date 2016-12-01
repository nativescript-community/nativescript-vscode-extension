export interface INSDebugConnection {
    on(eventName: string, handler: (msg: any) => void): void;

    close(): void;

    debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number, condition: string, ignoreCount: number): Promise<Webkit.Response<Webkit.Debugger.SetBreakpointByUrlResult>>

    debugger_removeBreakpoint(breakpointId: string): Promise<Webkit.Response<any>>

    debugger_stepOver(): Promise<Webkit.Response<any>>;

    debugger_stepIn(): Promise<Webkit.Response<any>>;

    debugger_stepOut(): Promise<Webkit.Response<any>>;

    debugger_resume(): Promise<Webkit.Response<any>>;

    debugger_pause(): Promise<Webkit.Response<any>>;

    debugger_evaluateOnCallFrame(callFrameId: string, expression: string, objectGroup?, returnByValue?: boolean): Promise<Webkit.Response<Webkit.Debugger.EvaluateOnCallFrameResult>>;

    debugger_setPauseOnExceptions(state: string): Promise<Webkit.Response<any>>;

    debugger_getScriptSource(scriptId: Webkit.Debugger.ScriptId): Promise<Webkit.Response<Webkit.Debugger.GetScriptSourceResult>>;

    runtime_getProperties(objectId: string, ownProperties: boolean, accessorPropertiesOnly: boolean): Promise<Webkit.Response<Webkit.Runtime.GetPropertiesResult>>;

    runtime_evaluate(expression: string, objectGroup?: any, contextId?: number, returnByValue?: boolean): Promise<Webkit.Response<Webkit.Runtime.EvaluateResult>>;
}