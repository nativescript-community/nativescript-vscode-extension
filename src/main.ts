import * as vscode from 'vscode';
import * as child from 'child_process';
import * as ns from './services/NsCliService';
import {ExtensionVersionService} from './services/ExtensionVersionService';
import {AnalyticsService} from './services/analytics/AnalyticsService';
import {ExtensionServer} from './services/ipc/ExtensionServer';

function performVersionsCheck(context: vscode.ExtensionContext) {
    // Check the state of the existing NativeScript CLI
    let cliInfo: ns.CliVersionInfo = new ns.CliVersionInfo();
    if (cliInfo.getErrorMessage() !== null) {
        vscode.window.showErrorMessage(cliInfo.getErrorMessage());
    }
    else {
        // Checks whether a new version of the extension is available
        let extensionVersionPromise: Promise<ExtensionVersionService> = null;

        // Check the cache for extension version information
        let extensionVersion: any = context.globalState.get<any>('ExtensionVersionInfo');
        if (extensionVersion) {
            let extensionVersionInfo = new ExtensionVersionService(extensionVersion.latestVersionMetadata, extensionVersion.timestamp);
            if (extensionVersionInfo.getTimestamp() > Date.now() - 24 * 60 * 60 * 1000 /* Cache the version for a day */) {
                extensionVersionPromise = Promise.resolve(extensionVersionInfo);
            }
        }

        if (!extensionVersionPromise) {
            // Takes the slow path and checks for newer version in the VS Code Marketplace
            extensionVersionPromise = ExtensionVersionService.createFromMarketplace();
        }
        extensionVersionPromise.then(extensionInfo => {
            if (extensionInfo) {
                context.globalState.update('ExtensionVersionInfo', { latestVersionMetadata: extensionInfo.getLatestVersionMeta(), timestamp: extensionInfo.getTimestamp() }); // save in cache
                if (!extensionInfo.isLatest()) {
                    vscode.window.showWarningMessage(`A new version of the NativeScript extension is available. Run "Extensions: Show Outdated Extensions" command and select "NativeScript" to update to v${extensionInfo.getLatestVersionMeta().version}.`);
                }
            }
        }, error => { /* In case of error behave as if the extension verison is latest */ });
    }
}

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    ExtensionServer.getInstance().start();
    performVersionsCheck(context);

    let runCommand = (project: ns.NSProject) => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }

        // Show output channel
        let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platform()}`);
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);

        AnalyticsService.getInstance().runRunCommand(project.platform());

        return project.run()
        .then(tnsProcess => {
            tnsProcess.on('error', err => {
                vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
            });
            tnsProcess.stderr.on('data', data => {
                runChannel.append(data.toString());
            });
            tnsProcess.stdout.on('data', data => {
                runChannel.append(data.toString());
            });
            tnsProcess.on('exit', exitCode => {
                tnsProcess.stdout.removeAllListeners('data');
                tnsProcess.stderr.removeAllListeners('data');
            });
            tnsProcess.on('close', exitCode => {
                runChannel.hide();
            });
        });
    };

    let runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        return runCommand(new ns.IosProject(vscode.workspace.rootPath));
    });

    let runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        return runCommand(new ns.AndroidProject(vscode.workspace.rootPath));
    });

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
}

export function deactivate() {
    ExtensionServer.getInstance().stop();
}