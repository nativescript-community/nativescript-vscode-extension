import {DebugProtocol} from 'vscode-debugprotocol';
import {Project} from '../project/project';
import {IosProject} from '../project/iosProject';
import {AndroidProject} from '../project/androidProject';
import {DebugAdapterServices as Services} from '../services/debugAdapterServices';
import {NativeScriptCli} from '../project/nativeScriptCli';

export class DebugRequest {
    private _requestArgs: DebugProtocol.IRequestArgs;
    private _project: Project;

    constructor(requestArgs: DebugProtocol.IRequestArgs, cli: NativeScriptCli) {
        this._requestArgs = requestArgs;
        this._project = this.isIos ? new IosProject(this.args.appRoot, cli) : new AndroidProject(this.args.appRoot, cli);
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
        return (this.isLaunch || this.isSync) ? <DebugProtocol.ILaunchRequestArgs>this.args : null;
    }

    public get attachArgs(): DebugProtocol.IAttachRequestArgs {
        return this.isAttach ? <DebugProtocol.IAttachRequestArgs>this.args : null;
    }

    public get project(): Project {
        return this._project;
    }

    public get iosProject(): IosProject {
        return this.isIos ? <IosProject>this.project : null;
    }

    public get androidProject(): AndroidProject {
        return this.isAndroid ? <AndroidProject>this.project : null;
    }
}
