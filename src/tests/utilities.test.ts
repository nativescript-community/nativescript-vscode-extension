import * as fs from 'fs';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { LogLevel } from '../common/logger';
import { killProcess, quoteShellArg, resolveEnv, spawnInShell } from '../common/utilities';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>();
  return { ...original, platform: vi.fn(original.platform) };
});

const originalPlatform = process.platform;
const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', { value: platform });
  vi.mocked(os.platform).mockReturnValue(platform);
};

afterEach(() => {
  setPlatform(originalPlatform);
  vi.unstubAllEnvs();
});

describe('resolveEnv', () => {
  it('layers overrides over process.env, deleting null values and ignoring undefined ones', () => {
    vi.stubEnv('NS_TEST_REMOVE', 'remove-me');
    vi.stubEnv('NS_TEST_KEEP', 'keep-me');

    const env = resolveEnv({ NS_TEST_REMOVE: null, NS_TEST_ADD: 'added', NS_TEST_KEEP: undefined });

    expect(env).not.toHaveProperty('NS_TEST_REMOVE');
    expect(env.NS_TEST_ADD).toBe('added');
    expect(env.NS_TEST_KEEP).toBe('keep-me');
    expect(process.env.NS_TEST_REMOVE).toBe('remove-me');
    expect(process.env).not.toHaveProperty('NS_TEST_ADD');
  });

  it('returns a copy of process.env without overrides', () => {
    const env = resolveEnv();

    expect(env).toEqual(process.env);
    expect(env).not.toBe(process.env);
  });
});

describe('quoteShellArg', () => {
  describe('POSIX', () => {
    it.each(['ns', '--env.foo=bar', '/usr/local/bin/ns', 'user@host:8080,a+b', '50%'])('leaves %j bare', (arg) => {
      expect(quoteShellArg(arg, 'darwin')).toBe(arg);
    });

    it.each([
      ['with space', "'with space'"],
      ["it's", "'it'\\''s'"],
      ['$HOME', "'$HOME'"],
      ['a;b', "'a;b'"],
      ['"double"', `'"double"'`],
      ['', "''"],
      ['=foo', "'=foo'"],
    ])('quotes %j as %s', (arg, expected) => {
      expect(quoteShellArg(arg, 'linux')).toBe(expected);
    });

    it.skipIf(!fs.existsSync('/bin/zsh'))('round-trips through zsh, which expands a leading =', () => {
      const args = ['=foo', '--env.a=b', 'with space', '~'];
      const script = `printf '%s\\n' ${args.map((arg) => quoteShellArg(arg)).join(' ')}`;

      const output = childProcess.execFileSync('/bin/zsh', ['-c', script], { encoding: 'utf8' });

      expect(output.split('\n').slice(0, -1)).toEqual(args);
    });

    it.skipIf(process.platform === 'win32')('round-trips through /bin/sh as single arguments', () => {
      const args = ['plain', 'with space', "it's", '$HOME', '`id`', 'a;b|c&d', '*', '"x"', '\\n', ''];
      const script = `printf '%s\\n' ${args.map((arg) => quoteShellArg(arg)).join(' ')}`;

      const output = childProcess.execFileSync('/bin/sh', ['-c', script], { encoding: 'utf8' });

      expect(output.split('\n').slice(0, -1)).toEqual(args);
    });
  });

  describe('win32', () => {
    it.each(['ns', 'C:\\Program_Files\\ns.cmd', '--env.foo=bar', 'user@host:8080'])('leaves %j bare', (arg) => {
      expect(quoteShellArg(arg, 'win32')).toBe(arg);
    });

    it.each([
      ['C:\\Program Files\\ns.cmd', '"C:\\Program Files\\ns.cmd"'],
      ['say "hi"', '"say ""hi"""'],
      ['%PATH%', '"%PATH%"'],
      ["it's", `"it's"`],
      ['', '""'],
    ])('quotes %j as %s', (arg, expected) => {
      expect(quoteShellArg(arg, 'win32')).toBe(expected);
    });
  });
});

