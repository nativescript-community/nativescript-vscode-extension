import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as semver from 'semver';
import * as stream from 'stream';
import { NativeScriptCli } from './nativeScriptCli';
import { IDebugResult, Project } from './project';
import * as scanner from './streamScanner';

export class AndroidProject extends Project {
    private cliVersion: string;

    constructor(appRoot: string, cli: NativeScriptCli) {
        super(appRoot, cli);
        this.cliVersion = cli.executeGetVersion();
    }

    public platformName(): string {
        return 'android';
    }

    public attach(tnsArgs?: string[]): IDebugResult {
        let args: string[] = ['--start'];

        args = args.concat(tnsArgs);

        const debugProcess: ChildProcess = super.executeDebugCommand(args);
        const tnsOutputEventEmitter = new EventEmitter();

        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter, false);

        return { tnsProcess: debugProcess, tnsOutputEventEmitter };
    }

    public debug(options: { stopOnEntry: boolean, watch: boolean, launchTests: boolean }, tnsArgs?: string[]): IDebugResult {
        let args: string[] = [];

        args.push(options.watch ? '--watch' : '--no-watch');
        if (options.stopOnEntry) { args.push('--debug-brk'); }
        args = args.concat(tnsArgs);

        const debugProcess: ChildProcess = options.launchTests ?
            super.executeTestCommand(args) : super.executeDebugCommand(args);
        const tnsOutputEventEmitter: EventEmitter = new EventEmitter();
        // const shouldWaitAfterRestartMessage = semver.lt(semver.coerce(this.cliVersion), '5.1.0');
        // const waitForRestartMessage = shouldWaitAfterRestartMessage || args.indexOf('--debug-brk') > -1;
        const waitForRestartMessage = args.indexOf('--debug-brk') > -1;

        this.configureReadyEvent(debugProcess.stdout, tnsOutputEventEmitter, waitForRestartMessage);

        return { tnsProcess: debugProcess, tnsOutputEventEmitter };
    }

    protected configureReadyEvent(readableStream: stream.Readable, eventEmitter: EventEmitter, waitForRestartMessage?: boolean): void {
        super.configureReadyEvent(readableStream, eventEmitter);
        let debugPort = null;

        new scanner.StringMatchingScanner(readableStream).onEveryMatch(new RegExp('device: .* debug port: [0-9]+'), (match: scanner.IMatchFound) => {
            // device: {device-name} debug port: {debug-port}
            debugPort = parseInt((match.matches[0] as string).match('(?:debug port: )([\\d]{5})')[1], 10);
            if (!waitForRestartMessage) {
                setTimeout(() => { eventEmitter.emit('readyForConnection', debugPort); }, 1000);
            }
        });
        if (waitForRestartMessage) {
            new scanner.StringMatchingScanner(readableStream).onEveryMatch('# NativeScript Debugger started #', (match: scanner.IMatchFound) => {
                // wait a little before trying to connect, this gives a chance for adb to be able to connect to the debug socket
                setTimeout(() => { eventEmitter.emit('readyForConnection', debugPort); }, 1000);
            });
        }
    }
}
