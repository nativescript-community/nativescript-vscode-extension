import * as vscode from 'vscode';
import { isNativeScriptProject } from '../project/projectInfo';

export function launchConfigurations(platform: NodeJS.Platform = process.platform): vscode.DebugConfiguration[] {
  const platforms = platform === 'darwin' ? ['iOS', 'Android'] : ['Android'];
  return platforms.map((name) => ({
    name: `Launch on ${name}`,
    type: 'nativescript',
    request: 'launch',
    platform: name.toLowerCase(),
    appRoot: '${workspaceFolder}',
    sourceMaps: true,
    watch: true,
  }));
}

/** Lists launch configurations in the Run and Debug view, so NativeScript workspaces need no launch.json. */
export class DynamicConfigurationProvider implements vscode.DebugConfigurationProvider {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  public provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined): vscode.DebugConfiguration[] {
    return folder && isNativeScriptProject(folder.uri.fsPath) ? launchConfigurations(this.platform) : [];
  }
}

/**
 * Has no provideDebugConfigurations on purpose: a new launch.json is then seeded from package.json's
 * initialConfigurations, which also include the test and attach configurations.
 */
export class ConfigurationResolver implements vscode.DebugConfigurationProvider {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  /** F5 without a launch.json arrives as an empty configuration; anything else is used as written. */
  public async resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): Promise<vscode.DebugConfiguration | undefined> {
    if (config.type || config.request || config.name) return config;

    const choices = launchConfigurations(this.platform);
    if (choices.length === 1) return choices[0];

    const picked = await vscode.window.showQuickPick(
      choices.map((configuration) => ({ label: configuration.name, configuration })),
      { placeHolder: 'Select the platform to debug on' },
    );
    // undefined cancels the launch.
    return picked?.configuration;
  }
}
