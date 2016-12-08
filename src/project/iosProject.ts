import {ChildProcess} from 'child_process';
import * as stream from 'stream';
import {EventEmitter} from 'events';
import {Project, DebugResult} from './project';
import * as scanner from './streamScanner';
import {Version} from '../common/version';
import {NativeScriptCli} from './NativeScriptCli';

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

    public debugWithSync(options: { stopOnEntry: boolean, syncAllFiles: boolean }, tnsArgs?: string[]): DebugResult {
        let args: string[] = ["--watch"];
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

    private configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter): void {
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
