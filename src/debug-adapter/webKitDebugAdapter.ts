/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {spawn, ChildProcess} from 'child_process';
import * as path from 'path';
import {Handles, StoppedEvent, InitializedEvent, TerminatedEvent, OutputEvent} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {INSDebugConnection} from './connection/INSDebugConnection';
import {IosConnection} from './connection/iosConnection';
import {AndroidConnection} from './connection/androidConnection';
import * as utils from './utilities';
import {formatConsoleMessage} from './consoleHelper';
import * as ns from '../services/NsCliService';
import {ILaunchRequestArgs, IAttachRequestArgs, IDebugAdapter, ISetBreakpointsArgs, ISetBreakpointsResponseBody, IBreakpoint,
    IStackTraceResponseBody, IScopesResponseBody, IVariablesResponseBody, ISourceResponseBody, IThreadsResponseBody, IEvaluateResponseBody} from './WebKitAdapterInterfaces';
import {AnalyticsService} from '../services/analytics/AnalyticsService';
import {ExtensionClient} from '../services/ipc/ExtensionClient';

interface IScopeVarHandle {
    objectId: string;
    thisObj?: WebKitProtocol.Runtime.RemoteObject;
}

export class WebKitDebugAdapter implements IDebugAdapter {
    private static THREAD_ID = 1;
    private static EXCEPTION_VALUE_ID = 'EXCEPTION_VALUE_ID';

    private _initArgs: DebugProtocol.InitializeRequestArguments;

    private _clientAttached: boolean;
    private _variableHandles: Handles<IScopeVarHandle>;
    private _currentStack: WebKitProtocol.Debugger.CallFrame[];
    private _committedBreakpointsByUrl: Map<string, WebKitProtocol.Debugger.BreakpointId[]>;
    private _overlayHelper: utils.DebounceHelper;
    private _exceptionValueObject: WebKitProtocol.Runtime.RemoteObject;
    private _expectingResumedEvent: boolean;
    private _scriptsById: Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>;
    private _setBreakpointsRequestQ: Promise<any>;

    private _chromeProc: ChildProcess;
    private _webKitConnection: INSDebugConnection;
    private _eventHandler: (event: DebugProtocol.Event) => void;
    private appRoot: string;
    private platform: string;
    private isAttached: boolean;
    private _lastOutputEvent: OutputEvent;

    public constructor() {
        this._variableHandles = new Handles<IScopeVarHandle>();
        this._overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);

