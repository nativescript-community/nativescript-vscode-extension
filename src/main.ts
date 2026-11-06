import * as vscode from 'vscode';
import * as utils from './common/utilities';
import { DebugManager } from './debug-adapter/debugManager';
import { NativeScriptDebugAdapter } from './debug-adapter/nativeScriptDebugAdapter';
import { AndroidProject } from './project/androidProject';
import { IosProject } from './project/iosProject';
import { Project } from './project/project';
import { ChannelLogger } from './services/channelLogger';
import { services } from './services/extensionHostServices';
import { COMPLETION_PROVIDER } from './services/language-services/autocomplete';
import { HOVER_PROVIDERS } from './services/language-services/hover/hover';
import { SUGGESTION_PROVIDERS } from './services/language-services/suggestions';

interface ExtensionPackageJson {
  version: string;
  minNativescriptCliVersion: string;
  buildVersion?: string;
  commitId?: string;
}

export function activate(context: vscode.ExtensionContext): void {
  const packageJSON = context.extension.packageJSON as ExtensionPackageJson;
  const channel = vscode.window.createOutputChannel('NativeScript Extension');
  context.subscriptions.push(channel);

  services.globalState = context.globalState;
  services.logger = new ChannelLogger(channel);
  services.extensionVersion = packageJSON.version;
  services.minCliVersion = packageJSON.minNativescriptCliVersion;

  // Registered before the CLI check so a missing CLI surfaces as a launch error instead of an unknown debug type.
  const debugManager = new DebugManager(services.logger);
  context.subscriptions.push(
    debugManager,
    vscode.debug.registerDebugAdapterDescriptorFactory('nativescript', {
      createDebugAdapterDescriptor(session) {
        const adapter = new NativeScriptDebugAdapter(debugManager);
        adapter.setParentSession(session);
        return new vscode.DebugAdapterInlineImplementation(adapter);
      },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nativescript.showOutputChannel', () => channel.show()),
    vscode.commands.registerCommand('nativescript.runIos', () =>
      runCommand(context, (root) => new IosProject(root, services.createCli(root))),
    ),
    vscode.commands.registerCommand('nativescript.runAndroid', () =>
      runCommand(context, (root) => new AndroidProject(root, services.createCli(root))),
    ),
    COMPLETION_PROVIDER,
    ...SUGGESTION_PROVIDERS,
    ...HOVER_PROVIDERS,
  );

  logExtensionInfo(packageJSON);
  void checkCli();
}

async function checkCli(): Promise<void> {
  try {
    const cliVersion = await services.createCli().getSupportedVersion(services.minCliVersion);
    services.logger.log(`NativeScript CLI: ${cliVersion}`);
    services.analyticsService.initialize(cliVersion);
  } catch (e) {
    void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
  }
}

function runCommand(context: vscode.ExtensionContext, createProject: (root: string) => Project): void {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    void vscode.window.showErrorMessage('No workspace opened.');
    return;
  }

  let project: Project;
  try {
    project = createProject(root);
  } catch (e) {
    void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    return;
  }

  const runChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
  runChannel.clear();
  runChannel.show();

  void services.analyticsService.trackRun(project.platformName());

  const tnsProcess = project.run();
  const disposable = {
    dispose: () => {
      utils.killProcess(tnsProcess);
      runChannel.dispose();
    },
  };
  context.subscriptions.push(disposable);

  tnsProcess.on('error', () => {
    void vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
  });
  tnsProcess.stderr!.on('data', (data: Buffer | string) => runChannel.append(data.toString()));
  tnsProcess.stdout!.on('data', (data: Buffer | string) => runChannel.append(data.toString()));
  tnsProcess.on('exit', () => {
    tnsProcess.stdout!.removeAllListeners('data');
    tnsProcess.stderr!.removeAllListeners('data');
  });
  tnsProcess.on('close', () => {
    runChannel.hide();
    const index = context.subscriptions.indexOf(disposable);
    if (index >= 0) context.subscriptions.splice(index, 1);
  });
}

function logExtensionInfo(packageJSON: ExtensionPackageJson): void {
  services.logger.log(`Version: ${packageJSON.version}`);
  if (packageJSON.buildVersion) services.logger.log(`Build version: ${packageJSON.buildVersion}`);
  if (packageJSON.commitId) services.logger.log(`Commit id: ${packageJSON.commitId}`);
}
