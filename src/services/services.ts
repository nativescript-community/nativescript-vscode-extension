import {ILogger} from '../common/logger';
import {NativeScriptCli} from '../project/nativeScriptCli';

export class Services {
    protected _cliPath: string;

    protected _logger: ILogger;
    protected _cli: NativeScriptCli;

    public get cliPath(): string { return this._cliPath; }

    public set cliPath(cliPath: string) { this._cliPath = cliPath; }

    public get logger(): ILogger { return this._logger; }

    public set logger(logger: ILogger) { this._logger = logger; }

    public cli(): NativeScriptCli {
        this._cli = this._cli || new NativeScriptCli(this._cliPath, this.logger);
        return this._cli;
    }
}