        this.clearEverything();
    }

    private get paused(): boolean {
        return !!this._currentStack;
    }

    private clearTargetContext(): void {
        this._scriptsById = new Map<WebKitProtocol.Debugger.ScriptId, WebKitProtocol.Debugger.Script>();
        this._committedBreakpointsByUrl = new Map<string, WebKitProtocol.Debugger.BreakpointId[]>();
        this._setBreakpointsRequestQ = Promise.resolve<void>();
        this.fireEvent({ seq: 0, type: 'event',  event: 'clearTargetContext'});
    }

    private clearClientContext(): void {
        this._clientAttached = false;
        this.fireEvent({ seq: 0, type: 'event',  event: 'clearClientContext'});
    }

    public registerEventHandler(eventHandler: (event: DebugProtocol.Event) => void): void {
        this._eventHandler = eventHandler;
    }

    public initialize(args: DebugProtocol.InitializeRequestArguments): DebugProtocol.Capabilites | Promise<DebugProtocol.Capabilites> {
        // Cache to log if diagnostic logging is enabled later
        this._initArgs = args;
        return {
            supportsConfigurationDoneRequest: true,
            supportsFunctionBreakpoints: false,
            supportsConditionalBreakpoints: true,
            supportsEvaluateForHovers: false,
            exceptionBreakpointFilters: [{
				label: 'All Exceptions',
				filter: 'all',
				default: false
			},
			{
				label: 'Uncaught Exceptions',
				filter: 'uncaught',
				default: true
			}]
        }
    }

    public configurationDone(args: DebugProtocol.ConfigurationDoneArguments): void {

    }

    public launch(args: ILaunchRequestArgs): Promise<void> {
        return this._attach(args);
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        return this._attach(args);
    }

    private initDiagnosticLogging(name: string, args: IAttachRequestArgs | ILaunchRequestArgs): void {
        if (args.diagnosticLogging) {
            utils.Logger.enableDiagnosticLogging();
            utils.Logger.log(`initialize(${JSON.stringify(this._initArgs) })`);
            utils.Logger.log(`${name}(${JSON.stringify(args) })`);
        }
    }

    private _attach(args: IAttachRequestArgs | ILaunchRequestArgs) {
        ExtensionClient.setAppRoot(utils.getAppRoot(args));
        ExtensionClient.getInstance().analyticsLaunchDebugger({ request: args.request, platform: args.platform, emulator: args.emulator });
        this.initDiagnosticLogging(args.request, args);
        this.appRoot = utils.getAppRoot(args);
        this.platform = args.platform;
        this.isAttached = false;

        return ((args.platform == 'ios') ? this._attachIos(args) : this._attachAndroid(args))
            .then(() => {
                this.isAttached = true;
                this.fireEvent(new InitializedEvent());
            },
            e => {
                this.onTnsOutputMessage("Command failed: " + e, "error");
                this.clearEverything();
                return utils.errP(e);
            });
    }

    private _attachIos(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        let iosProject : ns.IosProject = new ns.IosProject(this.appRoot, args.tnsOutput);
        iosProject.on('TNS.outputMessage', (message, level) => this.onTnsOutputMessage.apply(this, [message, level]));

        return iosProject.debug(args)
        .then((socketFilePath) => {
            let iosConnection: IosConnection = new IosConnection();
            this.setConnection(iosConnection, args);
            return iosConnection.attach(socketFilePath);
        });
    }

    private _attachAndroid(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        let androidProject: ns.AndroidProject = new ns.AndroidProject(this.appRoot, args.tnsOutput);
        let thisAdapter: WebKitDebugAdapter = this;

        androidProject.on('TNS.outputMessage', (message, level) => thisAdapter.onTnsOutputMessage.apply(thisAdapter, [message, level]));

        this.onTnsOutputMessage("Getting debug port");
        let androidConnection: AndroidConnection = null;

        let runDebugCommand: Promise<any> = (args.request == 'launch' || args.request == 'livesync') ? androidProject.debug(args) : Promise.resolve();

        return runDebugCommand.then(_ => {
            let port: number;
            return androidProject.getDebugPort(args).then(debugPort => {
                port = debugPort;
                if (!thisAdapter._webKitConnection) {
                    androidConnection = new AndroidConnection();
                    this.setConnection(androidConnection, args);
                }
            }).then(() => {
                this.onTnsOutputMessage("Attaching to debug application");
                return androidConnection.attach(port, 'localhost');
            });
        });
    }

    private setConnection(connection: INSDebugConnection, args: IAttachRequestArgs | ILaunchRequestArgs) : INSDebugConnection {
        connection.on('Debugger.paused', params => this.onDebuggerPaused(params));
        connection.on('Debugger.resumed', () => this.onDebuggerResumed());
        connection.on('Debugger.scriptParsed', params => this.onScriptParsed(params));
        connection.on('Debugger.globalObjectCleared', () => this.onGlobalObjectCleared());
        connection.on('Debugger.breakpointResolved', params => this.onBreakpointResolved(params));
        connection.on('Console.messageAdded', params => this.onConsoleMessage(params));
        connection.on('Console.messageRepeatCountUpdated', params => this.onMessageRepeatCountUpdated(params));
        connection.on('Inspector.detached', () => this.terminateSession());
        connection.on('close', () => this.terminateSession());
        connection.on('error', () => this.terminateSession());
        connection.on('connect', () => this.onConnected(args))
        this._webKitConnection = connection;
        return connection;
    }

    private onConnected(args: IAttachRequestArgs | ILaunchRequestArgs): void {
        this.onTnsOutputMessage("Debugger connected");
    }

    private onTnsOutputMessage(message: string, level: string = "log"): void {
        utils.Logger.log(message);

        if (!this.isAttached) {
            let messageParams: WebKitProtocol.Console.MessageAddedParams = {
                message: {
                    level: level,
                    type: 'log',
                    text: message
                }
            };

            this.onConsoleMessage(messageParams);
        }
    }

    private fireEvent(event: DebugProtocol.Event): void {
        if (this._eventHandler) {
            this._eventHandler(event);
        }
    }

    private terminateSession(): void {
        if (this._clientAttached) {
            this.fireEvent(new TerminatedEvent());
        }

        this.onTnsOutputMessage("Terminating debug session");
        this.clearEverything();
    }

    private clearEverything(): void {
        this.clearClientContext();
        this.clearTargetContext();
        this.isAttached = false;
        this._chromeProc = null;

        if (this._webKitConnection) {
            this.onTnsOutputMessage("Closing debug connection");

            this._webKitConnection.close();
            this._webKitConnection = null;
        }
    }

    /**
     * e.g. the target navigated
     */
    private onGlobalObjectCleared(): void {
        this.clearTargetContext();
    }

    private onDebuggerPaused(notification: WebKitProtocol.Debugger.PausedParams): void {
        this._currentStack = notification.callFrames;

        // We can tell when we've broken on an exception. Otherwise if hitBreakpoints is set, assume we hit a
        // breakpoint. If not set, assume it was a step. We can't tell the difference between step and 'break on anything'.
        let reason: string;
        let exceptionText: string;
        if (notification.reason === 'exception') {
            reason = 'exception';
            if (notification.data && this._currentStack.length) {
                // Insert a scope to wrap the exception object. exceptionText is unused by Code at the moment.
                const remoteObjValue = utils.remoteObjectToValue(notification.data, false);
                let scopeObject: WebKitProtocol.Runtime.RemoteObject;

                if (remoteObjValue.variableHandleRef) {
                    // If the remote object is an object (probably an Error), treat the object like a scope.
                    exceptionText = notification.data.description;
                    scopeObject = notification.data;
                } else {
                    // If it's a value, use a special flag and save the value for later.
                    exceptionText = notification.data.value;
                    scopeObject = <any>{ objectId: WebKitDebugAdapter.EXCEPTION_VALUE_ID };
                    this._exceptionValueObject = notification.data;
                }

                this._currentStack[0].scopeChain.unshift({ type: 'Exception', object: scopeObject });
            }
        } else if (notification.reason == "PauseOnNextStatement") {
            reason = 'pause';
        } else if (notification.reason == "Breakpoint") {
            reason = 'breakpoint';
        } else {
            reason = 'step';
        }

        this.fireEvent(new StoppedEvent(reason, /*threadId=*/WebKitDebugAdapter.THREAD_ID, exceptionText));
    }

    private onDebuggerResumed(): void {
        this._currentStack = null;

        if (!this._expectingResumedEvent) {
            // This is a private undocumented event provided by VS Code to support the 'continue' button on a paused Chrome page
            let resumedEvent: DebugProtocol.Event = { seq: 0, type: 'event',  event: 'continued', body: { threadId: WebKitDebugAdapter.THREAD_ID }};
            this.fireEvent(resumedEvent);
        } else {
            this._expectingResumedEvent = false;
        }
    }

    private onScriptParsed(script: WebKitProtocol.Debugger.Script): void {
        this._scriptsById.set(script.scriptId, script);

        if (this.scriptIsNotAnonymous(script)) {
            this.fireEvent({ seq: 0, type: 'event',  event: 'scriptParsed', body: { scriptUrl: script.url, sourceMapURL: script.sourceMapURL }});
        }
    }

    private onBreakpointResolved(params: WebKitProtocol.Debugger.BreakpointResolvedParams): void {
        const script = this._scriptsById.get(params.location.scriptId);
        if (!script) {
            // Breakpoint resolved for a script we don't know about
            return;
        }

        const committedBps = this._committedBreakpointsByUrl.get(script.url) || [];
        committedBps.push(params.breakpointId);
        this._committedBreakpointsByUrl.set(script.url, committedBps);
    }

    private onConsoleMessage(params: WebKitProtocol.Console.MessageAddedParams): void {
        let localMessage = params.message;
        let isClientPath = false;
        if (localMessage.url)
        {
            const clientPath = utils.webkitUrlToClientPath(this.appRoot, this.platform, localMessage.url);
            if (clientPath !== '') {
                localMessage.url = clientPath;
                isClientPath = true;
            }
        }

        const formattedMessage = formatConsoleMessage(localMessage, isClientPath);
        if (formattedMessage) {
            let outputEvent: OutputEvent = new OutputEvent(formattedMessage.text + '\n', formattedMessage.isError ? 'stderr' : 'stdout');
            this._lastOutputEvent = outputEvent;
            this.fireEvent(outputEvent);
        }
    }

    public onMessageRepeatCountUpdated(params: WebKitProtocol.Console.MessageRepeatCountUpdatedEventArgs) {
        if (this._lastOutputEvent) {
            this.fireEvent(this._lastOutputEvent);
        }
    }

    public disconnect(): Promise<void> {
        if (this._chromeProc) {
            this._chromeProc.kill('SIGINT');
            this._chromeProc = null;
        }

        this.clearEverything();

        return Promise.resolve<void>();
    }

    public setBreakpoints(args: ISetBreakpointsArgs): Promise<ISetBreakpointsResponseBody> {
        let targetScriptUrl: string;
        if (args.source.path) {
            targetScriptUrl = args.source.path;
        } else if (args.source.sourceReference) {
            const targetScript = this._scriptsById.get(sourceReferenceToScriptId(args.source.sourceReference));
            if (targetScript) {
                targetScriptUrl = targetScript.url;
            }
        }

        if (targetScriptUrl) {
            // DebugProtocol sends all current breakpoints for the script. Clear all scripts for the breakpoint then add all of them
            const setBreakpointsPFailOnError = this._setBreakpointsRequestQ
                .then(() => this._clearAllBreakpoints(targetScriptUrl))
                .then(() => this._addBreakpoints(targetScriptUrl, args))
                .then(responses => ({ breakpoints: this._webkitBreakpointResponsesToODPBreakpoints(targetScriptUrl, responses, args.lines) }));

            const inDebug = typeof (<any>global).v8debug === 'object';
            console.log("InDebug: " + inDebug);
            const setBreakpointsPTimeout = utils.promiseTimeout(setBreakpointsPFailOnError, /*timeoutMs*/inDebug ? 2000000 : 8000, 'Set breakpoints request timed out');

            // Do just one setBreakpointsRequest at a time to avoid interleaving breakpoint removed/breakpoint added requests to Chrome.
            // Swallow errors in the promise queue chain so it doesn't get blocked, but return the failing promise for error handling.
            this._setBreakpointsRequestQ = setBreakpointsPTimeout.catch(() => undefined);
            return setBreakpointsPTimeout;
        } else {
            return utils.errP(`Can't find script for breakpoint request`);
        }
    }

    private _clearAllBreakpoints(url: string): Promise<void> {
        if (!this._committedBreakpointsByUrl.has(url)) {
            return Promise.resolve<void>();
        }

        // Remove breakpoints one at a time. Seems like it would be ok to send the removes all at once,
        // but there is a chrome bug where when removing 5+ or so breakpoints at once, it gets into a weird
        // state where later adds on the same line will fail with 'breakpoint already exists' even though it
        // does not break there.
        return this._committedBreakpointsByUrl.get(url).reduce((p, bpId) => {
            return p.then(() => this._webKitConnection.debugger_removeBreakpoint(bpId)).then(() => { });
        }, Promise.resolve<void>()).then(() => {
            this._committedBreakpointsByUrl.set(url, null);
        });
    }

    private _addBreakpoints(url: string, breakpoints: ISetBreakpointsArgs): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse[]> {
        // Call setBreakpoint for all breakpoints in the script simultaneously
        const responsePs = breakpoints.breakpoints
            .map((b, i) => this._webKitConnection.debugger_setBreakpointByUrl(url, breakpoints.lines[i], breakpoints.cols ? breakpoints.cols[i] : 0, b.condition));

        // Join all setBreakpoint requests to a single promise
        return Promise.all(responsePs);
    }

    private _webkitBreakpointResponsesToODPBreakpoints(url: string, responses: WebKitProtocol.Debugger.SetBreakpointByUrlResponse[], requestLines: number[]): IBreakpoint[] {
        // Don't cache errored responses
        const committedBpIds = responses
            .filter(response => !response.error)
            .map(response => response.result.breakpointId);

        // Cache successfully set breakpoint ids from webkit in committedBreakpoints set
        this._committedBreakpointsByUrl.set(url, committedBpIds);

        // Map committed breakpoints to DebugProtocol response breakpoints
        return responses
            .map((response, i) => {
                // The output list needs to be the same length as the input list, so map errors to
                // unverified breakpoints.
                if (response.error || !response.result.locations.length) {
                    return <IBreakpoint>{
                        verified: !response.error,
                        line: requestLines[i],
                        column: 0
                    };
                }

                return <IBreakpoint>{
                    verified: true,
                    line: response.result.locations[0].lineNumber,
                    column: response.result.locations[0].columnNumber
                };
            });
    }

    public setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void> {
        let state: string;
        if (args.filters.indexOf('all') >= 0) {
            state = 'all';
        } else if (args.filters.indexOf('uncaught') >= 0) {
            state = 'uncaught';
        } else {
            state = 'none';
        }

        return this._webKitConnection.debugger_setPauseOnExceptions(state)
            .then(() => { });
    }

    public continue(): Promise<void> {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_resume()
            .then(() => { });
    }

    public next(): Promise<void> {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepOver()
            .then(() => { });
    }

    public stepIn(): Promise<void> {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepIn()
            .then(() => { });
    }

    public stepOut(): Promise<void> {
        this._expectingResumedEvent = true;
        return this._webKitConnection.debugger_stepOut()
            .then(() => { });
    }

    public pause(): Promise<void> {
        return this._webKitConnection.debugger_pause()
            .then(() => { });
    }

    public stackTrace(args: DebugProtocol.StackTraceArguments): IStackTraceResponseBody {
        // Only process at the requested number of frames, if 'levels' is specified
        let stack = this._currentStack;
        if (args.levels) {
            stack = this._currentStack.filter((_, i) => i < args.levels);
        }

        const stackFrames: DebugProtocol.StackFrame[] = stack
            .map((callFrame: WebKitProtocol.Debugger.CallFrame, i: number) => {
                const sourceReference = scriptIdToSourceReference(callFrame.location.scriptId);
                const scriptId = callFrame.location.scriptId;
                const script = this._scriptsById.get(scriptId);

                let source: DebugProtocol.Source;
                if (this.scriptIsNotUnknown(scriptId)) {
                    // We have received Debugger.scriptParsed event for the script.
                    if (this.scriptIsNotAnonymous(script)) {
                        /**
                         * We have received non-empty url with the Debugger.scriptParsed event.
                         * We set the url value to the path property. Later on, the PathTransformer will attempt to resolve it to a script in the app root folder.
                         * In case it fails to resolve it, we also set the sourceReference field in order to allow the client to send source request to retrieve the source.
                         * If the PathTransformer resolves the url successfully, it will change the value of sourceReference to 0.
                         */
                        source = {
                            name: path.basename(script.url),
                            path: script.url,
                            sourceReference: scriptIdToSourceReference(script.scriptId) // will be 0'd out by PathTransformer if not needed
                        };
                    }
                    else {
                        /**
                         * We have received Debugger.scriptParsed event with empty url value.
                         * Sending only the sourceId will make the client to send source request to retrieve the source of the script.
                         */
                        source = {
                            name: 'anonymous source',
                            sourceReference: sourceReference
                        };
                    }
                }
                else {
                    /**
                     * Unknown script. No Debugger.scriptParsed event received for the script.
                     *
                     * Some 'internal scripts' are intentionally referenced by id equal to 0. Others have id > 0 but no Debugger.scriptParsed event is sent when parsed.
                     * In both cases we can't get its source code. If we send back a zero sourceReference the VS Code client will not send source request.
                     * The most we can do is to include a dummy stack frame with no source associated and without specifing the sourceReference.
                     */
                    source = {
                        name: 'unknown source',
                        origin: 'internal module',
                        sourceReference: 0
                    };
                }

                // If the frame doesn't have a function name, it's either an anonymous function
                // or eval script. If its source has a name, it's probably an anonymous function.
                const frameName = callFrame.functionName || (script && script.url ? '(anonymous function)' : '(eval code)');
                return {
                    id: i,
                    name: frameName,
                    source: source,
                    line: callFrame.location.lineNumber,
                    column: callFrame.location.columnNumber
                };
            });

        return { stackFrames };
    }

    public scopes(args: DebugProtocol.ScopesArguments): IScopesResponseBody {
        const scopes = this._currentStack[args.frameId].scopeChain.map((scope: WebKitProtocol.Debugger.Scope, i: number) => {
            const scopeHandle: IScopeVarHandle = { objectId: scope.object.objectId };
            if (i === 0) {
                // The first scope should include 'this'. Keep the RemoteObject reference for use by the variables request
                scopeHandle.thisObj = this._currentStack[args.frameId]['this'];
            }

            return <DebugProtocol.Scope>{
                name: scope.type,
                variablesReference: this._variableHandles.create(scopeHandle),
                expensive: scope.type === 'global'
            };
        });

        return { scopes };
    }

    public variables(args: DebugProtocol.VariablesArguments): Promise<IVariablesResponseBody> {
        const handle = this._variableHandles.get(args.variablesReference);
        if (handle.objectId === WebKitDebugAdapter.EXCEPTION_VALUE_ID) {
            // If this is the special marker for an exception value, create a fake property descriptor so the usual route can be used
            const excValuePropDescriptor: WebKitProtocol.Runtime.PropertyDescriptor = <any>{ name: 'exception', value: this._exceptionValueObject };
            return Promise.resolve({ variables: [this.propertyDescriptorToVariable(excValuePropDescriptor)] });
        } else if (handle != null) {
            return Promise.all([
                // Need to make two requests to get all properties
                this._webKitConnection.runtime_getProperties(handle.objectId, /*ownProperties=*/false, /*accessorPropertiesOnly=*/true),
                this._webKitConnection.runtime_getProperties(handle.objectId, /*ownProperties=*/true, /*accessorPropertiesOnly=*/false)
            ]).then(getPropsResponses => {
                // Sometimes duplicates will be returned - merge all property descriptors returned
                const propsByName = new Map<string, WebKitProtocol.Runtime.PropertyDescriptor>();
                getPropsResponses.forEach(response => {
                    if (!response.error) {
                        response.result.result.forEach(propDesc =>
                            propsByName.set(propDesc.name, propDesc));
                    }
                });

                // Convert WebKitProtocol prop descriptors to DebugProtocol vars, sort the result
                const variables: DebugProtocol.Variable[] = [];
                propsByName.forEach(propDesc => variables.push(this.propertyDescriptorToVariable(propDesc)));
                variables.sort((var1, var2) => var1.name.localeCompare(var2.name));

                // If this is a scope that should have the 'this', prop, insert it at the top of the list
                if (handle.thisObj) {
                    variables.unshift(this.propertyDescriptorToVariable(<any>{ name: 'this', value: handle.thisObj }));
                }

                return { variables };
            });
        } else {
            return Promise.resolve();
        }
    }

    public source(args: DebugProtocol.SourceArguments): Promise<ISourceResponseBody> {
        return this._webKitConnection.debugger_getScriptSource(sourceReferenceToScriptId(args.sourceReference)).then(webkitResponse => {
            if (webkitResponse.error) {
                throw new Error(webkitResponse.error.message);
            }
            return { content: webkitResponse.result.scriptSource };
        });
    }

    public threads(): IThreadsResponseBody {
        return {
            threads: [
                {
                    id: WebKitDebugAdapter.THREAD_ID,
                    name: 'Thread ' + WebKitDebugAdapter.THREAD_ID
                }
            ]
        };
    }

    public evaluate(args: DebugProtocol.EvaluateArguments): Promise<IEvaluateResponseBody> {
        let evalPromise: Promise<any>;
        if (this.paused) {
            const callFrame = this._currentStack[args.frameId];
            if (!this.scriptIsNotUnknown(callFrame.location.scriptId)) {
                // The iOS debugger backend hangs and stops responding after receiving evaluate request on call frame which has unknown source.
                throw new Error('-'); // The message will be printed in the VS Code UI
            }
            evalPromise = this._webKitConnection.debugger_evaluateOnCallFrame(callFrame.callFrameId, args.expression);
        } else {
            evalPromise = this._webKitConnection.runtime_evaluate(args.expression);
        }

        return evalPromise.then(evalResponse => {
            if (evalResponse.result.wasThrown) {
                const errorMessage = evalResponse.result.exceptionDetails ? evalResponse.result.exceptionDetails.text : 'Error';
                return utils.errP(errorMessage);
            }

            const { value, variablesReference } = this.remoteObjectToValue(evalResponse.result.result);
            return { result: value, variablesReference };
        });
    }

    private propertyDescriptorToVariable(propDesc: WebKitProtocol.Runtime.PropertyDescriptor): DebugProtocol.Variable {
        if (propDesc.get || propDesc.set) {
            // A property doesn't have a value here, and we shouldn't evaluate the getter because it may have side effects.
            // Node adapter shows 'undefined', Chrome can eval the getter on demand.
            return { name: propDesc.name, value: 'property', variablesReference: 0 };
        } else {
            const { value, variablesReference } = this.remoteObjectToValue(propDesc.value);
            return { name: propDesc.name, value, variablesReference };
        }
    }

    /**
     * Run the object through Utilities.remoteObjectToValue, and if it returns a variableHandle reference,
     * use it with this instance's variableHandles to create a variable handle.
     */
    private remoteObjectToValue(object: WebKitProtocol.Runtime.RemoteObject): { value: string, variablesReference: number } {
        const { value, variableHandleRef } = utils.remoteObjectToValue(object);
        const result = { value, variablesReference: 0 };
        if (variableHandleRef) {
            result.variablesReference = this._variableHandles.create({ objectId: variableHandleRef });
        }

        return result;
    }

    // Returns true if the script has url supplied in Debugger.scriptParsed event
    private scriptIsNotAnonymous(script: WebKitProtocol.Debugger.Script): boolean {
        return script && !!script.url;
    }

    // Returns true if Debugger.scriptParsed event is received for the provided script id
    private scriptIsNotUnknown(scriptId: WebKitProtocol.Debugger.ScriptId): boolean {
        return !!this._scriptsById.get(scriptId);
    }
}

function scriptIdToSourceReference(scriptId: WebKitProtocol.Debugger.ScriptId): number {
    return parseInt(scriptId, 10);
}

function sourceReferenceToScriptId(sourceReference: number): WebKitProtocol.Debugger.ScriptId {
    return '' + sourceReference;
}
