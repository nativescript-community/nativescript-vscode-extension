import {Logger} from '../common/logger';

export class Services {
    private static _logger: Logger;

    public static get logger(): Logger {
        this._logger = this._logger || new Logger();
        return this._logger;
    }
}
