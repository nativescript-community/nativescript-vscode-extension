import * as vscode from 'vscode';

export class WorkspaceConfigService {
  public get isAnalyticsEnabled(): boolean {
    return vscode.workspace.getConfiguration('nativescript').get<boolean>('analytics.enabled', false);
  }

  public async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    await vscode.workspace
      .getConfiguration('nativescript')
      .update('analytics.enabled', enabled, vscode.ConfigurationTarget.Global);
  }

  public get nsPath(): string {
    return vscode.workspace.getConfiguration('nativescript').get<string>('nsPath', 'ns');
  }
}
