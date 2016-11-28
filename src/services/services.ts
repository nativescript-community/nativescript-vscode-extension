import {Logger} from '../common/logger';
import {NativeScriptCli} from '../project/nativeScriptCli';

export class Services {
    protected _cliPath: string;

    protected _logger: Logger;
    protected _cli: NativeScriptCli;

    public get cliPath(): string { return this._cliPath; }

    public set cliPath(cliPath: string) { this._cliPath = cliPath; }

    public logger(): Logger {
        this._logger = this._logger || new Logger();
        return this._logger;
    }

    public cli(): NativeScriptCli {
        this._cli = this._cli || new NativeScriptCli(this._cliPath, this.logger());
        return this._cli;
    }
}
