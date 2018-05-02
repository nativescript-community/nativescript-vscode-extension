import { IInitializeRequestArgs, ChromeDebugAdapter, IAttachRequestArgs, utils, ISetBreakpointsArgs, ISetBreakpointsResponseBody, ILaunchRequestArgs, ITelemetryPropertyCollector } from 'vscode-chrome-debug-core';
import { NativeScriptDebugLauncher } from './nativeScriptDebugLauncher'
import { OutputEvent, TerminatedEvent } from 'vscode-debugadapter';

export class NativeScriptDebugAdapter extends ChromeDebugAdapter {
    private nativeScriptDebugLauncher: NativeScriptDebugLauncher;

    public initialize(args: any) {
        this.nativeScriptDebugLauncher = new NativeScriptDebugLauncher();
        this.nativeScriptDebugLauncher.on(NativeScriptDebugLauncher.TNS_PROCESS_CRASHED_EVENT, (reason) => this._session.sendEvent(new TerminatedEvent()));
        this.nativeScriptDebugLauncher.on(NativeScriptDebugLauncher.TNS_PROCESS_LOG, (log) => this._session.sendEvent(new OutputEvent(log)));

        return super.initialize(args);
    }

    public async attach(args: any): Promise<void> {
        const attachArgs = await this.nativeScriptDebugLauncher.processRequest(args);
        (this.pathTransformer as any).setTargetPlatform(args.platform);

        return super.attach(attachArgs);
    }

    public async launch(args: any, telemetryPropertyCollector?: ITelemetryPropertyCollector): Promise<void> {
        const launchArgs = await this.nativeScriptDebugLauncher.processRequest(args) as any;
        (this.pathTransformer as any).setTargetPlatform(args.platform);

        super.launch(args, telemetryPropertyCollector);

        return super.attach(launchArgs);
    }

    public async disconnect(args: any) {
        if(this.nativeScriptDebugLauncher != null) {
            this.nativeScriptDebugLauncher.disconnect();
            this.nativeScriptDebugLauncher.removeAllListeners(NativeScriptDebugLauncher.TNS_PROCESS_CRASHED_EVENT);
            this.nativeScriptDebugLauncher.removeAllListeners(NativeScriptDebugLauncher.TNS_PROCESS_LOG);
            this.nativeScriptDebugLauncher = null;
        }

        super.disconnect(args);
    }
}