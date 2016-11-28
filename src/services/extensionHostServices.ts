import * as vscode from 'vscode';
import {Services} from './services';
import {ExtensionVersionService} from '../common/extensionVersionService';
import {ExtensionServer} from '../ipc/extensionServer';
import {AnalyticsService} from '../analytics/analyticsService';

export class ExtensionHostServices extends Services {
    private static _globalState: vscode.Memento;

    private static _extensionVersionService: ExtensionVersionService;
    private static _extensionServer: ExtensionServer;
    private static _analyticsService: AnalyticsService;

    public static get globalState(): vscode.Memento { return this._globalState; }

    public static set globalState(globalState: vscode.Memento) { this._globalState = globalState; }

    public static get extensionVersionService(): ExtensionVersionService {
        if (!this._extensionVersionService && !this._globalState) {
            throw new Error("Global state has no value.");
        }
        this._extensionVersionService = this._extensionVersionService || new ExtensionVersionService(this.globalState);
        return this._extensionVersionService;
    }

    public static get extensionServer(): ExtensionServer {
        this._extensionServer = this._extensionServer || new ExtensionServer();
        return this._extensionServer;
    }

    public static get analyticsService(): AnalyticsService {
        this._analyticsService = this._analyticsService || new AnalyticsService();
        return this._analyticsService;
    }
}