import {spawn, execSync, ChildProcess} from 'child_process';
import * as fs from 'fs';
import {EventEmitter} from 'events';
import * as path from 'path';
import * as https from 'https';
import {Version} from '../common/Version';
import {Logger} from '../debug-adapter/utilities';
import {ILaunchRequestArgs, IAttachRequestArgs} from '../debug-adapter/WebKitAdapterInterfaces';
import {ExtensionVersionInfo} from './ExtensionVersionInfo';

export enum CliVersionState {
    NotExisting,
    OlderThanSupported,
    Compatible
}

export class CliVersionInfo {
    private static installedCliVersion: number[] = null;

    private _state: CliVersionState;

    public static getInstalledCliVersion(): number[] {
        if (this.installedCliVersion === null) {
            // get the currently installed CLI version
            let getVersionCommand: string = new CommandBuilder().appendParam('--version').buildAsString(); // tns --version
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
            this._state = CliVersionState.NotExisting;
        }
        else {
            let minSupportedCliVersion = ExtensionVersionInfo.getMinSupportedNativeScriptVersion();
            this._state = Version.compareBySubminor(installedCliVersion, minSupportedCliVersion) < 0 ? CliVersionState.OlderThanSupported : CliVersionState.Compatible;
        }
    }

    public getState(): CliVersionState {
        return this._state;
    }

    public isCompatible(): boolean {
        return this._state === CliVersionState.Compatible;
    }

    public getErrorMessage(): string {
        switch (this._state) {
            case CliVersionState.NotExisting:
                return `NativeScript CLI not found, please run 'npm install –g nativescript' to install it.`;
            case CliVersionState.OlderThanSupported:
                return `The existing NativeScript extension is compatible with NativeScript CLI v${Version.stringify(ExtensionVersionInfo.getMinSupportedNativeScriptVersion())} or greater. The currently installed NativeScript CLI is v${Version.stringify(CliVersionInfo.getInstalledCliVersion())}. You can update the NativeScript CLI by executing 'npm install -g nativescript'.`;
            default:
                return null;
        }
    }
}

export abstract class NSProject extends EventEmitter {
    private _projectPath: string;
    private _tnsOutputFileStream: fs.WriteStream;
    private _cliVersionInfo: CliVersionInfo;

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super();
        this._projectPath = projectPath;
        this._tnsOutputFileStream = tnsOutputFilePath ? fs.createWriteStream(tnsOutputFilePath) : null;
        this._cliVersionInfo = new CliVersionInfo();
    }

    public getProjectPath(): string {
        return this._projectPath;
    }

    public getCliVersionInfo() {
        return this._cliVersionInfo;
    }

    public abstract platform(): string;

    public abstract run(emulator: boolean): Promise<ChildProcess>;

    public abstract debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<any>;

    protected spawnProcess(commandPath: string, commandArgs: string[], tnsOutput?: string): ChildProcess {
        let options = { cwd: this.getProjectPath(), shell: true };
        let child: ChildProcess = spawn(commandPath, commandArgs, options);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        return child;
    }

    protected writeToTnsOutputFile(message: string) {
        if (this._tnsOutputFileStream) {
            this._tnsOutputFileStream.write(message, 'utf8');
        }
    }
}

export class IosProject extends NSProject {

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super(projectPath, tnsOutputFilePath);
    }

    public platform(): string {
        return 'ios';
    }

    public run(emulator: boolean): Promise<ChildProcess> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is only supported on OS X.');
        }

        // build command to execute
        let command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .appendParamIf("--emulator", emulator)
            .build();

        let child: ChildProcess = this.spawnProcess(command.path, command.args);
        return Promise.resolve(child);
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<string> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is supported only on OS X.');
        }

        // build command to execute
        let command = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParamIf("--emulator", args.emulator)
            .appendParamIf("--start", args.request === "attach")
            .appendParamIf("--debug-brk", args.request === "launch")
            .appendParam("--no-client")
            .appendParams(args.tnsArgs)
            .build();

        let socketPathPrefix = 'socket-file-location: ';
        let socketPathPattern: RegExp = new RegExp(socketPathPrefix + '.*\.sock');
        let readyToConnect: boolean = false;

        return new Promise<string>((resolve, reject) => {
            // run NativeScript CLI command
            let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);

            child.stdout.on('data', (data) => {
                let strData: string = data.toString();
                this.emit('TNS.outputMessage', strData, 'log');
                this.writeToTnsOutputFile(strData);
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
                this.writeToTnsOutputFile(data);
            });

            child.on('close', (code, signal) => {
                reject("The debug process exited unexpectedly code:" + code);
            });
        });
    }

    private isOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}

export class AndroidProject extends NSProject {

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super(projectPath, tnsOutputFilePath);
    }

    public platform(): string {
        return 'android';
    }

    public run(emulator: boolean): Promise<ChildProcess> {
        // build command to execute
        let command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .appendParamIf("--emulator", emulator)
            .build();

        let child: ChildProcess = this.spawnProcess(command.path, command.args);
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
                let command = new CommandBuilder()
                    .appendParam("debug")
                    .appendParam(this.platform())
                    .appendParamIf("--emulator", args.emulator)
                    .appendParam("--debug-brk")
                    .appendParam("--no-client")
                    .appendParams(args.tnsArgs)
                    .build();

                Logger.log("tns  debug command: " + command);

                // run NativeScript CLI command
                let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);
                child.stdout.on('data', function(data) {
                    let strData: string = data.toString();
                    that.emit('TNS.outputMessage', data.toString(), 'log');
                    that.writeToTnsOutputFile(strData);
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
                    that.writeToTnsOutputFile(data);
                });

                child.on('close', function(code) {
                    reject("The debug process exited unexpectedly code:" + code);
                });
            });
         }
    }

    public getDebugPort(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<number> {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);

        //return Promise.resolve(40001);

        let command = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParam("--get-port")
            .appendParams(args.tnsArgs)
            .build();
        let that = this;
        // run NativeScript CLI command
        return new Promise<number>((resolve, reject) => {
            let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);

            child.stdout.on('data', function(data) {
                that.emit('TNS.outputMessage', data.toString(), 'log');
                that.writeToTnsOutputFile(data);

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
                that.writeToTnsOutputFile(data);
            });

            child.on('close', function(code) {
                reject("Getting debug port failed with code: " + code);
            });
        });
    }
}

class CommandBuilder {
    public static tnsPath: string = 'tns';

    private _command: string[] = [];

    public appendParam(parameter: string): CommandBuilder {
        this._command.push(parameter);
        return this;
    }

    public appendParams(parameters: string[] = []): CommandBuilder {
        parameters.forEach(param => this.appendParam(param));
        return this;
    }

    public appendParamIf(parameter: string, condtion: boolean): CommandBuilder {
        if (condtion) {
            this._command.push(parameter);
        }
        return this;
    }

    public build(): { path: string, args: string[] } {
        return { path: CommandBuilder.tnsPath, args: this._command };
    }

    public buildAsString(): string {
        let result = this.build();
        return `${result.path} ` + result.args.join(' ');
    }
}