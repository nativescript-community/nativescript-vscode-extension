import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, "NativeScript" is now active!');

    var createCommand = vscode.commands.registerCommand('nativescript.create', () => {
        vscode.window.showInformationMessage('NativeScript Create!');
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