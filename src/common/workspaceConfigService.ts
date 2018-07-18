import * as vscode from 'vscode';

export class WorkspaceConfigService {
    public get isAnalyticsEnabled(): boolean {
        return vscode.workspace.getConfiguration('nativescript').get('analytics.enabled') as boolean;
    }

    public set isAnalyticsEnabled(isAnalyticsEnabled: boolean) {
        vscode.workspace.getConfiguration('nativescript').update('analytics.enabled', isAnalyticsEnabled, vscode.ConfigurationTarget.Global);
    }

    public get tnsPath(): string {
         return vscode.workspace.getConfiguration('nativescript').get('tnsPath') as string;
    }
}
