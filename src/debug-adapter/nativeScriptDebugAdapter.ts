import { DebugSession, InitializedEvent, TerminatedEvent, OutputEvent } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DebugManager, NativeScriptDebugConfiguration } from './debugManager';
import * as vscode from 'vscode';

export class NativeScriptDebugAdapter extends DebugSession {
  private debugManager: DebugManager;
  private parentSession: vscode.DebugSession | null = null;
  private terminated = false;

  constructor(debugManager: DebugManager) {
    super();
    this.debugManager = debugManager;
  }

  public setParentSession(session: vscode.DebugSession): void {
    this.parentSession = session;
  }

  protected override initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments,
  ): void {
    // No supportsRestartRequest: VS Code then restarts by terminating and relaunching the session.
    response.body = {
      supportsTerminateRequest: true,
    };

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected override launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: DebugProtocol.LaunchRequestArguments,
  ): void {
    this.sendResponse(response);
    void this.startDebugSession(args);
  }

  protected override attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments,
  ): void {
    this.sendResponse(response);
    void this.startDebugSession(args);
  }

  protected override configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    _args: DebugProtocol.ConfigurationDoneArguments,
  ): void {
    this.sendResponse(response);
  }

  protected override disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
  ): void {
    void this.stopNativeScript().then(() => this.sendResponse(response));
  }

  protected override terminateRequest(
    response: DebugProtocol.TerminateResponse,
    _args: DebugProtocol.TerminateArguments,
  ): void {
    // Respond only after the CLI exited: Restart relaunches as soon as the session ends.
    void this.stopNativeScript().then(() => {
      this.sendResponse(response);
      this.sendTerminated();
    });
  }

  protected override threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [] };
    this.sendResponse(response);
  }

  private async stopNativeScript(): Promise<void> {
    if (this.parentSession) {
      await this.debugManager.stopDebugging(this.parentSession.id);
    }
  }

  private sendTerminated(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.sendEvent(new TerminatedEvent());
  }

  private async startDebugSession(
    args: DebugProtocol.LaunchRequestArguments | DebugProtocol.AttachRequestArguments,
  ): Promise<void> {
    if (!this.parentSession) {
      this.sendEvent(new OutputEvent('[NativeScript] No parent session available\n', 'stderr'));
      this.sendTerminated();
      return;
    }

    try {
      const config = { ...args } as NativeScriptDebugConfiguration;
      const started = await this.debugManager.startDebugging(this.parentSession, config, () => {
        this.sendTerminated();
      });
      if (!started) {
        this.sendTerminated();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.sendEvent(new OutputEvent(`[NativeScript] Error: ${msg}\n`, 'stderr'));
      this.sendTerminated();
    }
  }
}
