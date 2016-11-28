import {ChildProcess} from 'child_process';
import * as stream from 'stream';
import {EventEmitter} from 'events';
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
        let tnsOutputEventEmitter = new EventEmitter();
        setTimeout(() => tnsOutputEventEmitter.emit('readyForConnection')); // emit readyForConnection on the next tick
        return { tnsProcess: null, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    public debugWithSync(options: { stopOnEntry: boolean, syncAllFiles: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = ["--no-rebuild", "--watch"];
        if (options.syncAllFiles) { args.push("--syncAllFiles"); }
        args = args.concat(tnsArgs);

        return this.debug({stopOnEntry: options.stopOnEntry}, args);
    }

    public debug(options: { stopOnEntry: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = [];
        if (options.stopOnEntry) { args.push("--debug-brk"); }
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let tnsOutputEventEmitter: EventEmitter = new EventEmitter();
        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter);
        return { tnsProcess: debugProcess, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    public getDebugPortSync(): number {
        let output = this.cli.executeSync(["debug", "android", "--get--port"], this.appRoot);
        let port = parseInt(output.match("(?:debug port: )([\\d]{5})")[1]);
        return port;
    }

    private configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter): void {
        new scanner.StringMatchingScanner(readableStream).onEveryMatch('# NativeScript Debugger started #', (match: scanner.MatchFound) => {
            // wait a little before trying to connect, this gives a chance for adb to be able to connect to the debug socket
            setTimeout(() => { eventEmitter.emit('readyForConnection'); }, 500);
        });
    }
}
