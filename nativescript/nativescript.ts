import {exec, execSync, ChildProcess} from 'child_process';
import {Logger} from '../webkit/utilities';
import {WebKitConnection} from '../webkit/webKitConnection';
import {AndroidDebugConnection} from './android/androidDebugConnection';
import {EventEmitter} from 'events';
import * as path from 'path';

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

    public abstract platform(): string;

    public abstract run(emulator: boolean): Promise<ChildProcess>;
}

export class IosProject extends NSProject {

    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'ios';
    }

    public run(emulator: boolean): Promise<ChildProcess> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is only supported on OS X.');
        }
        if(!CliInfo.isExisting()) {
            return Promise.reject(CliInfo.getMessage());
        }

        // build command to execute
        let command: string = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .tryAppendParam("--emulator", emulator)
            .build();

        let child: ChildProcess = exec(command, { cwd: this.projectPath() });
        return Promise.resolve(child);
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<string> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is supported only on OS X.');
        }
        if(!CliInfo.isExisting()) {
            return Promise.reject(CliInfo.getMessage());
        }

        // build command to execute
        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .tryAppendParam("--emulator", args.emulator)
            .tryAppendParam("--start", args.request === "attach")
            .tryAppendParam("--debug-brk", args.request === "launch")
            .appendParam("--no-client")
            .appendParam(args.tnsArgs)
            .build();

        let socketPathPrefix = 'socket-file-location: ';
        let socketPathPattern: RegExp = new RegExp(socketPathPrefix + '.*\.sock');
        let readyToConnect: boolean = false;

        return new Promise<string>((resolve, reject) => {
            if(!CliInfo.isCompatible()) {
                this.emit('TNS.outputMessage', 'WARNING: ' + CliInfo.getMessage(), 'error');
            }

            // run NativeScript CLI command
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });

            child.stdout.on('data', (data) => {
                let strData: string = data.toString();
                this.emit('TNS.outputMessage', strData, 'log');
                if(!readyToConnect) {
                    let matches: RegExpMatchArray = strData.match(socketPathPattern);
                    if(matches && matches.length > 0) {
                        if(!CliInfo.isCompatible()) {
                            this.emit('TNS.outputMessage', 'WARNING: ' + CliInfo.getMessage(), 'error');
                        }
                        readyToConnect = true;
                        resolve(matches[0].substr(socketPathPrefix.length));
                    }
                }
            });

            child.stderr.on('data', (data) => {
                this.emit('TNS.outputMessage', data, 'error');
            });

            child.on('close', (code) => {
                reject("The debug process exited unexpectedly code:" + code);
            });
        });
    }

    private isOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}

export class AndroidProject extends NSProject {

    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'android';
    }

    public run(emulator: boolean): Promise<ChildProcess> {
        if(!CliInfo.isExisting()) {
            return Promise.reject(CliInfo.getMessage());
        }

        // build command to execute
        let command: string = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .tryAppendParam("--emulator", emulator)
            .build();

        let child: ChildProcess = exec(command, { cwd: this.projectPath() });
        return Promise.resolve(child);
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        if (args.request === "attach") {
            return Promise.resolve<void>();
        }
        else if (args.request === "launch") {
            let that = this;
            let launched = false;

            return new Promise<void>((resolve, reject) => {
                let command: string = new CommandBuilder()
                    .appendParam("debug")
                    .appendParam(this.platform())
                    .tryAppendParam("--emulator", args.emulator)
                    .appendParam("--debug-brk")
                    .appendParam("--no-client")
                    .appendParam(args.tnsArgs)
                    .build();

                        Logger.log("tns  debug command: " + command);

                // run NativeScript CLI command
                let child: ChildProcess = exec(command, { cwd: this.projectPath() });
                child.stdout.on('data', function(data) {
                    let strData: string = data.toString();
                    that.emit('TNS.outputMessage', data.toString(), 'log');
                    if (!launched && args.request === "launch" && strData.indexOf('# NativeScript Debugger started #') > -1) {
                        launched = true;

                        //wait a little before trying to connect, this gives a changes for adb to be able to connect to the debug socket
                        setTimeout(() => {
                            resolve();
                        }, 500);
                    }
                });

                child.stderr.on('data', function(data) {
                    that.emit('TNS.outputMessage', data.toString(), 'error');

                });

                child.on('close', function(code) {
                    reject("The debug process exited unexpectedly code:" + code);
                });
            });
         }
    }

    public createConnection(): Promise<AndroidDebugConnection> {
        return Promise.resolve(new AndroidDebugConnection());
    }

    public getDebugPort(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<number> {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);

        //return Promise.resolve(40001);

        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParam("--get-port")
            .appendParam(args.tnsArgs)
            .build();
        let that = this;
        // run NativeScript CLI command
        return new Promise<number>((resolve, reject) => {
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            child.stdout.on('data', function(data) {
                that.emit('TNS.outputMessage', data.toString(), 'log');

                let regexp = new RegExp("(?:debug port: )([\\d]{5})");

                //for the new output
                // var input = "device: 030b258308e6ce89 debug port: 40001";

                let portNumberMatch = null;
                let match = data.toString().match(regexp);
                if (match)
                {
                    portNumberMatch = match[1];
                }

                if (portNumberMatch) {
                    Logger.log("port number match '" + portNumberMatch + "'");
                    let portNumber = parseInt(portNumberMatch);
                    if (portNumber) {
                        Logger.log("port number " + portNumber);
                        child.stdout.removeAllListeners('data');
                        resolve(portNumber);
                    }
                }
            });

            child.stderr.on('data', function(data) {
                that.emit('TNS.outputMessage', data.toString(), 'error');
            });

            child.on('close', function(code) {
                reject("Getting debug port failed with code: " + code);
            });
        });
    }
}

