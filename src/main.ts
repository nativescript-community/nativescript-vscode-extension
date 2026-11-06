import * as semver from 'semver';
import * as vscode from 'vscode';
import * as utils from './common/utilities';
import { AndroidProject } from './project/androidProject';
import { IosProject } from './project/iosProject';
import { Project } from './project/project';
import { ChannelLogger } from './services/channelLogger';
import { services } from './services/extensionHostServices';
import { COMPLETION_PROVIDER } from './services/language-services/autocomplete';
import { HOVER_PROVIDERS } from './services/language-services/hover/hover';
import { SUGGESTION_PROVIDERS } from './services/language-services/suggestions';
import { DebugManager } from './debug-adapter/debugManager';
import { NativeScriptDebugAdapter } from './debug-adapter/nativeScriptDebugAdapter';

export function activate(context: vscode.ExtensionContext) {
  services.globalState = context.globalState;
  services.cliPath = 'ns';

  const channel = vscode.window.createOutputChannel('NativeScript Extension');

  services.logger = new ChannelLogger(channel);

  const packageJSON = vscode.extensions.getExtension('nativescript.nativescript')!.packageJSON;
  const cliVersion = services.cli().executeGetVersion();

  if (!cliVersion) {
    vscode.window.showErrorMessage(
      "NativeScript CLI not found. Use 'nativescript.nsPath' workspace setting to explicitly set the absolute path to the NativeScript CLI.",
    );
    return;
  }

  if (!semver.gte(cliVersion, packageJSON.minNativescriptCliVersion)) {
    vscode.window.showErrorMessage(
      `The existing NativeScript extension is compatible with NativeScript CLI v${packageJSON.minNativescriptCliVersion} or greater. The currently installed NativeScript CLI is v${cliVersion}. You can update the NativeScript CLI by executing 'npm install -g nativescript'.`,
    );
    return;
  }

  services.cliVersion = cliVersion;
  services.extensionVersion = packageJSON.version;

  logExtensionInfo(cliVersion, packageJSON);

  services.analyticsService.initialize();

  const debugManager = new DebugManager(services.logger);

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('nativescript', {
      createDebugAdapterDescriptor(session) {
        const adapter = new NativeScriptDebugAdapter(debugManager);
        adapter.setParentSession(session);
        return new vscode.DebugAdapterInlineImplementation(adapter);
      },
    }),
  );

  context.subscriptions.push({ dispose: () => debugManager.dispose() });

  const showOutputChannelCommand = vscode.commands.registerCommand('nativescript.showOutputChannel', () => {
    channel.show();
  });

  const runCommand = (project: Project) => {
    if (!vscode.workspace.workspaceFolders?.length) {
      vscode.window.showErrorMessage('No workspace opened.');
      return;
    }

    const runChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
    runChannel.clear();
    runChannel.show();

    services.analyticsService.runRunCommand(project.platformName());

    const tnsProcess = project.run();
    tnsProcess.on('error', () => {
      vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
    });
    tnsProcess.stderr!.on('data', (data: Buffer) => {
      runChannel.append(data.toString());
    });
    tnsProcess.stdout!.on('data', (data: Buffer) => {
      runChannel.append(data.toString());
    });
    tnsProcess.on('exit', () => {
      tnsProcess.stdout!.removeAllListeners('data');
      tnsProcess.stderr!.removeAllListeners('data');
    });
    tnsProcess.on('close', () => {
      runChannel.hide();
    });

    const disposable = {
      dispose: () => {
        services.buildService.disconnect();
        utils.killProcess(tnsProcess);
      },
    };

    context.subscriptions.push(disposable);
  };

  const getWorkspaceRoot = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
    const root = getWorkspaceRoot();
    if (root) return runCommand(new IosProject(root, services.cli()));
  });

  const runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
    const root = getWorkspaceRoot();
    if (root) return runCommand(new AndroidProject(root, services.cli()));
  });

  context.subscriptions.push(runIosCommand);
  context.subscriptions.push(runAndroidCommand);
  context.subscriptions.push(showOutputChannelCommand);

  context.subscriptions.push(COMPLETION_PROVIDER);
  context.subscriptions.concat(SUGGESTION_PROVIDERS);
  context.subscriptions.concat(HOVER_PROVIDERS);
}

function logExtensionInfo(
  cliVersion: string,
  packageJSON: { version?: string; buildVersion?: string; commitId?: string },
): void {
  packageJSON.version && services.logger.log(`Version: ${packageJSON.version}`);
  packageJSON.buildVersion && services.logger.log(`Build version: ${packageJSON.buildVersion}`);
  packageJSON.commitId && services.logger.log(`Commit id: ${packageJSON.commitId}`);
  services.logger.log(`NativeScript CLI: ${cliVersion}`);
}
