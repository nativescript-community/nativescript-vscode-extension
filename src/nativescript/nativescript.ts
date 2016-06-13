import {exec, execSync, ChildProcess} from 'child_process';
import {EventEmitter} from 'events';
import * as path from 'path';
import * as https from 'https';
import {Logger} from '../webkit/utilities';
import {WebKitConnection} from '../webkit/webKitConnection';
import {AndroidDebugConnection} from './android/androidDebugConnection';
import {ILaunchRequestArgs, IAttachRequestArgs} from '../webkit/WebKitAdapterInterfaces';

export interface INSDebugConnection {
    on(eventName: string, handler: (msg: any) => void): void;

    close(): void;

    debugger_setBreakpointByUrl(url: string, lineNumber: number, columnNumber: number, condition?: string): Promise<WebKitProtocol.Debugger.SetBreakpointByUrlResponse>

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
}

export abstract class NSProject extends EventEmitter {
    private _projectPath: string;

    constructor(projectPath: string) {
        super();
        this._projectPath = projectPath;
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

        // build command to execute
        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .tryAppendParam("--emulator", args.emulator)
            .tryAppendParam("--start", args.request === "attach")
            .appendParam("--no-client")
            .appendParam(args.tnsArgs)
            .build();

        let socketPathPrefix = 'socket-file-location: ';
        let socketPathPattern: RegExp = new RegExp(socketPathPrefix + '.*\.sock');
        let readyToConnect: boolean = false;

        return new Promise<string>((resolve, reject) => {
            // run NativeScript CLI command
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });

            child.stdout.on('data', (data) => {
                let strData: string = data.toString();
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

class Version {
    public static parse(versionStr: string): number[] {
        if (versionStr === null) {
            return null;
        }
        let version: number[] = versionStr.split('.').map<number>((str, index, array) => parseInt(str));
        for(let i = version.length; i < 3; i++) {
            version.push(0);
        }
        return version;
    }

    public static stringify(version: number[]): string {
        return `${version[0]}.${version[1]}.${version[2]}`;
    }

    public static compareBySubminor(v1, v2): number {
        return (v1[0] - v2[0] != 0) ? (v1[0] - v2[0]) : (v1[1] - v2[1] != 0) ? v1[1] - v2[1] : v1[2] - v2[2];
    }
}

export class ExtensionVersionInfo {
    private static extensionVersion: number[] = null;
    private static minNativescriptCliVersion: number[] = null;
    private static extensionId: string = '8d837914-d8fa-45b5-965d-f76ebd6dbf5c';
    private static marketplaceQueryResult: Promise<any> = null;

    private latestVersionMeta: any;
    private timestamp: number;

    private static initVersionsFromPackageJson() {
        let packageJson = require('../../package.json');
        this.extensionVersion = Version.parse(packageJson.version);
        this.minNativescriptCliVersion = Version.parse(packageJson.minNativescriptCliVersion);
    }

    public static getExtensionVersion(): number[] {
        if (this.extensionVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.extensionVersion;
    }

    public static getMinSupportedNativeScriptVersion(): number[] {
        if (this.minNativescriptCliVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.minNativescriptCliVersion;
    }

    public static getMarketplaceExtensionData(): Promise<any> {
        if (this.marketplaceQueryResult == null) {
            this.marketplaceQueryResult = new Promise<any>((resolve, reject) => {
                let postData: string = `{ filters: [{ criteria: [{ filterType: 4, value: "${ExtensionVersionInfo.extensionId}" }] }], flags: 262 }`;

                let request = https.request({
                    hostname: 'marketplace.visualstudio.com',
                    path: '/_apis/public/gallery/extensionquery',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;api-version=2.2-preview.1',
                        'Content-Type': 'application/json',
                        'Transfer-Encoding': 'chunked',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, response => {
                    if (response.statusCode != 200) {
                        reject(`Unable to download data from Visual Studio Marketplace. Status code: ${response.statusCode}`);
                        return;
                    }
                    let body = '';
                    response.on('data', chunk => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        resolve(JSON.parse(body));
                    });
                });

                request.on('error', (e) => {
                    reject(e);
                });

                request.end(postData);
            });
        }
        return this.marketplaceQueryResult;
    }

    public static createFromMarketplace(): Promise<ExtensionVersionInfo> {
        return this.getMarketplaceExtensionData()
        .then(marketplaceData => {
            let latestVersion = null;
            try {
                if (marketplaceData.results[0].extensions[0].extensionId == ExtensionVersionInfo.extensionId) {
                    latestVersion = marketplaceData.results[0].extensions[0].versions[0];
                }
            } catch (e) { }
            return new ExtensionVersionInfo(latestVersion);
        });
    }

    constructor(latestVersionMeta: any, timestamp?: number) {
        this.latestVersionMeta = latestVersionMeta;
        this.timestamp = timestamp || Date.now();
    }

    public getLatestVersionMeta(): any {
        return this.latestVersionMeta;
    }

    public isLatest(): boolean {
        if (!this.getLatestVersionMeta()) {
            return true;
        }
        return Version.compareBySubminor(ExtensionVersionInfo.getExtensionVersion(), Version.parse(this.getLatestVersionMeta().version)) >= 0;
    }

    public getTimestamp(): number {
        return this.timestamp;
    }
}

export enum CliState {
    NotExisting,
    OlderThanSupported,
    Compatible
}

export class CliVersionInfo {
    private static installedCliVersion: number[] = null;

    private _state: CliState;

    public static getInstalledCliVersion(): number[] {
        if (this.installedCliVersion === null) {
            // get the currently installed CLI version
            let getVersionCommand: string = new CommandBuilder().appendParam('--version').build(); // tns --version
            try {
                let versionStr: string = execSync(getVersionCommand).toString().trim(); // execute it
                this.installedCliVersion = versionStr ? Version.parse(versionStr) : null; // parse the version string
            } catch(e) {
                this.installedCliVersion = null;
            }
        }

        return this.installedCliVersion;
    }

    constructor() {
        let installedCliVersion: number[] = CliVersionInfo.getInstalledCliVersion();
        if (installedCliVersion === null) {
            this._state = CliState.NotExisting;
        }
        else {
            let minSupportedCliVersion = ExtensionVersionInfo.getMinSupportedNativeScriptVersion();
            this._state = Version.compareBySubminor(installedCliVersion, minSupportedCliVersion) < 0 ? CliState.OlderThanSupported : CliState.Compatible;
        }
    }

    public getState(): CliState {
        return this._state;
    }

    public isCompatible(): boolean {
        return this._state === CliState.Compatible;
    }

    public getErrorMessage(): string {
        switch (this._state) {
            case CliState.NotExisting:
                return `NativeScript CLI not found, please run 'npm install –g nativescript' to install it.`;
            case CliState.OlderThanSupported:
                return `The existing NativeScript extension is compatible with NativeScript CLI v${Version.stringify(ExtensionVersionInfo.getMinSupportedNativeScriptVersion())} or greater. The currently installed NativeScript CLI is v${Version.stringify(CliVersionInfo.getInstalledCliVersion())}. You can update the NativeScript CLI by executing 'npm install -g nativescript'.`;
            default:
                return null;
        }
    }
}