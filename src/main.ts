import * as vscode from 'vscode';
import * as child from 'child_process';
import * as ns from './services/NsCliService';
import {ExtensionVersionService} from './services/ExtensionVersionService';
import {AnalyticsService} from './services/analytics/AnalyticsService';
import {ExtensionServer} from './services/ipc/ExtensionServer';
import {ExtensionHostServices as Services} from './services/services/extensionHostServices';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    Services.globalState = context.globalState;
    Services.extensionServer.start();

    // Check for newer extension version
    Services.extensionVersionService.isLatestInstalled.then(result => {
        if (!result.result) {
            vscode.window.showWarningMessage(result.error);
        }
    });

    // Check if NativeScript CLI is installed globally and if it is compatible with the extension version
    let cliInfo: ns.CliVersionInfo = new ns.CliVersionInfo();
    if (cliInfo.getErrorMessage() !== null) {
        vscode.window.showErrorMessage(cliInfo.getErrorMessage());
    }

    let runCommand = (project: ns.NSProject) => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }

        // Show output channel
        let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platform()}`);
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);

        Services.analyticsService.runRunCommand(project.platform());

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
    Services.extensionServer.stop();
}