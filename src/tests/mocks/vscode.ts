/**
 * Minimal stand-in for the `vscode` module (aliased in vitest.config.mts). Only covers the API surface the
 * extension uses; tests drive events through the exported `fire*` helpers and inspect the `vi.fn()` spies.
 */
import { vi } from 'vitest';

type Listener<T> = (e: T) => unknown;

export class EventEmitter<T> {
  private listeners = new Set<Listener<T>>();

  public event = (listener: Listener<T>) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  public fire(e: T): void {
    for (const listener of [...this.listeners]) listener(e);
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

export interface MockDebugSession {
  id: string;
  type: string;
  name: string;
  configuration: Record<string, unknown>;
  workspaceFolder?: unknown;
  parentSession?: MockDebugSession;
  customRequest?: (command: string, args?: unknown) => Promise<unknown>;
}

const didStart = new EventEmitter<MockDebugSession>();
const didTerminate = new EventEmitter<MockDebugSession>();

export const testing = {
  fireDidStartDebugSession: (session: MockDebugSession) => didStart.fire(session),
  fireDidTerminateDebugSession: (session: MockDebugSession) => didTerminate.fire(session),
  configuration: {} as Record<string, unknown>,
};

export const debug = {
  onDidStartDebugSession: didStart.event,
  onDidTerminateDebugSession: didTerminate.event,
  startDebugging: vi.fn(
    async (_folder: unknown, _config: Record<string, unknown>, _options?: Record<string, unknown>): Promise<boolean> =>
      true,
  ),
  stopDebugging: vi.fn(async (_session?: MockDebugSession): Promise<void> => undefined),
};

export const workspace = {
  workspaceFolders: undefined as unknown[] | undefined,
  getWorkspaceFolder: vi.fn((_uri: unknown): unknown => undefined),
  getConfiguration: vi.fn(() => ({
    get: <T>(key: string, defaultValue?: T) =>
      key in testing.configuration ? testing.configuration[key] : defaultValue,
    // Values in testing.configuration count as user-set (global) values.
    inspect: (key: string) => ({ key, globalValue: testing.configuration[key] }),
    update: vi.fn(async () => undefined),
  })),
};

export const window = {
  showErrorMessage: vi.fn(async (_message: string, ..._items: unknown[]): Promise<unknown> => undefined),
  showInformationMessage: vi.fn(async () => undefined),
  showQuickPick: vi.fn(async (_items: unknown, _options?: unknown): Promise<unknown> => undefined),
};

export const env = { isTelemetryEnabled: true };
export const version = '1.109.0';

export const Uri = {
  file: (fsPath: string) => ({ fsPath, scheme: 'file', path: fsPath }),
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}
