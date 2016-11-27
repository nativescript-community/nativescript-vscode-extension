import {Services} from './services';
import {ExtensionClient} from '../ipc/extensionClient';
import {Logger} from '../common/Logger';

export class DebugAdapterServices extends Services {
    private static _extensionClient: ExtensionClient;
    private static _appRoot: string;

    public static get appRoot(): string { return this._appRoot; }

    public static set appRoot(appRoot: string) { this._appRoot = appRoot; }

    public static get extensionClient(): ExtensionClient {
        if (!this._extensionClient && !this._appRoot) {
            throw new Error("appRoot has no value.");
        }
        this._extensionClient = this._extensionClient || new ExtensionClient(this._appRoot);
        return this._extensionClient;
    }
}