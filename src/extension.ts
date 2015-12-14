// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'; 

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "nativescript-vscode-extension" is now active!'); 

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello from NativeScript!');
    });

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var createProjectDisposable = vscode.commands.registerCommand('extension.createProject', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('A project must get created here and VSCode relaunched!');

        var shell = require("shelljs");

        var projectName = "ALABALA";
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

    context.subscriptions.push(disposable);
    context.subscriptions.push(createProjectDisposable);
}
