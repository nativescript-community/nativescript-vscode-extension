import * as vscode from 'vscode';
import {CliVersion} from './project/nativeScriptCli';
import {Services} from './services/extensionHostServices';
import {Project} from './project/project';
import {IosProject} from './project/iosProject';
import {AndroidProject} from './project/androidProject';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    Services.globalState = context.globalState;
    Services.cliPath = Services.workspaceConfigService().tnsPath || Services.cliPath;
    Services.extensionServer().start();

    // Check for newer extension version
    Services.extensionVersionService().isLatestInstalled.then(result => {
        if (!result.result) {
            vscode.window.showWarningMessage(result.error);
        }
    });

    // Check if NativeScript CLI is installed globally and if it is compatible with the extension version
    let cliVersion = Services.cli().version;
    if (!cliVersion.isCompatible) {
        vscode.window.showErrorMessage(cliVersion.errorMessage);
    }

    let runCommand = (project: Project) => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }

        // Show output channel
        let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);

        Services.analyticsService().runRunCommand(project.platformName());

        let tnsProcess = project.run();
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
    };

    let runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        return runCommand(new IosProject(vscode.workspace.rootPath, Services.cli()));
    });

    let runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        return runCommand(new AndroidProject(vscode.workspace.rootPath, Services.cli()));
    });

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
}

export function deactivate() {
    Services.extensionServer().stop();
}