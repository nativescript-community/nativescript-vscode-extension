import * as assert from 'assert';
import * as sinon from 'sinon';
import { NativeScriptDebugAdapter } from '../debug-adapter/nativeScriptDebugAdapter';
import { DebugManager } from '../debug-adapter/debugManager';

const createMockDebugManager = () => ({
  startDebugging: sinon.stub().resolves(),
  stopDebugging: sinon.stub(),
  dispose: sinon.stub(),
});

const createMockSession = (id = 'test-session-id') => ({
  id,
  type: 'nativescript',
  name: 'Test',
});

describe('NativeScriptDebugAdapter', () => {
  let adapter: NativeScriptDebugAdapter;
  let debugManager: ReturnType<typeof createMockDebugManager>;
  let mockSession: ReturnType<typeof createMockSession>;

  beforeEach(() => {
    debugManager = createMockDebugManager();
    adapter = new NativeScriptDebugAdapter(debugManager as unknown as DebugManager);
    mockSession = createMockSession();
    adapter.setParentSession(mockSession as any);
  });

  it('should create adapter with debug manager', () => {
    assert.ok(adapter);
  });

  it('should set parent session', () => {
    const session = createMockSession('custom-id');
    adapter.setParentSession(session as any);
    assert.ok(adapter);
  });

  it('should call debugManager.stopDebugging on disconnect with parent session id', () => {
    (adapter as any).disconnectRequest(
      { body: {}, success: true, command: 'disconnect', type: 'response', request_seq: 1, seq: 0 },
      {},
    );
    assert.ok(debugManager.stopDebugging.calledOnce);
    assert.ok(debugManager.stopDebugging.calledWith(mockSession.id));
  });

  it('should call debugManager.stopDebugging on terminate with parent session id', () => {
    (adapter as any).terminateRequest(
      { body: {}, success: true, command: 'terminate', type: 'response', request_seq: 1, seq: 0 },
      {},
    );
    assert.ok(debugManager.stopDebugging.calledOnce);
    assert.ok(debugManager.stopDebugging.calledWith(mockSession.id));
  });

  it('should return empty threads', () => {
    const response: any = { body: {}, success: true, command: 'threads', type: 'response', request_seq: 1, seq: 0 };
    (adapter as any).threadsRequest(response);
    assert.deepStrictEqual(response.body.threads, []);
  });

  it('should call debugManager.startDebugging on launch', async () => {
    const response: any = { body: {}, success: true, command: 'launch', type: 'response', request_seq: 1, seq: 0 };
    await (adapter as any).launchRequest(response, { platform: 'ios', appRoot: '/test' });
    assert.ok(debugManager.startDebugging.calledOnce);
  });

  it('should call debugManager.startDebugging on attach', async () => {
    const response: any = { body: {}, success: true, command: 'attach', type: 'response', request_seq: 1, seq: 0 };
    await (adapter as any).attachRequest(response, { platform: 'android', appRoot: '/test' });
    assert.ok(debugManager.startDebugging.calledOnce);
  });
});
