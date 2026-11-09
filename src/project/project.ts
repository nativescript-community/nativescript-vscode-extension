import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as stream from 'stream';
import { EnvOverrides } from '../common/utilities';
import { NativeScriptCli } from './nativeScriptCli';
import * as scanner from './streamScanner';

export interface IDebugResult {
  tnsProcess: ChildProcess;
  tnsOutputEventEmitter: EventEmitter;
}

export interface DebugOptions {
  stopOnEntry: boolean;
  watch: boolean;
  launchTests: boolean;
}

export interface ProjectOptions {
  /** Working directory for CLI commands; defaults to the app root. */
  cwd?: string;
  env?: EnvOverrides;
}

export abstract class Project {
  private _appRoot: string;
  private _cli: NativeScriptCli;
  private _options: ProjectOptions;

  constructor(appRoot: string, cli: NativeScriptCli, options: ProjectOptions = {}) {
    this._appRoot = appRoot;
    this._cli = cli;
    this._options = options;
  }

  public get appRoot(): string {
    return this._appRoot;
  }

  public get cli(): NativeScriptCli {
    return this._cli;
  }

  public abstract platformName(): string;

  public run(tnsArgs?: string[]): ChildProcess {
    return this.executeCli(['run', this.platformName(), ...(tnsArgs ?? [])]);
  }

  public attach(tnsArgs?: string[]): IDebugResult {
    const args = ['--start', ...(tnsArgs ?? [])];
    return this.monitor(this.executeCli(['debug', this.platformName(), ...args]), args);
  }

  public debug(options: DebugOptions, tnsArgs?: string[]): IDebugResult {
    const args = [options.watch ? '--watch' : '--no-watch'];
    if (options.stopOnEntry) {
      args.push('--debug-brk');
    }
    args.push(...(tnsArgs ?? []));

    const command = options.launchTests ? 'test' : 'debug';
    return this.monitor(this.executeCli([command, this.platformName(), ...args]), args);
  }

  /**
   * Watches a running CLI process for debug port announcements. `args` are the CLI arguments it was started with
   * (used to tell whether it waits for a debugger before starting the app).
   */
  public monitor(child: ChildProcess, args: readonly string[]): IDebugResult {
    const tnsOutputEventEmitter = new EventEmitter();
    this.configureReadyEvent(child.stdout!, tnsOutputEventEmitter, args);
    return { tnsProcess: child, tnsOutputEventEmitter };
  }

  protected configureReadyEvent(
    readableStream: stream.Readable,
    eventEmitter: EventEmitter,
    _args: readonly string[],
  ): void {
    new scanner.StringMatchingScanner(readableStream).onEveryMatch('TypeScript compiler failed', () => {
      eventEmitter.emit('tsCompilationError');
    });
  }

  private executeCli(args: string[]): ChildProcess {
    return this._cli.execute(args, { cwd: this._options.cwd ?? this._appRoot, env: this._options.env });
  }
}
