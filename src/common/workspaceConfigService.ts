import * as vscode from 'vscode';
import { ILogger, LogLevel } from './logger';

function isExplicitlySet(config: vscode.WorkspaceConfiguration, key: string): boolean {
  const inspected = config.inspect(key);
  return (
    inspected?.globalValue !== undefined ||
    inspected?.workspaceValue !== undefined ||
    inspected?.workspaceFolderValue !== undefined
  );
}

export class WorkspaceConfigService {
  private warnedAboutTnsPath = false;

  constructor(private readonly logger?: ILogger) {}

  public get isAnalyticsEnabled(): boolean {
    return vscode.workspace.getConfiguration('nativescript').get<boolean>('analytics.enabled', false);
  }

  public async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    await vscode.workspace
      .getConfiguration('nativescript')
      .update('analytics.enabled', enabled, vscode.ConfigurationTarget.Global);
  }

  /** `nativescript.nsPath`, falling back to the deprecated `nativescript.tnsPath` when only that one is set. */
  public get nsPath(): string {
    const config = vscode.workspace.getConfiguration('nativescript');

    if (!isExplicitlySet(config, 'nsPath') && isExplicitlySet(config, 'tnsPath')) {
      const tnsPath = config.get<string>('tnsPath');
      if (tnsPath) {
        if (!this.warnedAboutTnsPath) {
          this.warnedAboutTnsPath = true;
          this.logger?.log(
            "The 'nativescript.tnsPath' setting is deprecated. Use 'nativescript.nsPath' instead.",
            LogLevel.Warn,
          );
        }
        return tnsPath;
      }
    }

    return config.get<string>('nsPath', 'ns');
  }
}
