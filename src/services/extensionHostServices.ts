import * as vscode from 'vscode';
import {Services as BaseServices} from './services';
import {iOSTeamService} from './iOSTeamService';
import {AnalyticsService} from '../analytics/analyticsService';
import {WorkspaceConfigService} from '../common/workspaceConfigService';

export class ExtensionHostServices extends BaseServices {
    private _globalState: vscode.Memento;

    private _workspaceConfigService: WorkspaceConfigService;
    private _iOSTeamService: iOSTeamService;
    private _analyticsService: AnalyticsService;

    public get globalState(): vscode.Memento { return this._globalState; }

    public set globalState(globalState: vscode.Memento) { this._globalState = globalState; }

    public get workspaceConfigService(): WorkspaceConfigService {
        this._workspaceConfigService = this._workspaceConfigService || new WorkspaceConfigService();
        return this._workspaceConfigService;
    }

    public get iOSTeamService(): iOSTeamService {
        this._iOSTeamService = this._iOSTeamService || new iOSTeamService();
        return this._iOSTeamService;
    }

    public get analyticsService(): AnalyticsService {
        this._analyticsService = this._analyticsService || new AnalyticsService(this.globalState);
        return this._analyticsService;
    }
}

export let Services = new ExtensionHostServices();