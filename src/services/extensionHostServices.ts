import * as path from 'path';
import * as vscode from 'vscode';
import { AnalyticsService } from '../analytics/analyticsService';
import { ILogger } from '../common/logger';
import { WorkspaceConfigService } from '../common/workspaceConfigService';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { BuildService } from './buildService';
import { iOSTeamService } from './iOSTeamService';

export class ExtensionHostServices {
  public extensionVersion = '';
  public minCliVersion = '0.0.0';

  private _logger!: ILogger;
  private _globalState!: vscode.Memento;

  private _workspaceConfigService?: WorkspaceConfigService;
  private _iOSTeamService?: iOSTeamService;
  private _analyticsService?: AnalyticsService;
  private _buildService?: BuildService;

  public get logger(): ILogger {
    return this._logger;
  }

  public set logger(logger: ILogger) {
    this._logger = logger;
  }

  public get globalState(): vscode.Memento {
    return this._globalState;
  }

  public set globalState(globalState: vscode.Memento) {
    this._globalState = globalState;
  }

  public get workspaceConfigService(): WorkspaceConfigService {
    return (this._workspaceConfigService ??= new WorkspaceConfigService(this.logger));
  }

  public get iOSTeamService(): iOSTeamService {
    return (this._iOSTeamService ??= new iOSTeamService());
  }

  public get analyticsService(): AnalyticsService {
    return (this._analyticsService ??= new AnalyticsService(
      this.globalState,
      this.workspaceConfigService,
      this.logger,
      this.extensionVersion,
    ));
  }

  public get buildService(): BuildService {
    return (this._buildService ??= new BuildService(this.logger));
  }

  /**
   * Bare command names (e.g. `ns`) are looked up on PATH; path-like relative values
   * (e.g. `./node_modules/.bin/ns`) are resolved against the app root.
   */
  public createCli(appRoot?: string): NativeScriptCli {
    const nsPath = this.workspaceConfigService.nsPath;
    const isRelativePath = !path.isAbsolute(nsPath) && /[\\/]/.test(nsPath);
    const resolved = isRelativePath && appRoot ? path.join(appRoot, nsPath) : nsPath;

    return new NativeScriptCli(resolved, this.logger);
  }
}

export const services = new ExtensionHostServices();
