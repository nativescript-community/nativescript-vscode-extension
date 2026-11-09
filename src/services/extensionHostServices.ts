import * as path from 'path';
import * as vscode from 'vscode';
import { AnalyticsService } from '../analytics/analyticsService';
import { ILogger } from '../common/logger';
import { WorkspaceConfigService } from '../common/workspaceConfigService';
import { quoteShellArg } from '../common/utilities';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { findLocalCli } from '../project/projectInfo';
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
   * With no nsPath configured, prefers a CLI installed in the project (or a parent directory) over the global `ns`.
   * A configured bare command (e.g. `ns`) is looked up on PATH; a path-like relative value
   * (e.g. `./node_modules/.bin/ns`) is resolved against the app root.
   */
  public createCli(appRoot?: string): NativeScriptCli {
    const configured = this.workspaceConfigService.configuredNsPath;

    if (!configured) {
      const local = appRoot ? findLocalCli(appRoot) : undefined;
      // Configured values are passed to the shell as-is (so `npx ns` keeps working); a discovered path is quoted.
      return new NativeScriptCli(local ? quoteShellArg(local) : 'ns', this.logger);
    }

    const isRelativePath = !path.isAbsolute(configured) && /[\\/]/.test(configured);
    const resolved = isRelativePath && appRoot ? path.join(appRoot, configured) : configured;

    return new NativeScriptCli(resolved, this.logger);
  }
}

export const services = new ExtensionHostServices();
