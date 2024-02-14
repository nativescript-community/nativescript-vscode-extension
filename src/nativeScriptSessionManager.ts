import { DebugAdapterServer, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugSession, ProviderResult } from "vscode";
import { NativeScriptSession, NativeScriptSessionStatus } from "./NativeScriptSession";
import * as Net from "net";
import { ILogger } from "./common/logger";


export class NativeScriptSessionManager implements DebugAdapterDescriptorFactory {
    private nativeScriptDebugSessions = new Map<string, NativeScriptSession>();
    public session: DebugSession;
    private _logger: ILogger;

    constructor(logger: ILogger) {
        this._logger = logger;
    }

    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined) {
        console.log("createDebugAdapterDescriptorcreateDebugAdapterDescriptorcreateDebugAdapterDescriptor");
        this._logger.log("createDebugAdapterDescriptorcreateDebugAdapterDescriptorcreateDebugAdapterDescriptorcreateDebugAdapterDescriptor")
        const nativeScriptSession = this.createNativeScriptSession(session);
        this.nativeScriptDebugSessions.set(nativeScriptSession.getSessionId(), nativeScriptSession);
        const debugServer = Net.createServer(socket => {
            console.log("SOCKET Net");

            /* const cordovaDebugSession = new NativeScriptSession(nativeScriptSession, this);
            cordovaDebugSession.setRunAsServer(true);
            this.connections.set(cordovaSession.getSessionId(), socket);
            cordovaDebugSession.start(<NodeJS.ReadableStream>socket, socket); */
        });
        this.session = session;
        return new DebugAdapterServer((<Net.AddressInfo>debugServer.address()).port);
    }

    private createNativeScriptSession(session: DebugSession): NativeScriptSession {
        const nativeScriptSession = new NativeScriptSession(session);
        /* if (this.restartingVSCodeSessions.has(session.id)) {
            cordovaSession.setStatus(NativeScriptSessionStatus.Pending);
            this.restartingVSCodeSessions.delete(session.id);
        } */
        return nativeScriptSession;
    }
}