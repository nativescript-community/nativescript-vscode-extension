import * as vscode from 'vscode';
import { AnalyticsService } from '../analytics/analyticsService';
import { WorkspaceConfigService } from '../common/workspaceConfigService';
import { iOSTeamService } from './iOSTeamService';
import { Services as BaseServices } from './services';
import { BuildService } from "./buildService";

export class ExtensionHostServices extends BaseServices {
    public cliVersion: string;
    public extensionVersion: string;

    private _globalState: vscode.Memento;

    private _workspaceConfigService: WorkspaceConfigService;
    private _iOSTeamService: iOSTeamService;
    private _analyticsService: AnalyticsService;
    private _buildService: BuildService;

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
        this._analyticsService = this._analyticsService || new AnalyticsService(this.globalState, this.cliVersion, this.extensionVersion, this._logger);

        return this._analyticsService;
    }

    public get buildService(): BuildService {
        this._buildService = this._buildService || new BuildService(this._logger);

        return this._buildService;
    }
}

export let services = new ExtensionHostServices();
