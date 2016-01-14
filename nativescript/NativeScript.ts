import {exec, ChildProcess} from 'child_process';
import {WebKitConnection} from '../webkit/webKitConnection';
import {AndroidDebugConnection} from './android/AndroidDebugConnection';

export interface INSDebugConnection {
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

    emit(event: string, ...args: any[]): boolean;
}

export interface INSProject {
    platform(): string;

    projectPath(): string;

    debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<ChildProcess>;

    createConnection() : Promise<INSDebugConnection>;

    getDebugPort() :  Promise<number>;
}

export abstract class NSProject implements INSProject {
    private _projectPath: string;

    constructor(projectPath: string) {
        this._projectPath = projectPath;
    }

    public projectPath(): string {
        return this._projectPath;
    }

    public abstract platform(): string;

    public abstract debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<ChildProcess>;

    public abstract createConnection(): Promise<INSDebugConnection>;

    public abstract getDebugPort(): Promise<number>;

}

export class IosProject extends NSProject {

    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'ios';
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<ChildProcess> {
        return new Promise<ChildProcess>((resolve, reject) => {
            let error: string = this.isNotSupported();
            if(error !== null) {
                reject(error);
                return;
            }

            let command: string = new CommandBuilder()
                .appendParam("debug")
                .appendParam(this.platform())
                .appendFlag("--emulator", args.emulator)
                .appendFlag("--start", args.request === "attach")
                .appendFlag("--debug-brk", args.request === "launch")
                .appendFlag("--no-client", true)
                .build();

            // run NativeScript CLI command
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            if(child) {
                resolve(child);
            }
            else {
                reject('Unable to start CLI command.');
            }
        });
    }

    public createConnection() : Promise<INSDebugConnection>
    {
        return Promise.resolve(new WebKitConnection());
    }

    public getDebugPort(): Promise<number>
    {
        return Promise.resolve(18181);
    }

    private isNotSupported(): string {
        if(!/^darwin/.test(process.platform)) {
            return 'iOS platform is supported only on Mac.';
        }
        return null;
    }
}

export class AndoridProject extends NSProject {
    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'android';
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<ChildProcess> {
        if (args.request === "attach")
        {
            return Promise.resolve<ChildProcess>(null);
        }
        else if (args.request === "launch")
        {
            //TODO: interaction with CLI here
            //throw new Error("Launch on Android not implemented");

            return new Promise<ChildProcess>((resolve, reject) => {
                let command: string = new CommandBuilder()
                    .appendParam("debug")
                    .appendParam(this.platform())
                    .appendFlag("--emulator", args.emulator)
                    .appendFlag("--debug-brk", true)
                    //.appendFlag("--start", !options.debugBrk)
                    //.appendFlag("--log trace", true)
                    .appendFlag("--no-client", true)
                    .build();

                // run NativeScript CLI command
                let newEnv = process.env;
                //newEnv["ANDROID_HOME"] = "d:\\adt-bundle-windows-x86_64-20140702\\sdk\\";
                let child: ChildProcess = exec(command, { cwd: this.projectPath() , env: newEnv });
                if(child) {
                    resolve(child);
                }
                else {
                    reject('Unable to start CLI command.');
                }
            });
        }
    }

    public createConnection() : Promise<INSDebugConnection>
    {
        return Promise.resolve(new AndroidDebugConnection());
    }

    public getDebugPort(): Promise<number>
    {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);



        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendFlag("--get-port", true)
            .build();

        // run NativeScript CLI command
        return new Promise<number>((resolve, reject) => {
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            child.stdout.on('data', function(data) {
                console.log("text " + data.toString());
                let regexp = new RegExp("([\\d]{5})", "g");

                //for the new output
                // var input = "device: 030b258308e6ce89 debug port: 40001";
                // var regexp = new RegExp("(?:^device: )([\\S]+)(?: debug port: )([\\d]+)", "g");
                // var match = regexp.exec(input);
                // console.log(match);

                let portNumberMatch = data.toString().match(regexp)
                console.log("port number match " + portNumberMatch);
                if (portNumberMatch)
                {
                    let portNumber = parseInt(portNumberMatch);
                    if (portNumber)
                    {
                        console.log("port number " + portNumber);
                        resolve(portNumber);
                    }
                }
            });
            child.stderr.on('data', function(data) {
                console.error(data.toString());
            });
            child.on('close', function(code) {
                reject(code);
            });
        });
    }
}

class CommandBuilder {
    private _command: string;

    constructor() {
        this._command = 'tns';
    }

    public appendParam(parameter: string): CommandBuilder {
        this._command += ' ' + parameter;
        return this;
    }

    public appendFlag(flagName: string, flagValue: boolean): CommandBuilder {
        if (flagValue) {
            this.appendParam(flagName);
        }
        return this;
    }

    public build(): string {
        return this._command;
    }
}