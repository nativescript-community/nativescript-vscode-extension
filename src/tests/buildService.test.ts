import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ILogger } from '../common/logger';
import { AnalyticsService } from '../analytics/analyticsService';
import * as utils from '../common/utilities';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { IDebugResult } from '../project/project';
import { BuildArgs, BuildService, BuildSession, CLI_EXIT_TIMEOUT_MS } from '../services/buildService';
import { services } from '../services/extensionHostServices';
import { iOSTeamService } from '../services/iOSTeamService';

const projects = vi.hoisted(() => ({
  created: [] as Array<{ platform: string; appRoot: string }>,
  debug:
    vi.fn<
      (options: { stopOnEntry: boolean; watch: boolean; launchTests: boolean }, tnsArgs?: string[]) => IDebugResult
    >(),
  attach: vi.fn<(tnsArgs?: string[]) => IDebugResult>(),
}));

vi.mock('../project/iosProject', () => ({
  IosProject: class {
    public debug = projects.debug;
    public attach = projects.attach;
    constructor(appRoot: string) {
      projects.created.push({ platform: 'ios', appRoot });
    }
  },
}));

vi.mock('../project/androidProject', () => ({
  AndroidProject: class {
    public debug = projects.debug;
    public attach = projects.attach;
    constructor(appRoot: string) {
      projects.created.push({ platform: 'android', appRoot });
    }
  },
}));

vi.mock('../common/utilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../common/utilities')>()),
  killProcess: vi.fn(),
}));

function createFakeProcess() {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid: 4242,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: vi.fn((_signal?: NodeJS.Signals) => true),
  });
}

type FakeProcess = ReturnType<typeof createFakeProcess>;

function createDebugResult(proc: FakeProcess = createFakeProcess()) {
  const tnsOutputEventEmitter = new EventEmitter();
  const result: IDebugResult = { tnsProcess: proc as unknown as ChildProcess, tnsOutputEventEmitter };
  return { proc, tnsOutputEventEmitter, result };
}

const nextTick = () => new Promise<void>((resolve) => process.nextTick(resolve));

