import {ChildProcess} from 'child_process';
import * as stream from 'stream';
import {EventEmitter} from 'events';
import {Project, DebugResult} from './project';
import * as scanner from './streamScanner';
import {Version} from '../common/version';
import {NativeScriptCli} from './nativeScriptCli';
import {Services} from '../services/debugAdapterServices';
import {Tags} from '../common/logger';

export class IosProject extends Project {

    constructor(appRoot: string, cli: NativeScriptCli) {
        super(appRoot, cli);

        if (!this.isPlatformOSX()) {
            throw new Error('iOS platform is supported only on OS X.');
        }
    }

    public platformName(): string {
        return "ios";
    }

    public attach(tnsArgs?: string[]): DebugResult {
        let args: string[] = ["--start"];
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let tnsOutputEventEmitter: EventEmitter = new EventEmitter();
        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter);
        return { tnsProcess: debugProcess, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    public debug(options: { stopOnEntry: boolean, watch: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = [];
        args.push(options.watch ? "--watch" : "--no-watch");
        if (options.stopOnEntry) { args.push("--debug-brk"); }
        args = args.concat(tnsArgs);

        let debugProcess : ChildProcess = super.executeDebugCommand(args);
        let tnsOutputEventEmitter: EventEmitter = new EventEmitter();
        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter);
        return { tnsProcess: debugProcess, tnsOutputEventEmitter: tnsOutputEventEmitter };
    }

    protected configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter): void {
        super.configureReadyEvent(readableStream, eventEmitter);

        let socketPathPrefix = 'socket-file-location: ';
        let streamScanner = new scanner.StringMatchingScanner(readableStream);
        streamScanner.onEveryMatch(new RegExp(socketPathPrefix + '.*\.sock'), (match: scanner.MatchFound) => {
            let socketPath = (<string>match.matches[0]).substr(socketPathPrefix.length);
            eventEmitter.emit('readyForConnection', socketPath);
        });
    }

    private isPlatformOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}
