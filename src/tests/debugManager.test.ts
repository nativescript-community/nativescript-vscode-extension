import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ILogger } from '../common/logger';
import type * as vscodeTypes from 'vscode';
import {
  DebugManager,
  getNormalizedAddress,
  NativeScriptDebugConfiguration,
  PARENT_SESSION_KEY,
  RECONNECT_TIMEOUT_MS,
} from '../debug-adapter/debugManager';
import { computeSourceMapOptions, SourceMapConfig } from '../debug-adapter/sourceMaps';
import { BuildArgs, BuildService, BuildSession } from '../services/buildService';
import { services } from '../services/extensionHostServices';
import { debug, MockDebugSession, testing, window } from './mocks/vscode';

vi.mock('../debug-adapter/sourceMaps', () => ({
  computeSourceMapOptions: vi.fn(async (_appRoot: string, config: SourceMapConfig) => ({
    sourceMapPathOverrides: { 'webpack:///*': '/default/*', ...config.sourceMapPathOverrides },
    resolveSourceMapLocations: config.resolveSourceMapLocations ?? null,
  })),
}));

class FakeBuildSession extends EventEmitter {
  public resolvePort!: (port: number | undefined) => void;
  public readonly initialPort = new Promise<number | undefined>((resolve) => (this.resolvePort = resolve));
  public readonly disconnect = vi.fn(() => this.resolvePort(undefined));
}

type StartBuild = (args: BuildArgs, isCancelled: () => boolean) => Promise<BuildSession | null>;

const CHILD_STOP_SETTLE_MS = 500;
const CHILD_RETRY_DELAY_MS = 1000;

const workspaceFolder = { uri: { fsPath: '/workspace/app' }, name: 'app', index: 0 };