describe('BuildSession', () => {
  let logger: { log: Mock<ILogger['log']> };

  beforeEach(() => {
    logger = { log: vi.fn<ILogger['log']>() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards stdout and stderr to the logger', async () => {
    const { proc, result } = createDebugResult();
    new BuildSession(result, logger);

    proc.stdout.write('building...\n');
    proc.stderr.write('warning\n');
    await nextTick();

    expect(logger.log).toHaveBeenCalledWith('building...\n');
    expect(logger.log).toHaveBeenCalledWith('warning\n');
  });

  it('resolves initialPort with the first announced port, parsing string tokens', async () => {
    const { tnsOutputEventEmitter, result } = createDebugResult();
    const session = new BuildSession(result, logger);
    const newPort = vi.fn();
    session.on('newPort', newPort);

    tnsOutputEventEmitter.emit('readyForConnection', '40000');

    await expect(session.initialPort).resolves.toBe(40000);
    expect(newPort).not.toHaveBeenCalled();
  });

  it('emits newPort for later ports and drops repeats within the duplicate window', () => {
    vi.useFakeTimers();
    const { tnsOutputEventEmitter, result } = createDebugResult();
    const session = new BuildSession(result, logger);
    const newPort = vi.fn();
    session.on('newPort', newPort);

    tnsOutputEventEmitter.emit('readyForConnection', 40000);
    vi.advanceTimersByTime(1000);
    tnsOutputEventEmitter.emit('readyForConnection', 40000);
    expect(newPort).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    tnsOutputEventEmitter.emit('readyForConnection', 41000);
    expect(newPort).toHaveBeenCalledExactlyOnceWith(41000);

    vi.advanceTimersByTime(1999);
    tnsOutputEventEmitter.emit('readyForConnection', 41000);
    expect(newPort).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(2001);
    tnsOutputEventEmitter.emit('readyForConnection', 42000);
    expect(newPort).toHaveBeenLastCalledWith(42000);
    expect(newPort).toHaveBeenCalledTimes(2);
  });

  it('resolves initialPort with undefined and emits closed once when the process exits first', async () => {
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);
    const closed = vi.fn();
    session.on('closed', closed);

    proc.emit('close', 1);
    proc.emit('close', 1);

    await expect(session.initialPort).resolves.toBeUndefined();
    expect(closed).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('emits closed with a null code when the process fails to spawn', async () => {
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);
    const closed = vi.fn();
    session.on('closed', closed);

    proc.emit('error', new Error('spawn ns ENOENT'));

    await expect(session.initialPort).resolves.toBeUndefined();
    expect(closed).toHaveBeenCalledExactlyOnceWith(null);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('spawn ns ENOENT'));
  });

  it('disconnect interrupts the process, resolves initialPort with undefined and detaches listeners', async () => {
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);
    const closed = vi.fn();
    session.on('closed', closed);

    const exited = session.disconnect();

    await expect(session.initialPort).resolves.toBeUndefined();
    expect(utils.killProcess).toHaveBeenCalledExactlyOnceWith(proc, logger);
    expect(proc.stdout.listenerCount('data')).toBe(0);

    proc.emit('close', 0);
    await exited;
    expect(closed).not.toHaveBeenCalled();
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('disconnect resolves only once the process closes', async () => {
    vi.useFakeTimers();
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);

    let resolved = false;
    void session.disconnect().then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(CLI_EXIT_TIMEOUT_MS - 1);
    expect(resolved).toBe(false);

    proc.emit('close', 130);
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);

    await vi.advanceTimersByTimeAsync(CLI_EXIT_TIMEOUT_MS);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('disconnect force-kills a process that ignores SIGINT', async () => {
    vi.useFakeTimers();
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);

    let resolved = false;
    void session.disconnect().then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(CLI_EXIT_TIMEOUT_MS);

    expect(proc.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL');
    expect(resolved).toBe(true);
  });

  it.each([
    ['exitCode', { exitCode: 0 }],
    ['signalCode', { signalCode: 'SIGINT' as const }],
  ])('disconnect resolves immediately when %s is already set', async (_label, state) => {
    vi.useFakeTimers();
    const { proc, result } = createDebugResult();
    Object.assign(proc, state);
    const session = new BuildSession(result, logger);

    await session.disconnect();

    await vi.advanceTimersByTimeAsync(CLI_EXIT_TIMEOUT_MS);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('repeated disconnects share one exit promise', async () => {
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);

    const first = session.disconnect();
    const second = session.disconnect();

    expect(second).toBe(first);
    expect(utils.killProcess).toHaveBeenCalledOnce();
    proc.emit('close', 0);
    await expect(first).resolves.toBeUndefined();
  });

  it('does not kill a process that has already exited', async () => {
    const { proc, result } = createDebugResult();
    const session = new BuildSession(result, logger);

    proc.emit('close', 0);

    await expect(session.disconnect()).resolves.toBeUndefined();
    expect(utils.killProcess).not.toHaveBeenCalled();
  });
});

describe('BuildService.startBuild', () => {
  let logger: { log: Mock<ILogger['log']> };
  let cli: { path: string; getSupportedVersion: ReturnType<typeof vi.fn<(min: string) => Promise<string>>> };
  let selectTeam: ReturnType<typeof vi.fn<() => Promise<{ id: string; name: string } | undefined>>>;
  let trackDebug: ReturnType<typeof vi.fn>;
  let appRoot: string;
  let service: BuildService;

  const baseArgs = (overrides: Partial<BuildArgs> = {}): BuildArgs => ({
    appRoot,
    platform: 'android',
    request: 'launch',
    ...overrides,
  });

  const writeAppFile = (relativePath: string, content: string) => {
    const file = path.join(appRoot, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  const debugTnsArgs = (): string[] | undefined => projects.debug.mock.lastCall![1];

  beforeEach(() => {
    appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-build-service-'));
    logger = { log: vi.fn<ILogger['log']>() };
    projects.created.length = 0;
    projects.debug.mockImplementation(() => createDebugResult().result);
    projects.attach.mockImplementation(() => createDebugResult().result);

    cli = { path: 'ns', getSupportedVersion: vi.fn(async () => '8.9.2') };
    vi.spyOn(services, 'createCli').mockReturnValue(cli as unknown as NativeScriptCli);

    trackDebug = vi.fn(async () => undefined);
    vi.spyOn(services, 'analyticsService', 'get').mockReturnValue({ trackDebug } as unknown as AnalyticsService);

    selectTeam = vi.fn(async () => ({ id: 'TEAM123', name: 'My Team' }));
    vi.spyOn(services, 'iOSTeamService', 'get').mockReturnValue({ selectTeam } as unknown as iOSTeamService);

    service = new BuildService(logger);
  });

  afterEach(() => {
    fs.rmSync(appRoot, { recursive: true, force: true });
  });

  it('launches the debug command and returns a BuildSession', async () => {
    const session = await service.startBuild(
      baseArgs({ watch: true, stopOnEntry: true, tnsArgs: ['--device', 'emulator-5554'] }),
    );

    expect(session).toBeInstanceOf(BuildSession);
    expect(services.createCli).toHaveBeenCalledWith(appRoot);
    expect(cli.getSupportedVersion).toHaveBeenCalledWith(services.minCliVersion);
    expect(projects.created).toEqual([{ platform: 'android', appRoot }]);
    expect(projects.debug).toHaveBeenCalledExactlyOnceWith({ stopOnEntry: true, watch: true, launchTests: false }, [
      '--device',
      'emulator-5554',
    ]);
    expect(trackDebug).toHaveBeenCalledWith('launch', 'android');
  });

  it('uses attach for attach requests', async () => {
    await service.startBuild(baseArgs({ request: 'attach', tnsArgs: ['--env.foo'] }));

    expect(projects.attach).toHaveBeenCalledExactlyOnceWith(['--env.foo']);
    expect(projects.debug).not.toHaveBeenCalled();
  });

  it('picks the iOS project case-insensitively', async () => {
    await service.startBuild(baseArgs({ platform: 'iOS', request: 'attach' }));
    expect(projects.created).toEqual([{ platform: 'ios', appRoot }]);
  });

  describe('Vite projects', () => {
    beforeEach(() => {
      writeAppFile('nativescript.config.ts', "export default { id: 'org.demo', bundler: 'vite' };\n");
    });

    it('appends --no-hmr', async () => {
      await service.startBuild(baseArgs({ tnsArgs: ['--env.foo'] }));
      expect(debugTnsArgs()).toEqual(['--env.foo', '--no-hmr']);
    });

    it.each([['--hmr'], ['--no-hmr']])('leaves an explicit %s alone', async (flag) => {
      await service.startBuild(baseArgs({ tnsArgs: [flag] }));
      expect(debugTnsArgs()).toEqual([flag]);
    });

    it('does not mutate the caller tnsArgs', async () => {
      const tnsArgs = ['--env.foo'];
      await service.startBuild(baseArgs({ tnsArgs }));
      expect(tnsArgs).toEqual(['--env.foo']);
    });
  });

  it('does not append --no-hmr for webpack projects', async () => {
    writeAppFile('nativescript.config.ts', "export default { id: 'org.demo', appPath: 'src' };\n");
    await service.startBuild(baseArgs());
    expect(debugTnsArgs()).toEqual([]);
  });

  it('rejects debugging tests in Vitest projects', async () => {
    writeAppFile('vitest.config.ts', 'export default {};\n');

    await expect(service.startBuild(baseArgs({ launchTests: true }))).rejects.toThrow(/Vitest/);
    expect(projects.created).toEqual([]);
  });

  it('allows a normal debug launch in Vitest projects', async () => {
    writeAppFile('vitest.config.mts', 'export default {};\n');

    await expect(service.startBuild(baseArgs())).resolves.toBeInstanceOf(BuildSession);
  });

  it('rejects when the CLI is too old', async () => {
    cli.getSupportedVersion.mockRejectedValue(new Error('requires NativeScript CLI v8.0.0 or greater'));

    await expect(service.startBuild(baseArgs())).rejects.toThrow('requires NativeScript CLI v8.0.0 or greater');
    expect(projects.debug).not.toHaveBeenCalled();
  });

  it('returns null without running the CLI when cancelled', async () => {
    await expect(service.startBuild(baseArgs(), () => true)).resolves.toBeNull();
    expect(projects.debug).not.toHaveBeenCalled();
    expect(projects.attach).not.toHaveBeenCalled();
  });

  describe('iOS team selection', () => {
    it('asks for a team on iOS launch and passes it to the CLI', async () => {
      await service.startBuild(baseArgs({ platform: 'ios' }));

      expect(selectTeam).toHaveBeenCalledOnce();
      expect(debugTnsArgs()).toEqual(['--teamId', 'TEAM123']);
    });

    it('returns null without running the CLI when stopped while the team picker is open', async () => {
      let stopped = false;
      selectTeam.mockImplementation(async () => {
        stopped = true;
        return undefined;
      });

      await expect(service.startBuild(baseArgs({ platform: 'ios' }), () => stopped)).resolves.toBeNull();
      expect(projects.debug).not.toHaveBeenCalled();
    });

    it('skips the picker when tnsArgs already has --teamId', async () => {
      await service.startBuild(baseArgs({ platform: 'ios', tnsArgs: ['--teamId', 'ABC'] }));

      expect(selectTeam).not.toHaveBeenCalled();
      expect(debugTnsArgs()).toEqual(['--teamId', 'ABC']);
    });

    it('skips the picker when build.xcconfig sets DEVELOPMENT_TEAM', async () => {
      writeAppFile(
        'app/App_Resources/iOS/build.xcconfig',
        '// DEVELOPMENT_TEAM = COMMENTED;\nDEVELOPMENT_TEAM = XC123;\nCODE_SIGN_STYLE = Automatic;\n',
      );

      await service.startBuild(baseArgs({ platform: 'ios' }));

      expect(selectTeam).not.toHaveBeenCalled();
      expect(debugTnsArgs()).toEqual([]);
    });

    it('skips the picker when a teamid file exists', async () => {
      writeAppFile('teamid', 'FILE123\n');

      await service.startBuild(baseArgs({ platform: 'ios' }));

      expect(selectTeam).not.toHaveBeenCalled();
    });

    it('does not ask for a team on attach', async () => {
      await service.startBuild(baseArgs({ platform: 'ios', request: 'attach' }));
      expect(selectTeam).not.toHaveBeenCalled();
    });
  });
});
