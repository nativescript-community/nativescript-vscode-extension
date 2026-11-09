import { EventEmitter } from 'events';
import * as stream from 'stream';
import { Project } from './project';
import * as scanner from './streamScanner';

/** Delay before announcing a port, so adb can connect to the debug socket first. */
const ADB_CONNECT_DELAY_MS = 1000;

export class AndroidProject extends Project {
  public platformName(): string {
    return 'android';
  }

  protected override configureReadyEvent(
    readableStream: stream.Readable,
    eventEmitter: EventEmitter,
    args: readonly string[],
  ): void {
    super.configureReadyEvent(readableStream, eventEmitter, args);

    // With --debug-brk the app only starts once the debugger banner is printed. `includes` also matches the flag
    // inside a wrapper option such as Nx's `--flags="--debug-brk"`.
    const waitForDebuggerStarted = args.some((arg) => arg.includes('--debug-brk'));
    let debugPort: number | null = null;

    new scanner.StringMatchingScanner(readableStream).onEveryMatch(
      new RegExp('device: .* debug port: [0-9]+'),
      (match: scanner.IMatchFound) => {
        debugPort = parseInt((match.matches[0] as string).match(/debug port: (\d+)/)![1], 10);
        if (!waitForDebuggerStarted) {
          setTimeout(() => eventEmitter.emit('readyForConnection', debugPort), ADB_CONNECT_DELAY_MS);
        }
      },
    );

    if (waitForDebuggerStarted) {
      new scanner.StringMatchingScanner(readableStream).onEveryMatch('# NativeScript Debugger started #', () => {
        if (debugPort === null) return;
        setTimeout(() => eventEmitter.emit('readyForConnection', debugPort), ADB_CONNECT_DELAY_MS);
      });
    }
  }
}