function createParent(id = 'parent-1'): MockDebugSession {
  return { id, type: 'nativescript', name: 'Launch on Android', configuration: {}, workspaceFolder };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('getNormalizedAddress', () => {
  it('keeps an explicit address', () => {
    expect(getNormalizedAddress('10.0.0.2', 'ios')).toBe('10.0.0.2');
  });

  it('defaults to localhost on iOS and 127.0.0.1 elsewhere', () => {
    expect(getNormalizedAddress(undefined, 'iOS')).toBe('localhost');
    expect(getNormalizedAddress(undefined, 'android')).toBe('127.0.0.1');
    expect(getNormalizedAddress(undefined, undefined)).toBe('127.0.0.1');
  });
});

describe('DebugManager', () => {
  let manager: DebugManager;
  let logger: { log: Mock<ILogger['log']> };
  let startBuild: ReturnType<typeof vi.fn<StartBuild>>;
  let build: FakeBuildSession;
  let parent: MockDebugSession;
  let onTerminated: ReturnType<typeof vi.fn<() => void>>;
  let children: MockDebugSession[];

  const activeSessionCount = () => (manager as unknown as { activeSessions: Map<string, unknown> }).activeSessions.size;

  const start = (config: Partial<NativeScriptDebugConfiguration>) =>
    manager.startDebugging(
      parent as unknown as vscodeTypes.DebugSession,
      config as NativeScriptDebugConfiguration,
      onTerminated,
    );

  const lastChildConfig = () => debug.startDebugging.mock.lastCall![1];

  async function startWithChild(
    config: Partial<NativeScriptDebugConfiguration>,
    port = 40000,
  ): Promise<MockDebugSession> {
    const started = start(config);
    build.resolvePort(port);
    await expect(started).resolves.toBe(true);
    expect(children).toHaveLength(1);
    return children[0];
  }

  beforeEach(() => {
    vi.useFakeTimers();

    logger = { log: vi.fn<ILogger['log']>() };
    build = new FakeBuildSession();
    startBuild = vi.fn<StartBuild>(async () => build as unknown as BuildSession);
    vi.spyOn(services, 'buildService', 'get').mockReturnValue({ startBuild } as unknown as BuildService);

    children = [];
    debug.startDebugging.mockImplementation(async (_folder, config) => {
      const child: MockDebugSession = {
        id: `child-${children.length + 1}`,
        type: 'pwa-node',
        name: String(config.name),
        configuration: config,
      };
      children.push(child);
      testing.fireDidStartDebugSession(child);
      return true;
    });
    debug.stopDebugging.mockImplementation(async (session) => {
      if (session) testing.fireDidTerminateDebugSession(session);
    });

    parent = createParent();
    onTerminated = vi.fn<() => void>();
    manager = new DebugManager(logger);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  describe('startup', () => {
    it('passes the launch config to startBuild and starts a js-debug child on the initial port', async () => {
      const child = await startWithChild({
        name: 'Launch on Android',
        platform: 'android',
        request: 'launch',
        appRoot: '/projects/demo',
        watch: true,
        stopOnEntry: false,
        tnsArgs: ['--env.foo'],
        sourceMaps: true,
        skipFiles: ['<node_internals>/**'],
      });

      expect(startBuild).toHaveBeenCalledWith(
        {
          appRoot: '/projects/demo',
          platform: 'android',
          request: 'launch',
          watch: true,
          stopOnEntry: false,
          launchTests: undefined,
          tnsArgs: ['--env.foo'],
        },
        expect.any(Function),
      );

      expect(debug.startDebugging).toHaveBeenCalledOnce();
      const [folder, childConfig, options] = debug.startDebugging.mock.calls[0];
      expect(folder).toBe(workspaceFolder);
      expect(childConfig).toMatchObject({
        type: 'pwa-node',
        request: 'attach',
        name: 'Launch on Android',
        websocketAddress: 'ws://127.0.0.1:40000',
        sourceMaps: true,
        skipFiles: ['<node_internals>/**'],
        [PARENT_SESSION_KEY]: 'parent-1',
      });
      expect(options).toEqual({ parentSession: parent, lifecycleManagedByParent: true, compact: true });
      expect(child.configuration[PARENT_SESSION_KEY]).toBe('parent-1');
    });

    it('uses localhost for iOS and honors an explicit address', async () => {
      await startWithChild({ platform: 'ios', request: 'launch' }, 41000);
      expect(lastChildConfig().websocketAddress).toBe('ws://localhost:41000');

      manager.stopDebugging(parent.id);
      build = new FakeBuildSession();
      parent = createParent('parent-2');
      children = [];
      await startWithChild({ platform: 'ios', request: 'attach', address: '192.168.1.5' }, 42000);
      expect(lastChildConfig().websocketAddress).toBe('ws://192.168.1.5:42000');
    });

    it("falls back to the parent's workspace folder for appRoot", async () => {
      await startWithChild({ platform: 'android', request: 'launch' });
      expect(startBuild.mock.calls[0][0].appRoot).toBe('/workspace/app');
    });

    it('maps diagnosticLogging to trace when trace is unset', async () => {
      await startWithChild({ platform: 'android', request: 'launch', diagnosticLogging: true });
      expect(lastChildConfig().trace).toBe(true);
    });

    it('passes user source map settings through to the child config', async () => {
      const userOverrides = { 'webpack://custom/*': '/projects/demo/custom/*' };
      await startWithChild({
        platform: 'android',
        request: 'launch',
        appRoot: '/projects/demo',
        sourceMapPathOverrides: userOverrides,
        resolveSourceMapLocations: ['/projects/demo/**'],
      });

      expect(computeSourceMapOptions).toHaveBeenCalledWith(
        '/projects/demo',
        {
          platform: 'android',
          sourceMapPathOverrides: userOverrides,
          resolveSourceMapLocations: ['/projects/demo/**'],
        },
        logger,
      );
      expect(lastChildConfig()).toMatchObject({
        sourceMapPathOverrides: { 'webpack:///*': '/default/*', ...userOverrides },
        resolveSourceMapLocations: ['/projects/demo/**'],
      });
    });

    it('computes source map options once, on the first attach', async () => {
      const started = start({ platform: 'android', request: 'launch', watch: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(computeSourceMapOptions).not.toHaveBeenCalled();

      build.resolvePort(40000);
      await started;
      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS);

      expect(children).toHaveLength(2);
      expect(computeSourceMapOptions).toHaveBeenCalledOnce();
    });

    it('retries the child start when VS Code reports failure', async () => {
      const succeed = debug.startDebugging.getMockImplementation()!;
      debug.startDebugging.mockImplementationOnce(async () => false);
      debug.startDebugging.mockImplementationOnce(succeed);

      const started = start({ platform: 'android', request: 'launch' });
      build.resolvePort(40000);
      await vi.advanceTimersByTimeAsync(CHILD_RETRY_DELAY_MS);

      await expect(started).resolves.toBe(true);
      expect(debug.startDebugging).toHaveBeenCalledTimes(2);
      expect(children).toHaveLength(1);
    });

    it('cleans up and reports an error when every initial attach attempt fails', async () => {
      debug.startDebugging.mockImplementation(async () => false);

      const started = start({ platform: 'android', request: 'launch', watch: true });
      build.resolvePort(40000);
      await vi.advanceTimersByTimeAsync(CHILD_RETRY_DELAY_MS * 3);

      await expect(started).resolves.toBe(false);
      expect(debug.startDebugging).toHaveBeenCalledTimes(3);
      expect(window.showErrorMessage).toHaveBeenCalledExactlyOnceWith(
        'Could not attach the debugger to the app on port 40000.',
      );
      expect(build.disconnect).toHaveBeenCalledOnce();
      expect(activeSessionCount()).toBe(0);
      expect(onTerminated).not.toHaveBeenCalled();
    });

    it('does not report an attach failure when stopped during the retries', async () => {
      debug.startDebugging.mockImplementation(async () => false);

      const started = start({ platform: 'android', request: 'launch' });
      build.resolvePort(40000);
      await vi.advanceTimersByTimeAsync(0);
      manager.stopDebugging(parent.id);
      await vi.advanceTimersByTimeAsync(CHILD_RETRY_DELAY_MS * 3);

      await expect(started).resolves.toBe(false);
      expect(debug.startDebugging).toHaveBeenCalledOnce();
      expect(window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('stops a child that finishes starting after the parent was stopped', async () => {
      const childStart = deferred<boolean>();
      debug.startDebugging.mockImplementation(async (_folder, config) => {
        const result = await childStart.promise;
        const child: MockDebugSession = { id: 'late-child', type: 'pwa-node', name: 'late', configuration: config };
        children.push(child);
        testing.fireDidStartDebugSession(child);
        return result;
      });

      const started = start({ platform: 'android', request: 'launch' });
      build.resolvePort(40000);
      await vi.advanceTimersByTimeAsync(0);
      manager.stopDebugging(parent.id);
      childStart.resolve(true);

      await expect(started).resolves.toBe(false);
      expect(debug.stopDebugging).toHaveBeenCalledWith(children[0]);
    });

    it('returns false without starting a child when no port is announced', async () => {
      const started = start({ platform: 'android', request: 'launch' });
      build.resolvePort(undefined);

      await expect(started).resolves.toBe(false);
      expect(debug.startDebugging).not.toHaveBeenCalled();
      expect(computeSourceMapOptions).not.toHaveBeenCalled();
      expect(build.disconnect).toHaveBeenCalled();
      expect(activeSessionCount()).toBe(0);
    });
  });

  describe('cancellation during startBuild', () => {
    it('reports cancellation to startBuild and starts nothing when it returns null', async () => {
      const pending = deferred<BuildSession | null>();
      startBuild.mockImplementation(() => pending.promise);

      const started = start({ platform: 'ios', request: 'launch' });
      const isCancelled = startBuild.mock.calls[0][1];
      expect(isCancelled()).toBe(false);

      manager.stopDebugging(parent.id);
      expect(isCancelled()).toBe(true);

      pending.resolve(null);
      await expect(started).resolves.toBe(false);
      expect(debug.startDebugging).not.toHaveBeenCalled();
      expect(onTerminated).not.toHaveBeenCalled();
    });

    it('disconnects a build session that is returned after the stop', async () => {
      const pending = deferred<BuildSession | null>();
      startBuild.mockImplementation(() => pending.promise);

      const started = start({ platform: 'android', request: 'launch' });
      manager.stopDebugging(parent.id);
      pending.resolve(build as unknown as BuildSession);

      await expect(started).resolves.toBe(false);
      expect(build.disconnect).toHaveBeenCalledOnce();
      expect(debug.startDebugging).not.toHaveBeenCalled();
      expect(activeSessionCount()).toBe(0);
    });

    it('does not start a child when stopped while waiting for the initial port', async () => {
      const started = start({ platform: 'android', request: 'launch' });
      await vi.advanceTimersByTimeAsync(0);

      manager.stopDebugging(parent.id);
      expect(build.disconnect).toHaveBeenCalledOnce();

      await expect(started).resolves.toBe(false);
      expect(debug.startDebugging).not.toHaveBeenCalled();
    });
  });

  it('shows, rethrows and cleans up when startBuild fails', async () => {
    startBuild.mockRejectedValue(new Error('CLI too old'));

    await expect(start({ platform: 'android', request: 'launch' })).rejects.toThrow('CLI too old');

    expect(window.showErrorMessage).toHaveBeenCalledWith('CLI too old');
    expect(activeSessionCount()).toBe(0);
    expect(debug.startDebugging).not.toHaveBeenCalled();
  });

  describe('LiveSync restarts', () => {
    it('replaces the child on newPort without terminating the parent', async () => {
      const first = await startWithChild({ platform: 'android', request: 'launch', watch: true });

      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS);

      expect(debug.stopDebugging).toHaveBeenCalledWith(first);
      expect(debug.startDebugging).toHaveBeenCalledTimes(2);
      expect(lastChildConfig().websocketAddress).toBe('ws://127.0.0.1:41000');

      await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS * 2);
      expect(onTerminated).not.toHaveBeenCalled();
      expect(build.disconnect).not.toHaveBeenCalled();
    });

    it('ignores a late termination event for the replaced child', async () => {
      const first = await startWithChild({ platform: 'android', request: 'launch', watch: false });
      debug.stopDebugging.mockImplementation(async () => undefined);

      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS);
      testing.fireDidTerminateDebugSession(first);

      expect(onTerminated).not.toHaveBeenCalled();
      expect(children).toHaveLength(2);
    });

    it('keeps the session alive when re-attaching after newPort fails, and recovers on the next port', async () => {
      await startWithChild({ platform: 'android', request: 'launch', watch: true });
      const succeed = debug.startDebugging.getMockImplementation()!;
      debug.startDebugging.mockImplementation(async () => false);

      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS + CHILD_RETRY_DELAY_MS * 3);

      expect(debug.startDebugging).toHaveBeenCalledTimes(4);
      expect(onTerminated).not.toHaveBeenCalled();
      expect(build.disconnect).not.toHaveBeenCalled();
      expect(window.showErrorMessage).not.toHaveBeenCalled();

      debug.startDebugging.mockImplementation(succeed);
      build.emit('newPort', 42000);
      await vi.advanceTimersByTimeAsync(0);

      expect(children).toHaveLength(2);
      expect(lastChildConfig().websocketAddress).toBe('ws://127.0.0.1:42000');
    });

    it('serializes back-to-back port announcements and ends on the latest port', async () => {
      await startWithChild({ platform: 'android', request: 'launch', watch: true });

      build.emit('newPort', 41000);
      build.emit('newPort', 42000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS * 2);

      expect(debug.startDebugging.mock.calls.map(([, config]) => config.websocketAddress)).toEqual([
        'ws://127.0.0.1:40000',
        'ws://127.0.0.1:41000',
        'ws://127.0.0.1:42000',
      ]);
      expect(debug.stopDebugging.mock.calls.map(([session]) => session?.id)).toEqual(['child-1', 'child-2']);
      expect(onTerminated).not.toHaveBeenCalled();
    });
  });

  describe('unexpected child termination', () => {
    it('waits for a new port in watch mode and reconnects', async () => {
      const first = await startWithChild({ platform: 'android', request: 'launch', watch: true });

      testing.fireDidTerminateDebugSession(first);
      await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS - 1);
      expect(onTerminated).not.toHaveBeenCalled();

      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(0);

      expect(debug.stopDebugging).not.toHaveBeenCalled();
      expect(children).toHaveLength(2);
      expect(lastChildConfig().websocketAddress).toBe('ws://127.0.0.1:41000');

      await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS);
      expect(onTerminated).not.toHaveBeenCalled();
    });

    it('terminates in watch mode when no new port arrives in time', async () => {
      const first = await startWithChild({ platform: 'android', request: 'launch', watch: true });

      testing.fireDidTerminateDebugSession(first);
      await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS);

      expect(onTerminated).toHaveBeenCalledOnce();
      expect(build.disconnect).toHaveBeenCalledOnce();
      expect(activeSessionCount()).toBe(0);

      build.emit('newPort', 41000);
      await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS);
      expect(children).toHaveLength(1);
    });

    it('terminates immediately without watch', async () => {
      const first = await startWithChild({ platform: 'android', request: 'launch', watch: false });

      testing.fireDidTerminateDebugSession(first);

      expect(onTerminated).toHaveBeenCalledOnce();
      expect(build.disconnect).toHaveBeenCalledOnce();
      expect(activeSessionCount()).toBe(0);
    });

    it('ignores terminations of sessions it does not own', async () => {
      await startWithChild({ platform: 'android', request: 'launch', watch: false });

      testing.fireDidTerminateDebugSession({ id: 'other', type: 'pwa-node', name: 'other', configuration: {} });
      testing.fireDidTerminateDebugSession({
        id: 'foreign-child',
        type: 'pwa-node',
        name: 'foreign',
        configuration: { [PARENT_SESSION_KEY]: 'someone-else' },
      });

      expect(onTerminated).not.toHaveBeenCalled();
    });
  });

  it('terminates when the ns process closes', async () => {
    const child = await startWithChild({ platform: 'android', request: 'launch', watch: true });

    build.emit('closed', 0);

    expect(onTerminated).toHaveBeenCalledOnce();
    expect(build.disconnect).toHaveBeenCalledOnce();
    expect(debug.stopDebugging).toHaveBeenCalledWith(child);
  });

  it('terminates when the ns process closes before announcing a port', async () => {
    const started = start({ platform: 'android', request: 'launch', watch: true });
    await vi.advanceTimersByTimeAsync(0);

    build.emit('closed', 1);

    expect(onTerminated).toHaveBeenCalledOnce();
    await expect(started).resolves.toBe(false);
    expect(debug.startDebugging).not.toHaveBeenCalled();
  });

  it('disconnects the build and stops the child when the parent session terminates', async () => {
    const child = await startWithChild({ platform: 'android', request: 'launch', watch: true });

    testing.fireDidTerminateDebugSession(parent);

    expect(build.disconnect).toHaveBeenCalledOnce();
    expect(debug.stopDebugging).toHaveBeenCalledWith(child);
    expect(onTerminated).not.toHaveBeenCalled();
    expect(activeSessionCount()).toBe(0);

    build.emit('newPort', 41000);
    await vi.advanceTimersByTimeAsync(CHILD_STOP_SETTLE_MS);
    expect(children).toHaveLength(1);
  });

  it('stopDebugging disconnects the build, stops the child and does not call onTerminated', async () => {
    const child = await startWithChild({ platform: 'android', request: 'launch', watch: true });

    manager.stopDebugging(parent.id);
    manager.stopDebugging(parent.id);

    expect(build.disconnect).toHaveBeenCalledOnce();
    expect(debug.stopDebugging).toHaveBeenCalledExactlyOnceWith(child);
    expect(onTerminated).not.toHaveBeenCalled();
  });

  it('dispose cleans up every active session', async () => {
    await startWithChild({ platform: 'android', request: 'launch' });

    manager.dispose();

    expect(build.disconnect).toHaveBeenCalledOnce();
    expect(activeSessionCount()).toBe(0);
  });
});
