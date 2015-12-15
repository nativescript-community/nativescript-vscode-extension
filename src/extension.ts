import * as vscode from 'vscode'; 

export function activate(context: vscode.ExtensionContext) {
    var createProjectResult = vscode.commands.registerCommand('extension.createProject', () => {
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

    context.subscriptions.push(createProjectResult);
}
