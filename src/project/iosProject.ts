import { EventEmitter } from 'events';
import * as stream from 'stream';
import { NativeScriptCli } from './nativeScriptCli';
import { Project, ProjectOptions } from './project';
import * as scanner from './streamScanner';

/** Delay before announcing a port, so the CLI's socket proxy is accepting connections. */
const PROXY_READY_DELAY_MS = 1000;

export class IosProject extends Project {
  constructor(appRoot: string, cli: NativeScriptCli, options?: ProjectOptions) {
    super(appRoot, cli, options);

    if (!this.isPlatformOSX()) {
      throw new Error('iOS platform is supported only on OS X.');
    }
  }

  public platformName(): string {
    return 'ios';
  }

  protected override configureReadyEvent(
    readableStream: stream.Readable,
    eventEmitter: EventEmitter,
    args: readonly string[],
  ): void {
    super.configureReadyEvent(readableStream, eventEmitter, args);

    new scanner.StringMatchingScanner(readableStream).onEveryMatch(
      new RegExp('Opened localhost (.*)'),
      (match: scanner.IMatchFound) => {
        const port = parseInt(match.matches[1] as string, 10);
        setTimeout(() => eventEmitter.emit('readyForConnection', port), PROXY_READY_DELAY_MS);
      },
    );
  }

  private isPlatformOSX(): boolean {
    return /^darwin/.test(process.platform);
  }
}
