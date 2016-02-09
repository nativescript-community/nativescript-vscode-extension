import {exec, ChildProcess} from 'child_process';
import {Logger} from '../webkit/utilities';
import {WebKitConnection} from '../webkit/webKitConnection';
import {AndroidDebugConnection} from './android/AndroidDebugConnection';
import {EventEmitter} from 'events';

export interface INSDebugConnection {
    on(eventName: string, handler: (msg: any) => void): void;

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

export abstract class NSProject extends EventEmitter {
    private _projectPath: string;

    constructor(projectPath: string) {
        this._projectPath = projectPath;
        super();
    }

    public projectPath(): string {
        return this._projectPath;
    }

    public ensureNativeScriptIsInstalled(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let command: string = new CommandBuilder().build();
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            child.on('close', exitCode => {
                if(exitCode == 0) {
                    resolve();
                }
                else {
                    reject("NativeScript not found, please run 'npm install –g nativescript' to install it.");
                }
            })
        });
    }

    public abstract platform(): string;
}

export class IosProject extends NSProject {

    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'ios';
    }

    public run(emulator: boolean): Promise<ChildProcess> {
        if(!this.isOSX()) {
            return Promise.reject('iOS platform is only supported on OS X.');
        }

        return this.ensureNativeScriptIsInstalled()
        .then(() => {
            // build command to execute
            let command: string = new CommandBuilder()
                .appendParam("run")
                .appendParam(this.platform())
                .appendFlag("--emulator", emulator)
                .build();

            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            return child;
        });
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<string> {
        if(!this.isOSX()) {
            return Promise.reject('iOS platform is supported only on OS X.');
        }

        return this.ensureNativeScriptIsInstalled()
        .then(() => {
            // build command to execute
            let command: string = new CommandBuilder()
                .appendParam("debug")
                .appendParam(this.platform())
                .appendFlag("--emulator", args.emulator)
                .appendFlag("--start", args.request === "attach")
                .appendFlag("--debug-brk", args.request === "launch")
                .appendParam("--no-client")
                .build();

            let socketPathPrefix = 'socket-file-location: ';
            let socketPathPattern: RegExp = new RegExp(socketPathPrefix + '.*\.sock');
            let readyToConnect: boolean = false;

            return new Promise<string>((resolve, reject) => {
                // run NativeScript CLI command
                let child: ChildProcess = exec(command, { cwd: this.projectPath() });

                child.stdout.on('data', (data) => {
                    let strData: string = data.toString();
                    Logger.log(strData);
                    this.emit('TNS.outputMessage', strData, 'log');
                    if(!readyToConnect) {
                        let matches: RegExpMatchArray = strData.match(socketPathPattern);
                        if(matches && matches.length > 0) {
                            readyToConnect = true;
                            resolve(matches[0].substr(socketPathPrefix.length));
                        }
                    }
                });

                child.stderr.on('data', (data) => {
                    Logger.log(data);
                    this.emit('TNS.outputMessage', data, 'error');
                });

                child.on('close', (code) => {
                    reject("The debug process exited unexpectedly");
                });
            });
        });
    }

    private isOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}

export class AndoridProject extends NSProject {
    private child: ChildProcess;

    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'android';
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        if (args.request === "attach") {
            return Promise.resolve<void>();
        }
        else if (args.request === "launch") {
            //TODO: interaction with CLI here
            //throw new Error("Launch on Android not implemented");
            let that = this;
            let launched = false;
            return new Promise<void>((resolve, reject) => {
                let command: string = new CommandBuilder()
                    .appendParam("debug")
                    .appendParam(this.platform())
                    .appendFlag("--emulator", args.emulator)
                    .appendFlag("--debug-brk", true)
                    //.appendFlag("--start", true)
                    //.appendFlag("--log trace", true)
                    .appendParam("--no-client")
                    .build();

                // run NativeScript CLI command
                let newEnv = process.env;
                //newEnv["ANDROID_HOME"] = "d:\\adt-bundle-windows-x86_64-20140702\\sdk\\";
                this.child = exec(command, { cwd: this.projectPath(), env: newEnv });
                this.child.stdout.on('data', function(data) {
                    let strData: string = data.toString();
                    console.log(data.toString());
                    that.emit('TNS.outputMessage', data.toString(), 'log');
                    if (!launched && args.request === "launch" && strData.indexOf('# NativeScript Debugger started #') > -1) {
                        that.child = null;
                        launched = true;

                        //wait a little before trying to connect, this gives a changes for adb to be able to connect to the debug socket
                        setTimeout(() => {
                            resolve();
                        }, 500);
                    }
                });

                this.child.stderr.on('data', function(data) {
                    console.error(data.toString());
                    that.emit('TNS.outputMessage', data.toString(), 'error');

                });
                this.child.on('close', function(code) {
                    that.child = null;
                    reject("The debug process exited unexpectedly");
                });
            });
        }
    }

    public createConnection(): Promise<AndroidDebugConnection> {
        return Promise.resolve(new AndroidDebugConnection());
    }

    public getDebugPort(): Promise<number> {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);

        //return Promise.resolve(40001);

        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendFlag("--get-port", true)
            .build();
        let that = this;
        // run NativeScript CLI command
        return new Promise<number>((resolve, reject) => {
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            child.stdout.on('data', function(data) {
                that.emit('TNS.outputMessage', data.toString(), 'log');
                console.log("getDebugPort: " + data.toString());
                let regexp = new RegExp(" ([\\d]{5})", "g");

                //for the new output
                // var input = "device: 030b258308e6ce89 debug port: 40001";
                // var regexp = new RegExp("(?:^device: )([\\S]+)(?: debug port: )([\\d]+)", "g");
                // var match = regexp.exec(input);
                // console.log(match);

                let portNumberMatch = data.toString().match(regexp)
                console.log("port number match " + portNumberMatch);
                if (portNumberMatch) {
                    let portNumber = parseInt(portNumberMatch);
                    if (portNumber) {
                        console.log("port number " + portNumber);
                        child.stdout.removeAllListeners('data');
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