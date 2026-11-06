import { DebugProtocol } from '@vscode/debugprotocol';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type * as vscodeTypes from 'vscode';
import { DebugManager, SessionTerminatedCallback } from '../debug-adapter/debugManager';
import { NativeScriptDebugAdapter } from '../debug-adapter/nativeScriptDebugAdapter';

interface AdapterRequests {
  launchRequest(response: DebugProtocol.LaunchResponse, args: Record<string, unknown>): void;
  attachRequest(response: DebugProtocol.AttachResponse, args: Record<string, unknown>): void;
  disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void;
  terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments): void;
  threadsRequest(response: DebugProtocol.ThreadsResponse): void;
}

type StartDebugging = (
  parent: vscodeTypes.DebugSession,
  config: vscodeTypes.DebugConfiguration,
  onTerminated: SessionTerminatedCallback,
) => Promise<boolean>;

const createMockDebugManager = () => ({
  startDebugging: vi.fn<StartDebugging>(async () => true),
  stopDebugging: vi.fn(async (_parentSessionId: string) => undefined),
  dispose: vi.fn(),
});

const createMockSession = (id = 'test-session-id') => ({ id, type: 'nativescript', name: 'Test' });

const createResponse = <T extends DebugProtocol.Response>(command: string) =>
  ({ body: {}, success: true, command, type: 'response', request_seq: 1, seq: 0 }) as unknown as T;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('NativeScriptDebugAdapter', () => {
  let adapter: NativeScriptDebugAdapter;
  let requests: AdapterRequests;
  let debugManager: ReturnType<typeof createMockDebugManager>;
  let mockSession: ReturnType<typeof createMockSession>;
  let sendEvent: MockInstance<NativeScriptDebugAdapter['sendEvent']>;
  let sendResponse: MockInstance<NativeScriptDebugAdapter['sendResponse']>;

  const sentEventNames = () => sendEvent.mock.calls.map(([event]) => event.event);
  const terminatedCount = () => sentEventNames().filter((name) => name === 'terminated').length;

  beforeEach(() => {
    debugManager = createMockDebugManager();
    adapter = new NativeScriptDebugAdapter(debugManager as unknown as DebugManager);
    requests = adapter as unknown as AdapterRequests;
    sendEvent = vi.spyOn(adapter, 'sendEvent').mockImplementation(() => undefined);
    sendResponse = vi.spyOn(adapter, 'sendResponse').mockImplementation(() => undefined);
    mockSession = createMockSession();
    adapter.setParentSession(mockSession as unknown as vscodeTypes.DebugSession);
  });

  it('returns empty threads', () => {
    const response = createResponse<DebugProtocol.ThreadsResponse>('threads');
    requests.threadsRequest(response);
    expect(response.body.threads).toEqual([]);
  });

  describe('launch and attach', () => {
    it.each(['launchRequest', 'attachRequest'] as const)(
      '%s responds and starts debugging with the parent session',
      async (request) => {
        const response = createResponse<DebugProtocol.LaunchResponse>('launch');
        requests[request](response, { platform: 'ios', appRoot: '/test' });

        expect(sendResponse).toHaveBeenCalledWith(response);
        expect(debugManager.startDebugging).toHaveBeenCalledExactlyOnceWith(
          mockSession,
          { platform: 'ios', appRoot: '/test' },
          expect.any(Function),
        );
        await flush();
        expect(terminatedCount()).toBe(0);
      },
    );

    it('terminates when startDebugging returns false', async () => {
      debugManager.startDebugging.mockResolvedValue(false);

      requests.launchRequest(createResponse('launch'), {});
      await flush();

      expect(terminatedCount()).toBe(1);
    });

    it('reports a startDebugging error and terminates', async () => {
      debugManager.startDebugging.mockRejectedValue(new Error('CLI too old'));

      requests.launchRequest(createResponse('launch'), {});
      await flush();

      expect(sentEventNames()).toEqual(['output', 'terminated']);
      expect(sendEvent.mock.calls[0][0]).toMatchObject({
        body: { category: 'stderr', output: '[NativeScript] Error: CLI too old\n' },
      });
    });

    it('terminates without a parent session', async () => {
      adapter = new NativeScriptDebugAdapter(debugManager as unknown as DebugManager);
      requests = adapter as unknown as AdapterRequests;
      sendEvent = vi.spyOn(adapter, 'sendEvent').mockImplementation(() => undefined);
      vi.spyOn(adapter, 'sendResponse').mockImplementation(() => undefined);

      requests.launchRequest(createResponse('launch'), {});
      await flush();

      expect(debugManager.startDebugging).not.toHaveBeenCalled();
      expect(sentEventNames()).toEqual(['output', 'terminated']);
    });

    it('sends a single TerminatedEvent when onTerminated fires and startDebugging then returns false', async () => {
      debugManager.startDebugging.mockImplementation(async (_parent, _config, onTerminated) => {
        onTerminated();
        return false;
      });

      requests.launchRequest(createResponse('launch'), {});
      await flush();

      expect(terminatedCount()).toBe(1);
    });

    it('does not send a second TerminatedEvent on terminate after the session already ended', async () => {
      debugManager.startDebugging.mockImplementation(async (_parent, _config, onTerminated) => {
        onTerminated();
        return true;
      });
      requests.launchRequest(createResponse('launch'), {});
      await flush();

      requests.terminateRequest(createResponse('terminate'), {});
      await flush();

      expect(terminatedCount()).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('stops the parent session and responds only after the stop completes', async () => {
      const stop = deferred<undefined>();
      debugManager.stopDebugging.mockReturnValue(stop.promise);
      const response = createResponse<DebugProtocol.DisconnectResponse>('disconnect');

      requests.disconnectRequest(response, {});
      await flush();

      expect(debugManager.stopDebugging).toHaveBeenCalledExactlyOnceWith(mockSession.id);
      expect(sendResponse).not.toHaveBeenCalled();

      stop.resolve(undefined);
      await flush();

      expect(sendResponse).toHaveBeenCalledExactlyOnceWith(response);
      expect(terminatedCount()).toBe(0);
    });
  });

  describe('terminate', () => {
    it('responds and then sends TerminatedEvent only after the stop completes', async () => {
      const stop = deferred<undefined>();
      debugManager.stopDebugging.mockReturnValue(stop.promise);
      const order: string[] = [];
      sendResponse.mockImplementation(() => order.push('response'));
      sendEvent.mockImplementation((event) => order.push(event.event));

      requests.terminateRequest(createResponse('terminate'), {});
      await flush();

      expect(debugManager.stopDebugging).toHaveBeenCalledExactlyOnceWith(mockSession.id);
      expect(order).toEqual([]);

      stop.resolve(undefined);
      await flush();

      expect(order).toEqual(['response', 'terminated']);
    });

    it('sends TerminatedEvent once across repeated terminate requests', async () => {
      requests.terminateRequest(createResponse('terminate'), {});
      requests.terminateRequest(createResponse('terminate'), {});
      await flush();

      expect(sendResponse).toHaveBeenCalledTimes(2);
      expect(terminatedCount()).toBe(1);
    });
  });
});
