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

        var childProcess = require("child_process");
        var tnsPath = "node_modules/nativescript/bin/tns";

        try {
            var fs = require("fs");
            try {
                fs.statSync(tnsPath);
            } catch(ex1) {
                console.log("no tns found at that path!");
            }

            var result = childProcess.spawnSync(tnsPath, ["create", "ALABALA"]);
            result.stdout.on("end", function() {
                vscode.window.showInformationMessage("The command ended successfully");
            });

            result.stderr.on("end", function() {
                vscode.window.showInformationMessage("The command erred");
            });
        } catch (ex) {
            vscode.window.showInformationMessage("The call was crappy");
        }
        vscode.window.showInformationMessage("AAAAA???");

    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(createProjectDisposable);
}
