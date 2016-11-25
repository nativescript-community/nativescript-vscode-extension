import {DebugProtocol} from 'vscode-debugprotocol';

export class DebugConfiguration {
    private _requestArgs: DebugProtocol.IRequestArgs;

    constructor(requestArgs: DebugProtocol.IRequestArgs) {
        this._requestArgs = requestArgs;
    }

    public get isLaunch(): boolean {
        return this.args.request === "launch" && (<DebugProtocol.ILaunchRequestArgs>this._requestArgs).rebuild;
    }

    public get isSync(): boolean {
        return this.args.request == "launch" && !(<DebugProtocol.ILaunchRequestArgs>this._requestArgs).rebuild;
    }

    public get isAttach(): boolean {
        return this.args.request === "attach";
    }

    public get isAndroid(): boolean {
        return this.args.platform == "android";
    }

    public get isIos(): boolean {
        return this.args.platform == "ios";
    }

    public get args(): DebugProtocol.IRequestArgs {
        return this._requestArgs;
    }

    public get launchArgs(): DebugProtocol.ILaunchRequestArgs {
        return this.isLaunch ? <DebugProtocol.ILaunchRequestArgs>this.args : null;
    }

    public get attachArgs(): DebugProtocol.IAttachRequestArgs {
        return this.isAttach ? <DebugProtocol.IAttachRequestArgs>this.args : null;
    }
}