class CommandBuilder {
    private _command: string;

    constructor() {
        this._command = 'tns';
    }

    public appendParam(parameter: string = ""): CommandBuilder {
        this._command += " " + parameter;
        return this;
    }

    public tryAppendParam(parameter: string = "", condtion: boolean): CommandBuilder {
        if (condtion) {
            this._command += " " + parameter;
        }
        return this;
    }

    public build(): string {
        return this._command;
    }
}


export enum CliState {
    NotExisting,
    OlderThanSupported,
    NewerThanSupported,
    Compatible
}

export module CliInfo {
    var installedCliVersion: number[];
    var extensionCliVersion: number[];
    let state: CliState;
    let message: string;

    function compareByMinorVersions(v1: number[], v2: number[]) {
        return (v1[0] - v2[0] != 0) ? (v1[0] - v2[0]) : v1[1] - v2[1];
    }

    function parseVersion(versionStr: string): number[] {
        if (versionStr == null) {
            return null;
        }
        let version: number[] = versionStr.split('.').map<number>((str, index, array) => parseInt(str));
        for(let i = version.length; i < 3; i++) {
            version.push(0);
        }
        return version;
    }

    function versionToString(version: number[]) {
        return `${version[0]}.${version[1]}.${version[2]}`;
    }

    export function getMessage() {
        return message;
    }

    export function getState() {
        return state;
    }

    export function isExisting() {
        return state != CliState.NotExisting;
    }

    export function isCompatible() {
        return state == CliState.Compatible;
    }

    function initialize() {
        // get the supported CLI version from package.json
        extensionCliVersion = parseVersion(require(path.resolve(__dirname, '../../package.json'))['nativescript-cli-version']);
        // get the currently installed CLI version
        let getVersionCommand: string = new CommandBuilder().appendParam('--version').build(); // build the command
        try {
            let versionStr: string = execSync(getVersionCommand).toString(); // execute it
            installedCliVersion = versionStr ? parseVersion(versionStr) : null; // parse the version string
        } catch(e) {
            installedCliVersion = null;
        }

        // initialize the state of the CLI by comparing the installed CLI version and the extension CLI version
        if (installedCliVersion) {
            let compareResult: number = compareByMinorVersions(installedCliVersion, extensionCliVersion);
            if (compareResult < 0) {
                state = CliState.OlderThanSupported;
                message = `NativeScript extension is expected to work with NativeScript v${versionToString(extensionCliVersion)}, but currently NativeScript v${versionToString(installedCliVersion)} is installed. This may lead to not working features. Try to update NativeScript by executing 'npm install -g nativescript'.`;
            }
            else if (compareResult > 0) {
                state = CliState.NewerThanSupported;
                message = `NativeScript extension is expected to work with NativeScript v${versionToString(extensionCliVersion)}, but currently NativeScript v${versionToString(installedCliVersion)} is installed. This may lead to not working features. Try to update the extension by running 'Show Outdated Extensions' command.`
            }
            else {
                state = CliState.Compatible;
                message = null;
            }
        }
        else {
            state = CliState.NotExisting;
            message = `NativeScript not found, please run 'npm install –g nativescript@${versionToString(extensionCliVersion)}' to install it.`;
        }
    }
    initialize();
}