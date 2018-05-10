import {ChildProcess} from 'child_process';
import * as stream from 'stream';
import {EventEmitter} from 'events';
import {Project, DebugResult} from './project';
import * as scanner from './streamScanner';
import {Version} from '../common/version';
import {NativeScriptCli} from './nativeScriptCli';

export type GetDebugPortResult = { tnsProcess: ChildProcess, debugPort: Promise<number> };

export class AndroidProject extends Project {

    constructor(appRoot: string, cli: NativeScriptCli) {
        super(appRoot, cli);
    }

    public platformName(): string {
        return "android";
    }

    public attach(tnsArgs?: string[]): DebugResult {
        let args: string[] = ["--start"];
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let tnsOutputEventEmitter = new EventEmitter();
        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter, true);
        return { tnsProcess: debugProcess, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    public debug(options: { stopOnEntry: boolean, watch: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = [];
        args.push(options.watch ? "--watch" : "--no-watch");
        if (options.stopOnEntry) { args.push("--debug-brk"); }
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let tnsOutputEventEmitter: EventEmitter = new EventEmitter();
        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter, false);
        return { tnsProcess: debugProcess, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    protected configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter, attach?: boolean): void {
        super.configureReadyEvent(readableStream, eventEmitter);

        let debugPort = null;
        new scanner.StringMatchingScanner(readableStream).onEveryMatch(new RegExp("device: .* debug port: [0-9]+"), (match: scanner.MatchFound) => {
            //device: {device-name} debug port: {debug-port}
            debugPort = parseInt((<string>match.matches[0]).match("(?:debug port: )([\\d]{5})")[1]);
            if (attach) {
                // wait a little before trying to connect, this gives a chance for adb to be able to connect to the debug socket
                setTimeout(() => { eventEmitter.emit('readyForConnection', debugPort); }, 1000);
            }
        });
        if (!attach) {
            new scanner.StringMatchingScanner(readableStream).onEveryMatch('# NativeScript Debugger started #', (match: scanner.MatchFound) => {
                // wait a little before trying to connect, this gives a chance for adb to be able to connect to the debug socket
                setTimeout(() => { eventEmitter.emit('readyForConnection', debugPort); }, 1000);
            });
        }
    }
}
