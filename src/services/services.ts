import {Logger} from '../common/logger';
import {NativeScriptCli} from '../project/nativeScriptCli';

export class Services {
    protected static _cliPath: string = "tns";

    protected static _logger: Logger;
    protected static _cli: NativeScriptCli;

    public static get cliPath(): string { return this._cliPath; }

    public static set cliPath(cliPath: string) { this._cliPath = cliPath; }

    public static get logger(): Logger {
        this._logger = this._logger || new Logger();
        return this._logger;
    }

    public static get cli(): NativeScriptCli {
        this._cli = this._cli || new NativeScriptCli(this._cliPath);
        return this._cli;
    }
}
