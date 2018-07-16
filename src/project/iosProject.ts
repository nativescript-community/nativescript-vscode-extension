import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as stream from 'stream';
import { NativeScriptCli } from './nativeScriptCli';
import { IDebugResult, Project } from './project';
import * as scanner from './streamScanner';

export class IosProject extends Project {

    constructor(appRoot: string, cli: NativeScriptCli) {
        super(appRoot, cli);

        if (!this.isPlatformOSX()) {
            throw new Error('iOS platform is supported only on OS X.');
        }
    }

    public platformName(): string {
        return 'ios';
    }

    public attach(tnsArgs?: string[]): IDebugResult {
        let args: string[] = ['--start'];

        args = args.concat(tnsArgs);

        const debugProcess: ChildProcess = super.executeDebugCommand(args);
        const tnsOutputEventEmitter: EventEmitter = new EventEmitter();

        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter);

        return { tnsProcess: debugProcess, tnsOutputEventEmitter };
    }

    public debug(options: { stopOnEntry: boolean, watch: boolean }, tnsArgs?: string[]): IDebugResult {
        let args: string[] = [];

        args.push(options.watch ? '--watch' : '--no-watch');
        if (options.stopOnEntry) { args.push('--debug-brk'); }
        args = args.concat(tnsArgs);

        const debugProcess: ChildProcess = super.executeDebugCommand(args);
        const tnsOutputEventEmitter: EventEmitter = new EventEmitter();

        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter);

        return { tnsProcess: debugProcess, tnsOutputEventEmitter };
    }

    protected configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter): void {
        super.configureReadyEvent(readableStream, eventEmitter);

        const streamScanner = new scanner.StringMatchingScanner(readableStream);

        streamScanner.onEveryMatch(new RegExp('Opened localhost (.*)'), (match: scanner.IMatchFound) => {
            const port = parseInt(match.matches[1] as string, 10);

            setTimeout(() => { eventEmitter.emit('readyForConnection', port); }, 1000);
        });
    }

    private isPlatformOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}
