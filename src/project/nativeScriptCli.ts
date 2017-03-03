import {spawn, execSync, ChildProcess} from 'child_process';
import {Version} from '../common/version';
import {Logger, Tags} from '../common/logger';
import * as utils from '../common/utilities';

export enum CliVersionState {
    NotExisting,
    OlderThanSupported,
    Compatible
}

export class CliVersion {
    private _cliVersion: Version = undefined;
    private _minExpectedCliVersion: Version = undefined;
    private _cliVersionState: CliVersionState;
    private _cliVersionErrorMessage: string;

    constructor(cliVersion: Version, minExpectedCliVersion: Version) {
        this._cliVersion = cliVersion;
        this._minExpectedCliVersion = minExpectedCliVersion;

        // Calculate CLI version state and CLI version error message
        this._cliVersionState = CliVersionState.Compatible;
        if (minExpectedCliVersion) {
            if (this._cliVersion === null) {
                this._cliVersionState = CliVersionState.NotExisting;
                this._cliVersionErrorMessage = "NativeScript CLI not found, please run 'npm -g install nativescript' to install it.";
            }
            else if (this._cliVersion.compareBySubminorTo(minExpectedCliVersion) < 0) {
                this._cliVersionState = CliVersionState.OlderThanSupported;
                this._cliVersionErrorMessage = `The existing NativeScript extension is compatible with NativeScript CLI v${this._minExpectedCliVersion} or greater. The currently installed NativeScript CLI is v${this._cliVersion}. You can update the NativeScript CLI by executing 'npm install -g nativescript'.`;
            }
        }
    }

    public get version() { return this._cliVersion; }

    public get state() { return this._cliVersionState; }

    public get isCompatible() { return this._cliVersionState == CliVersionState.Compatible; }

    public get errorMessage() { return this._cliVersionErrorMessage; }
}

export class NativeScriptCli {
    private _path: string;
    private _cliVersion: CliVersion;
    private _logger: Logger;

    constructor(cliPath: string, logger: Logger) {
        this._path = cliPath;
        this._logger = logger;

        let versionStr = null;
        try {
            versionStr = this.executeSync(["--version"], undefined);
        }
        catch(e) {
            this._logger.log(e, Tags.FrontendMessage);
            throw new Error("NativeScript CLI not found. Use 'nativescript.tnsPath' workspace setting to explicitly set the absolute path to the NativeScript CLI.");
        }
        let cliVersion: Version = versionStr ? Version.parse(versionStr) : null;
        this._cliVersion = new CliVersion(cliVersion, utils.getMinSupportedCliVersion());
        if (!this._cliVersion.isCompatible) {
            throw new Error(this._cliVersion.errorMessage);
        }
    }

    public get path(): string { return this._path; }

    public get version(): CliVersion {
        return this._cliVersion;
    }

    public executeSync(args: string[], cwd: string): string {
        let command: string = `${this._path} ` + args.join(' ');
        this._logger.log(`[NativeScriptCli] execute: ${command}`, Tags.FrontendMessage);
        return execSync(command, { encoding: "utf8", cwd: cwd, shell: process.env.SHELL }).toString().trim();
    }

    public execute(args: string[], cwd: string): ChildProcess {
        let command: string = `${this._path} ` + args.join(' ');
        this._logger.log(`[NativeScriptCli] execute: ${command}`, Tags.FrontendMessage);

        let options = { cwd: cwd, shell: process.env.SHELL };
        let child: ChildProcess = spawn(this._path, args, options);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        return child;
    }
}
