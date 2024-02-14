import { DebugSession } from "vscode";
import { v4 as uuidv4 } from "uuid";

export enum NativeScriptSessionStatus {
    NotActivated,
    Pending,
    Activated,
}

export class NativeScriptSession {
    private sessionId: string;
    private vsCodeDebugSession: DebugSession;
    private status: NativeScriptSessionStatus;

    constructor(vsCodeDebugSession: DebugSession) {
        this.sessionId = uuidv4();
        this.vsCodeDebugSession = vsCodeDebugSession;
        this.status = NativeScriptSessionStatus.NotActivated;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getVSCodeDebugSession(): DebugSession {
        return this.vsCodeDebugSession;
    }

    public getStatus(): NativeScriptSessionStatus {
        return this.status;
    }

    public setStatus(sessionStatus: NativeScriptSessionStatus): void {
        this.status = sessionStatus;
    }
}