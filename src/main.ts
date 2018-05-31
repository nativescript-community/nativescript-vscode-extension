import * as vscode from 'vscode';
import {CliVersion} from './project/nativeScriptCli';
import {Services} from './services/extensionHostServices';
import {Project} from './project/project';
import {IosProject} from './project/iosProject';
import {AndroidProject} from './project/androidProject';
import * as utils from './common/utilities';
import * as extProtocol from './common/extensionProtocol';
import { ChannelLogger } from './services/channelLogger';
import { ILogger } from './common/logger';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    Services.globalState = context.globalState;
    Services.cliPath = Services.workspaceConfigService.tnsPath || Services.cliPath;

    const channel = vscode.window.createOutputChannel("NativeScript Extension");
    const logger = new ChannelLogger(channel);
    Services.logger = logger;

    // Check if NativeScript CLI is installed globally and if it is compatible with the extension version
    let cliVersion = Services.cli().version;
    if (!cliVersion.isCompatible) {
        vscode.window.showErrorMessage(cliVersion.errorMessage);
    }

    logExtensionInfo(logger, cliVersion.version.toString());

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

function logExtensionInfo(logger: ILogger, cliVersion: string): void {
    const packageJSON = vscode.extensions.getExtension("Telerik.nativescript").packageJSON;

    packageJSON.version && logger.log(`Version: ${packageJSON.version}`);
    packageJSON.buildVersion && logger.log(`Build version: ${packageJSON.buildVersion}`);
    packageJSON.commitId && logger.log(`Commit id: ${packageJSON.commitId}`);
    logger.log(`NativeScript CLI: ${cliVersion}`);
}