import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IosProject } from '../project/iosProject';
import { ShellSpawnOptions } from '../common/utilities';
import { NativeScriptCli } from '../project/nativeScriptCli';

const READY_DELAY_MS = 1000;
const APP_ROOT = '/projects/demo';
const DEFAULT_OPTIONS: ShellSpawnOptions = { cwd: APP_ROOT, env: undefined };

function createCli() {
  const stdout = new PassThrough();
  const proc = Object.assign(new EventEmitter(), { stdout, stderr: new PassThrough() });
  const execute = vi.fn((_args: string[], _options: ShellSpawnOptions) => proc as unknown as ChildProcess);
  return { cli: { execute } as unknown as NativeScriptCli, execute, stdout, proc };
}

async function writeLine(stream: PassThrough, line: string): Promise<void> {
  stream.write(`${line}\n`);
  await vi.advanceTimersByTimeAsync(0);
}

describe('IosProject', () => {
  let fake: ReturnType<typeof createCli>;
  let ready: ReturnType<typeof vi.fn<(port: number) => void>>;
  const originalPlatform = process.platform;
  const setPlatform = (platform: string) => Object.defineProperty(process, 'platform', { value: platform });

  beforeEach(() => {
    vi.useFakeTimers();
    setPlatform('darwin');
    fake = createCli();
    ready = vi.fn<(port: number) => void>();
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    vi.useRealTimers();
  });

  it('refuses to run outside macOS', () => {
    setPlatform('linux');
    expect(() => new IosProject(APP_ROOT, fake.cli)).toThrow('iOS platform is supported only on OS X.');
  });

  it('builds the debug and attach command lines', () => {
    const project = new IosProject(APP_ROOT, fake.cli);

    project.debug({ stopOnEntry: true, watch: true, launchTests: false }, ['--teamId', 'ABC']);
    project.attach(['--env.foo']);

    expect(fake.execute.mock.calls).toEqual([
      [['debug', 'ios', '--watch', '--debug-brk', '--teamId', 'ABC'], DEFAULT_OPTIONS],
      [['debug', 'ios', '--start', '--env.foo'], DEFAULT_OPTIONS],
    ]);
  });

  it('runs commands in the configured cwd with the configured env', () => {
    new IosProject(APP_ROOT, fake.cli, { cwd: '/repo', env: { FOO: 'bar' } }).attach();

    expect(fake.execute).toHaveBeenCalledWith(['debug', 'ios', '--start'], { cwd: '/repo', env: { FOO: 'bar' } });
  });

  it('monitor watches an externally started process', async () => {
    const { tnsOutputEventEmitter } = new IosProject(APP_ROOT, fake.cli).monitor(
      fake.proc as unknown as ChildProcess,
      [],
    );
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, 'Opened localhost 41000');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);

    expect(ready).toHaveBeenCalledExactlyOnceWith(41000);
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it('announces the port from "Opened localhost" one second later', async () => {
    const { tnsOutputEventEmitter } = new IosProject(APP_ROOT, fake.cli).debug({
      stopOnEntry: false,
      watch: true,
      launchTests: false,
    });
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, 'Opened localhost 41000');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS - 1);
    expect(ready).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(ready).toHaveBeenCalledExactlyOnceWith(41000);

    await writeLine(fake.stdout, 'Opened localhost 41001');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);
    expect(ready).toHaveBeenLastCalledWith(41001);
  });
});
