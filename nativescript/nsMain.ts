import * as vscode from 'vscode';

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
        vscode.window.showInformationMessage('NativeScript Run!');
    });

    var livesyncCommand = vscode.commands.registerCommand('nativescript.livesync', () => {
        vscode.window.showInformationMessage('NativeScript LiveSync!');
    });

    context.subscriptions.push(createCommand);
    context.subscriptions.push(buildCommand);
    context.subscriptions.push(runCommand);
    context.subscriptions.push(livesyncCommand);
}