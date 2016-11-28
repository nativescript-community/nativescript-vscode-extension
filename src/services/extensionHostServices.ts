import * as vscode from 'vscode';
import {Services as BaseServices} from './services';
import {ExtensionVersionService} from '../common/extensionVersionService';
import {ExtensionServer} from '../ipc/extensionServer';
import {AnalyticsService} from '../analytics/analyticsService';
import {WorkspaceConfigService} from '../common/workspaceConfigService';

export class ExtensionHostServices extends BaseServices {
    private _globalState: vscode.Memento;

    private _workspaceConfigService: WorkspaceConfigService;
    private _extensionVersionService: ExtensionVersionService;
    private _extensionServer: ExtensionServer;
    private _analyticsService: AnalyticsService;

    public get globalState(): vscode.Memento { return this._globalState; }

    public set globalState(globalState: vscode.Memento) { this._globalState = globalState; }

    public workspaceConfigService(): WorkspaceConfigService {
        this._workspaceConfigService = this._workspaceConfigService || new WorkspaceConfigService();
        return this._workspaceConfigService;
    }

    public extensionVersionService(): ExtensionVersionService {
        if (!this._extensionVersionService && !this._globalState) {
            throw new Error("Global state has no value.");
        }
        this._extensionVersionService = this._extensionVersionService || new ExtensionVersionService(this.globalState);
        return this._extensionVersionService;
    }

    public extensionServer(): ExtensionServer {
        this._extensionServer = this._extensionServer || new ExtensionServer();
        return this._extensionServer;
    }

    public analyticsService(): AnalyticsService {
        this._analyticsService = this._analyticsService || new AnalyticsService();
        return this._analyticsService;
    }
}

export let Services = new ExtensionHostServices();