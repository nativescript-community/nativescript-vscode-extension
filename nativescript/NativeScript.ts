import {exec, ChildProcess} from 'child_process';
import {WebKitConnection} from '../webkit/webKitConnection';
import {AndroidDebugConnection} from './android/AndroidDebugConnection';

export abstract class NSProject implements INSProject {
    private _projectPath: string;

    constructor(projectPath: string) {
        this._projectPath = projectPath;
    }

    public projectPath(): string {
        return this._projectPath;
    }

    public abstract platform(): string;

    public abstract debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void>;

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

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        let command: string = new CommandBuilder()
            .appendParam("debug")
            .appendParam(this.platform())
            .appendFlag("--emulator", args.emulator)
            .appendFlag("--start", args.request === "attach")
            .appendFlag("--debug-brk", args.request === "launch")
            .appendFlag("--no-client", true)
            .build();

        // run NativeScript CLI command
        return new Promise<void>((resolve, reject) => {
            let child: ChildProcess = exec(command, { cwd: this.projectPath() });
            child.stdout.on('data', function(data) {
                let strData: string = data.toString();
                console.log(data.toString());
                if (args.request === "launch" && strData.indexOf('NativeScript waiting for debugger.') > -1) {
                    resolve();
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

    public createConnection() : Promise<INSDebugConnection>
    {
        return Promise.resolve(new WebKitConnection());
    }

    public getDebugPort(): Promise<number>
    {
        return Promise.resolve(18181);
    }
}

export class AndoridProject extends NSProject {
    constructor(projectPath: string) {
        super(projectPath);
    }

    public platform(): string {
        return 'android';
    }

    public debug(args: IAttachRequestArgs | ILaunchRequestArgs): Promise<void> {
        if (args.request === "attach")
        {
            return Promise.resolve<void>();
        }
        else if (args.request === "launch")
        {
            //TODO: interaction with CLI here
            //throw new Error("Launch on Android not implemented");

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
            return new Promise<void>((resolve, reject) => {
                console.log("executing tns");
                let newEnv = process.env;
                let d;
                //newEnv["ANDROID_HOME"] = "d:\\adt-bundle-windows-x86_64-20140702\\sdk\\";
                let child: ChildProcess = exec(command, { cwd: this.projectPath() , env: newEnv });
                console.log("executed tns");
                child.stdout.on("data", function(data) {
                    console.log(data.toString());

                    // let strData: string = data.toString();
                    // if (options.debugBrk && strData.indexOf("Using ") > -1) {
                    //     console.log("resolving");
                    //     resolve();
                    // }
                });
                child.stderr.on("data", function(data) {
                    console.error(data.toString());
                });
                child.on("close", function(code) {
                    console.log("rejecting " + code);
                    reject(code);
                });
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