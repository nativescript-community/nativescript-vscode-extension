import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidProject } from '../project/androidProject';
import { NativeScriptCli } from '../project/nativeScriptCli';

const READY_DELAY_MS = 1000;
const APP_ROOT = '/projects/demo';

function createCli() {
  const stdout = new PassThrough();
  const proc = Object.assign(new EventEmitter(), { stdout, stderr: new PassThrough() });
  const execute = vi.fn((_args: string[], _cwd: string) => proc as unknown as ChildProcess);
  return { cli: { execute } as unknown as NativeScriptCli, execute, stdout, proc };
}

async function writeLine(stream: PassThrough, line: string): Promise<void> {
  stream.write(`${line}\n`);
  await vi.advanceTimersByTimeAsync(0);
}

describe('AndroidProject', () => {
  let fake: ReturnType<typeof createCli>;
  let ready: ReturnType<typeof vi.fn<(port: number) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = createCli();
    ready = vi.fn<(port: number) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds the debug command line', () => {
    const project = new AndroidProject(APP_ROOT, fake.cli);

    const result = project.debug({ stopOnEntry: false, watch: true, launchTests: false }, ['--device', 'emu']);

    expect(fake.execute).toHaveBeenCalledWith(['debug', 'android', '--watch', '--device', 'emu'], APP_ROOT);
    expect(result.tnsProcess).toBe(fake.proc);
  });

  it('uses ns test for launchTests and --debug-brk for stopOnEntry', () => {
    new AndroidProject(APP_ROOT, fake.cli).debug({ stopOnEntry: true, watch: false, launchTests: true });

    expect(fake.execute).toHaveBeenCalledWith(['test', 'android', '--no-watch', '--debug-brk'], APP_ROOT);
  });

  it('builds the attach command line', () => {
    new AndroidProject(APP_ROOT, fake.cli).attach(['--env.foo']);

    expect(fake.execute).toHaveBeenCalledWith(['debug', 'android', '--start', '--env.foo'], APP_ROOT);
  });

  it('announces the debug port one second after the CLI prints it', async () => {
    const { tnsOutputEventEmitter } = new AndroidProject(APP_ROOT, fake.cli).debug({
      stopOnEntry: false,
      watch: true,
      launchTests: false,
    });
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, 'Successfully installed on device with identifier emulator-5554.');
    await writeLine(fake.stdout, 'device: emulator-5554 debug port: 40000');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS - 1);
    expect(ready).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(ready).toHaveBeenCalledExactlyOnceWith(40000);
  });

  it('announces every new port after LiveSync restarts', async () => {
    const { tnsOutputEventEmitter } = new AndroidProject(APP_ROOT, fake.cli).attach();
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, 'device: emulator-5554 debug port: 40000');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);
    await writeLine(fake.stdout, 'device: emulator-5554 debug port: 40001');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);

    expect(ready.mock.calls).toEqual([[40000], [40001]]);
  });

  it.each([
    ['stopOnEntry', { stopOnEntry: true }, []],
    ['--debug-brk in tnsArgs', { stopOnEntry: false }, ['--debug-brk']],
  ])('with %s, waits for the debugger-started message', async (_label, options, tnsArgs) => {
    const { tnsOutputEventEmitter } = new AndroidProject(APP_ROOT, fake.cli).debug(
      { ...options, watch: false, launchTests: false },
      tnsArgs,
    );
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, 'device: emulator-5554 debug port: 40000');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS * 5);
    expect(ready).not.toHaveBeenCalled();

    await writeLine(fake.stdout, '# NativeScript Debugger started #');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);
    expect(ready).toHaveBeenCalledExactlyOnceWith(40000);
  });

  it('with --debug-brk, ignores a debugger-started message that precedes the debug port', async () => {
    const { tnsOutputEventEmitter } = new AndroidProject(APP_ROOT, fake.cli).debug({
      stopOnEntry: true,
      watch: false,
      launchTests: false,
    });
    tnsOutputEventEmitter.on('readyForConnection', ready);

    await writeLine(fake.stdout, '# NativeScript Debugger started #');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS * 2);
    expect(ready).not.toHaveBeenCalled();

    await writeLine(fake.stdout, 'device: emulator-5554 debug port: 40000');
    await writeLine(fake.stdout, '# NativeScript Debugger started #');
    await vi.advanceTimersByTimeAsync(READY_DELAY_MS);
    expect(ready).toHaveBeenCalledExactlyOnceWith(40000);
  });

  it('emits tsCompilationError on TypeScript failures', async () => {
    const { tnsOutputEventEmitter } = new AndroidProject(APP_ROOT, fake.cli).attach();
    const compilationError = vi.fn();
    tnsOutputEventEmitter.on('tsCompilationError', compilationError);

    await writeLine(fake.stdout, 'TypeScript compiler failed with exit code 1');

    expect(compilationError).toHaveBeenCalledOnce();
  });
});