describe('spawnInShell', () => {
  let child: EventEmitter & { stdout: { setEncoding: Mock }; stderr: { setEncoding: Mock } };

  beforeEach(() => {
    child = Object.assign(new EventEmitter(), {
      stdout: { setEncoding: vi.fn() },
      stderr: { setEncoding: vi.fn() },
    });
    vi.mocked(childProcess.spawn).mockReturnValue(child as unknown as childProcess.ChildProcess);
  });

  it('runs the command line through $SHELL in its own process group with utf8 output', () => {
    setPlatform('darwin');
    vi.stubEnv('SHELL', '/bin/zsh');
    vi.stubEnv('NS_TEST_DROP', 'x');

    const result = spawnInShell('ns debug android', { cwd: '/projects/demo', env: { NS_TEST_DROP: null, FOO: 'bar' } });

    expect(result).toBe(child);
    const [commandLine, options] = vi.mocked(childProcess.spawn).mock.lastCall! as unknown as [
      string,
      childProcess.SpawnOptions,
    ];
    expect(commandLine).toBe('ns debug android');
    expect(options).toMatchObject({ cwd: '/projects/demo', shell: '/bin/zsh', detached: true, windowsHide: true });
    expect(options.env).toMatchObject({ FOO: 'bar' });
    expect(options.env).not.toHaveProperty('NS_TEST_DROP');
    expect(child.stdout.setEncoding).toHaveBeenCalledWith('utf8');
    expect(child.stderr.setEncoding).toHaveBeenCalledWith('utf8');
  });

  it('falls back to the default shell when $SHELL is unset', () => {
    setPlatform('linux');
    vi.stubEnv('SHELL', undefined);

    spawnInShell('ns', { cwd: '/tmp' });

    expect(vi.mocked(childProcess.spawn).mock.lastCall![1]).toMatchObject({ shell: true });
  });

  it('uses cmd.exe without a detached process group on Windows', () => {
    setPlatform('win32');
    vi.stubEnv('SHELL', '/usr/bin/bash');

    spawnInShell('ns', { cwd: 'C:\\demo' });

    expect(vi.mocked(childProcess.spawn).mock.lastCall![1]).toMatchObject({ shell: 'cmd.exe', detached: false });
  });
});

describe('killProcess', () => {
  let logger: { log: Mock };
  let processKill: MockInstance<typeof process.kill>;
  const createChild = (pid: number | undefined) => ({ pid, kill: vi.fn(() => true) });

  beforeEach(() => {
    logger = { log: vi.fn() };
    processKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
  });

  it('does nothing without a pid', () => {
    const child = createChild(undefined);

    killProcess(child as unknown as childProcess.ChildProcess, logger);

    expect(processKill).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('signals the whole process group with SIGINT by default', () => {
    setPlatform('darwin');
    const child = createChild(1234);

    killProcess(child as unknown as childProcess.ChildProcess, logger);

    expect(processKill).toHaveBeenCalledExactlyOnceWith(-1234, 'SIGINT');
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('passes a custom signal', () => {
    setPlatform('linux');

    killProcess(createChild(1234) as unknown as childProcess.ChildProcess, logger, 'SIGKILL');

    expect(processKill).toHaveBeenCalledWith(-1234, 'SIGKILL');
  });

  it('falls back to signalling the child when it is not a group leader', () => {
    setPlatform('linux');
    processKill.mockImplementation(() => {
      throw new Error('ESRCH');
    });
    const child = createChild(1234);

    killProcess(child as unknown as childProcess.ChildProcess, logger, 'SIGTERM');

    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    expect(logger.log).not.toHaveBeenCalledWith(expect.anything(), LogLevel.Error);
  });

  it('logs when the fallback also fails', () => {
    setPlatform('linux');
    processKill.mockImplementation(() => {
      throw new Error('ESRCH');
    });
    const child = createChild(1234);
    child.kill.mockImplementation(() => {
      throw new Error('EPERM');
    });

    expect(() => killProcess(child as unknown as childProcess.ChildProcess, logger)).not.toThrow();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('EPERM'), LogLevel.Error);
  });

  it('kills the process tree with taskkill on Windows', () => {
    setPlatform('win32');
    const child = createChild(1234);

    killProcess(child as unknown as childProcess.ChildProcess, logger);

    expect(childProcess.execSync).toHaveBeenCalledExactlyOnceWith('taskkill /pid 1234 /T /F');
    expect(processKill).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('logs a taskkill failure', () => {
    setPlatform('win32');
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error('taskkill failed');
    });

    killProcess(createChild(1234) as unknown as childProcess.ChildProcess, logger);

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('taskkill failed'), LogLevel.Error);
  });
});
