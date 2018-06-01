import * as vscode from 'vscode';
import {Services} from './services/extensionHostServices';
import {Project} from './project/project';
import {IosProject} from './project/iosProject';
import {AndroidProject} from './project/androidProject';
import * as utils from './common/utilities';
import * as extProtocol from './common/extensionProtocol';
import { ChannelLogger } from './services/channelLogger';
import { ILogger } from './common/logger';
import * as semver from "semver";

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    Services.globalState = context.globalState;
    Services.cliPath = Services.workspaceConfigService.tnsPath || Services.cliPath;

    const channel = vscode.window.createOutputChannel("NativeScript Extension");
    Services.logger = new ChannelLogger(channel);

    const packageJSON = vscode.extensions.getExtension("Telerik.nativescript").packageJSON;
    const cliVersion = Services.cli().executeGetVersion();

    if(!cliVersion) {
        vscode.window.showErrorMessage("NativeScript CLI not found. Use 'nativescript.tnsPath' workspace setting to explicitly set the absolute path to the NativeScript CLI.");

        return;
    }

    if(!semver.gte(cliVersion, packageJSON.minNativescriptCliVersion)) {
        vscode.window.showErrorMessage( `The existing NativeScript extension is compatible with NativeScript CLI v${packageJSON.minNativescriptCliVersion} or greater.
            The currently installed NativeScript CLI is v${cliVersion}.You can update the NativeScript CLI by executing 'npm install -g nativescript'.`);

        return;
    }

    Services.cliVersion = cliVersion;
    Services.extensionVersion = packageJSON.version;

    logExtensionInfo(cliVersion, packageJSON);

    Services.analyticsService.initialize();

    let showOutputChannelCommand = vscode.commands.registerCommand('nativescript.showOutputChannel', () => {
        channel.show();
    });

    let beforeBuildDisposables = new Array<vscode.Disposable>();
    let runCommand = (project: Project) => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }

        // Show output channel
        let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);

        Services.analyticsService.runRunCommand(project.platformName());

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

        const disposable = {
            dispose: () => utils.killProcess(tnsProcess)
        };

        context.subscriptions.push(disposable);
        beforeBuildDisposables.push(disposable);
    };

    let runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        return runCommand(new IosProject(vscode.workspace.rootPath, Services.cli()));
    });

    let runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        return runCommand(new AndroidProject(vscode.workspace.rootPath, Services.cli()));
    });

    context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
        if(event.event === extProtocol.BEFORE_DEBUG_START) {
            beforeBuildDisposables.forEach(disposable => disposable.dispose());
        }

        if(event.event === extProtocol.NS_DEBUG_ADAPTER_MESSAGE) {
            const request = event.body as extProtocol.Request;
            const service = Services[request.service];
            const method = service[request.method];
            const response = typeof method === 'function' ? service[request.method].call(service, ...request.args) : method;

            if(response.then) {
                response.then(actualResponse => event.session.customRequest("onExtensionResponse", { requestId: request.id, result: actualResponse }));

                return;
            }

            event.session.customRequest("onExtensionResponse", { requestId: request.id, result: response })
        }
    }));

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
    context.subscriptions.push(showOutputChannelCommand);
}

function logExtensionInfo(cliVersion: string, packageJSON: any): void {
    packageJSON.version && Services.logger.log(`Version: ${packageJSON.version}`);
    packageJSON.buildVersion && Services.logger.log(`Build version: ${packageJSON.buildVersion}`);
    packageJSON.commitId && Services.logger.log(`Commit id: ${packageJSON.commitId}`);
    Services.logger.log(`NativeScript CLI: ${cliVersion}`);
}