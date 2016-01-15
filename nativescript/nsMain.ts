import * as vscode from 'vscode';
import * as child from 'child_process';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, "NativeScript" is now active!');

    var createCommand = vscode.commands.registerCommand('nativescript.create', () => {
        var inputOptions = {
            password: false,
            prompt: "Please, specify the name of your new project",
            value: "NewNativeScriptProject"
        }

        var result = vscode.window.showInputBox(inputOptions);

        result.then((projectName: string) => {
            if (projectName === undefined) {
                console.log('Project creation canceled');
                return;
            }
            var shell = require("shelljs");

            var command = `./node_modules/nativescript/bin/tns create ${projectName}`;

            var creation = shell.exec(command, {async: true}, function(code, output) {
            if (code) {
                console.log(`Creation errored. Command output: ${output}`);
            } else {
                console.log(`Project successfully created! The output was: ${output}`);
            }
            });
            creation.stdout.on("data", function(data) {
                console.log("CREATION: " + data);
            });
            creation.stderr.on("data", function(data) {
                console.log("CREATION ERROR: " + data);
            });
            creation.stderr.on("error", function(data) {
                console.log("CREATION STDERR ERROR: " + data);
            });
            creation.stderr.on("end", function(data) {
                console.log("CREATION STDERR END: " + data);
            });
        });

    });

    var buildCommand = vscode.commands.registerCommand('nativescript.build', () => {
        vscode.window.showInformationMessage('NativeScript Build!');
    });

    var runCommand = vscode.commands.registerCommand('nativescript.run', () => {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('No workspace opened.');
            return;
        }

        vscode.window.showQuickPick(['android', 'ios'])
        .then(platform => {
            if (platform === undefined) {
                return;
            }

            let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel('NativeScript Run');
            runChannel.clear();
            runChannel.show(vscode.ViewColumn.Two);

            let tnsProcess: child.ChildProcess = child.execFile('tns', ['run', platform, '--emulator'], { cwd: vscode.workspace.rootPath });
            tnsProcess.stdout.on('data', (data) => {
                runChannel.append(data);
            });
            tnsProcess.stderr.on('data', (data) => {
                runChannel.append(data);
            });

            tnsProcess.on('exit', () => {
                tnsProcess.stdout.removeAllListeners('data');
                tnsProcess.stderr.removeAllListeners('data');
                runChannel.hide();
            });

            vscode.window.showInformationMessage('NativeScript Run')
            .then(item => {
                if (item === undefined) {
                    process.kill(tnsProcess.pid, 'SIGTERM');
                }
            });
        });
    });

    var livesyncCommand = vscode.commands.registerCommand('nativescript.livesync', () => {
        vscode.window.showInformationMessage('NativeScript LiveSync!');
    });

    context.subscriptions.push(createCommand);
    context.subscriptions.push(buildCommand);
    context.subscriptions.push(runCommand);
    context.subscriptions.push(livesyncCommand);
}