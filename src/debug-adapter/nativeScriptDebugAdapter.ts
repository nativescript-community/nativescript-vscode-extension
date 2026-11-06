import { DebugSession, InitializedEvent, TerminatedEvent, OutputEvent } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DebugManager, NativeScriptDebugConfiguration } from './debugManager';
import * as vscode from 'vscode';

export class NativeScriptDebugAdapter extends DebugSession {
  private debugManager: DebugManager;
  private parentSession: vscode.DebugSession | null = null;

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
    if (this.parentSession) {
      this.debugManager.stopDebugging(this.parentSession.id);
    }
    this.sendResponse(response);
  }

  protected override terminateRequest(
    response: DebugProtocol.TerminateResponse,
    _args: DebugProtocol.TerminateArguments,
  ): void {
    if (this.parentSession) {
      this.debugManager.stopDebugging(this.parentSession.id);
    }
    this.sendResponse(response);
    this.sendEvent(new TerminatedEvent());
  }

  protected override threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [] };
    this.sendResponse(response);
  }

  private async startDebugSession(
    args: DebugProtocol.LaunchRequestArguments | DebugProtocol.AttachRequestArguments,
  ): Promise<void> {
    if (!this.parentSession) {
      this.sendEvent(new OutputEvent('[NativeScript] No parent session available\n', 'stderr'));
      this.sendEvent(new TerminatedEvent());
      return;
    }

    try {
      const config = { ...args } as NativeScriptDebugConfiguration;
      const started = await this.debugManager.startDebugging(this.parentSession, config, () => {
        this.sendEvent(new TerminatedEvent());
      });
      if (!started) {
        this.sendEvent(new TerminatedEvent());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.sendEvent(new OutputEvent(`[NativeScript] Error: ${msg}\n`, 'stderr'));
      this.sendEvent(new TerminatedEvent());
    }
  }
}
