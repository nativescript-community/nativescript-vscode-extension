import * as semver from 'semver';
import * as vscode from 'vscode';
import * as extProtocol from './common/extensionProtocol';
import * as utils from './common/utilities';
import { AndroidProject } from './project/androidProject';
import { IosProject } from './project/iosProject';
import { Project } from './project/project';
import { ChannelLogger } from './services/channelLogger';
import { services } from './services/extensionHostServices';
import { COMPLETION_PROVIDER } from './services/language-services/autocomplete';
import { HOVER_PROVIDERS } from './services/language-services/hover/hover';
import { SUGGESTION_PROVIDERS } from './services/language-services/suggestions';

// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    services.globalState = context.globalState;
    services.cliPath = 'tns';

    const channel = vscode.window.createOutputChannel('NativeScript Extension');

    services.logger = new ChannelLogger(channel);

    const packageJSON = vscode.extensions.getExtension('Telerik.nativescript').packageJSON;
    const cliVersion = services.cli().executeGetVersion();

    if (!cliVersion) {
        // tslint:disable-next-line:max-line-length
        vscode.window.showErrorMessage("NativeScript CLI not found. Use 'nativescript.tnsPath' workspace setting to explicitly set the absolute path to the NativeScript CLI.");

        return;
    }

    if (!semver.gte(cliVersion, packageJSON.minNativescriptCliVersion)) {
        // tslint:disable-next-line:max-line-length
        vscode.window.showErrorMessage(`The existing NativeScript extension is compatible with NativeScript CLI v${packageJSON.minNativescriptCliVersion} or greater.
            The currently installed NativeScript CLI is v${cliVersion}.You can update the NativeScript CLI by executing 'npm install -g nativescript'.`);

        return;
    }

    services.cliVersion = cliVersion;
    services.extensionVersion = packageJSON.version;

    logExtensionInfo(cliVersion, packageJSON);

    services.analyticsService.initialize();

    const showOutputChannelCommand = vscode.commands.registerCommand('nativescript.showOutputChannel', () => {
        channel.show();
    });

    const beforeBuildDisposables = new Array<vscode.Disposable>();
    const runCommand = (project: Project) => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');

            return;
        }

        // Show output channel
        const runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
        runChannel.clear();
        runChannel.show(vscode.ViewColumn.Two);

        services.analyticsService.runRunCommand(project.platformName());

        const tnsProcess = project.run();
        tnsProcess.on('error', (err) => {
            vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
        });
        tnsProcess.stderr.on('data', (data) => {
            runChannel.append(data.toString());
        });
        tnsProcess.stdout.on('data', (data) => {
            runChannel.append(data.toString());
        });
        tnsProcess.on('exit', (exitCode) => {
            tnsProcess.stdout.removeAllListeners('data');
            tnsProcess.stderr.removeAllListeners('data');
        });
        tnsProcess.on('close', (exitCode) => {
            runChannel.hide();
        });

        const disposable = {
            dispose: () => {
                services.buildService.disconnect();
                utils.killProcess(tnsProcess);
            },
        };

        context.subscriptions.push(disposable);
        beforeBuildDisposables.push(disposable);
    };

    const runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        return runCommand(new IosProject(vscode.workspace.rootPath, services.cli()));
    });

    const runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        return runCommand(new AndroidProject(vscode.workspace.rootPath, services.cli()));
    });

    context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
        if (event.event === extProtocol.BEFORE_DEBUG_START) {
            channel.show();
            beforeBuildDisposables.forEach((disposable) => disposable.dispose());
        }

        if (event.event === extProtocol.NS_DEBUG_ADAPTER_MESSAGE) {
            const request = event.body as extProtocol.IRequest;
            const service = services[request.service];
            const method = service[request.method];
            const response = typeof method === 'function' ? service[request.method].call(service, ...request.args) : method;

            if (response && response.then) {
                response.then((result) => event.session && event.session.customRequest('onExtensionResponse', { requestId: request.id, result }),
                    (err: Error) => {
                        vscode.window.showErrorMessage(err.message);
                        event.session.customRequest('onExtensionResponse', { requestId: request.id, isError: true, message: err.message });
                    });

                return;
            }

            event.session.customRequest('onExtensionResponse', { requestId: request.id, result: response });
        }
    }));

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
    context.subscriptions.push(showOutputChannelCommand);

    context.subscriptions.push(COMPLETION_PROVIDER);
    context.subscriptions.concat(SUGGESTION_PROVIDERS);
    context.subscriptions.concat(HOVER_PROVIDERS);
}

function logExtensionInfo(cliVersion: string, packageJSON: any): void {
    packageJSON.version && services.logger.log(`Version: ${packageJSON.version}`);
    packageJSON.buildVersion && services.logger.log(`Build version: ${packageJSON.buildVersion}`);
    packageJSON.commitId && services.logger.log(`Commit id: ${packageJSON.commitId}`);
    services.logger.log(`NativeScript CLI: ${cliVersion}`);
}
