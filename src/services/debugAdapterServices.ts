import {Services as BaseServices} from './services';
import {ExtensionClient} from '../ipc/extensionClient';
import {Logger} from '../common/logger';

export class DebugAdapterServices extends BaseServices {
    private _extensionClient: ExtensionClient;
    private _appRoot: string;

    public get appRoot(): string { return this._appRoot; }

    public set appRoot(appRoot: string) { this._appRoot = appRoot; }

    public extensionClient(): ExtensionClient {
        if (!this._extensionClient && !this._appRoot) {
            throw new Error("appRoot has no value.");
        }
        this._extensionClient = this._extensionClient || new ExtensionClient(this._appRoot);
        return this._extensionClient;
    }
}

export let Services = new DebugAdapterServices();