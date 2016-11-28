import {ChildProcess} from 'child_process';
import * as stream from 'stream';
import {Project, DebugResult} from './project';
import * as scanner from './streamScanner';
import {Version} from '../common/version';
import {NativeScriptCli} from './NativeScriptCli';

export type GetDebugPortResult = { tnsProcess: ChildProcess, debugPort: Promise<number> };

export class AndroidProject extends Project {

    constructor(appRoot: string, cli: NativeScriptCli) {
        super(appRoot, cli);
    }

    public platformName(): string {
        return "android";
    }

    public attach(tnsArgs?: string[]): DebugResult {
        return { tnsProcess: null, backendIsReadyForConnection: this.getDebugPort().debugPort };
    }

    public debugWithSync(options: { stopOnEntry: boolean, syncAllFiles: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = ["--no-rebuild"];
        if (options.syncAllFiles) { args.push("--syncAllFiles"); }
        args = args.concat(tnsArgs);

        return this.debug({stopOnEntry: options.stopOnEntry}, args);
    }

    public debug(options: { stopOnEntry: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = [];
        if (options.stopOnEntry) { args.push("--debug-brk"); }
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let backendIsReady = new scanner.StringMatchingScanner(debugProcess.stdout).nextMatch('# NativeScript Debugger started #').then(_ => {
            // wait a little before trying to connect, this gives a chance for adb to be able to connect to the debug socket
            return new Promise((resolve, reject) => setTimeout(() => { resolve(); }, 500));
        }).then(() => this.getDebugPort().debugPort);

        return { tnsProcess: debugProcess, backendIsReadyForConnection: backendIsReady };
    }

    private getDebugPort(): GetDebugPortResult {
        let debugProcess : ChildProcess = super.executeDebugCommand(["--get-port"]);
        let portNumberPromise: Promise<number> = this.waitForPortNumber(debugProcess.stdout);
        return  { tnsProcess: debugProcess, debugPort: portNumberPromise };
    }

    private waitForPortNumber(readableStream: stream.Readable): Promise<number> {
        let streamScanner = new scanner.StringMatchingScanner(readableStream);
        return streamScanner.nextMatch(new RegExp("(?:debug port: )([\\d]{5})")).then((match: scanner.MatchFound) => {
            let portNumber = parseInt(<string>match.matches[1]);
            streamScanner.stop();
            return portNumber;
        });
    }
}
