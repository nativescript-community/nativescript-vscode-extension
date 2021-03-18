NativeScript Extension for Visual Studio Code
========

### Introduction

The NativeScript extension for Visual Studio Code aids your [NativeScript](https://www.nativescript.org/) project development within Visual Studio Code.

### Install NativeScript

To install [NativeScript](https://www.nativescript.org/) and all its dependencies, follow the instructions in our [getting started guide](http://docs.nativescript.org/start/getting-started#getting-up-and-running).

> Note: The VS Code extension requires [nativescript node module](https://www.npmjs.com/package/nativescript) to be globally installed. If you are using [nvm](https://github.com/creationix/nvm) to manage your node versions, make sure that `nativescript` is installed in your default nodeJS version. To check which is your default node version execute 'nvm ls' on the command prompt and you should see something like 'default -> 5.5.0 (-> v5.5.0)' in the output.

### Setup the extension

Create NativeScript application by running `tns create MyApp` and open `MyApp` folder in Visual Studio Code. Open the Debug Panel, click the gear icon

![gear icon](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/screenshots/nativescript-gear-icon.jpg)

and choose NativeScript debug environment.

![NativeScript debug settings](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/screenshots/nativescript-debug-settings.png)

### Debug your NativeScript application

To start the application with attached debugger, choose one of the launch configurations from the drop-down list and then click the start button.

![Launch settings](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/screenshots/nativescript-launch-configurations.png)

Your application will be launched and the VSCode debugger will attach. If you want to attach to already running NativeScript application, use one of the attach configurations. More information on what you can do with the Visual Studio Code Debugger you can find [here](https://code.visualstudio.com/docs/editor/debugging).

### NativeScript commands

Type `NativeScript` in the Command Palette and you will see all available commands.

![NativeScript Commands](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/screenshots/nativescript-commands.png)

There's only a couple of them but the list will grow in the future.

The `Run` command triggers `tns run` on emulator or device. You can run your app both on iOS and Android.

If your version of NativeScript is incompatible with the extension you will see a warning the first time you run a command.

### Get the latest bits

1. Clone the [extension repository](https://github.com/NativeScript/nativescript-vscode-extension): `git clone git@github.com:NativeScript/nativescript-vscode-extension.git`
2. To build the extension run the following commands in the root repository folder:

    ```
    npm install
    npm run build # compiles TypeScript source files to JavaScript
    npm run package # produces nativescript-*.*.*.vsix in the root folder
    ```

3. To test the extension run the following commands in the root repository folder:

    ```
    npm install
    npm run build # compiles TypeScript source files to JavaScript
    npm run launch-as-server # launches the debug adapter in server mode
    # execute this in a separate terminal
    npm run test-mac # run tests on ios device
    ```

4. To install the extension drag and drop the `nativescript-*.*.*.vsix` package in the VS Code.

### How to disable the analytics
The anonymous usage data collected by us from the NativeScript extension for Visual Studio Code is used strictly to improve the product and its services, and enhance the overall user experience.

If you have previously enabled the analytics option, you can disable it by following the steps outlined below:

1. Open the Visual Studio Code Settings
    - on Windows, select **File > Preferences > Settings**
    - on macOS, select **Code > Preferences > Settings**
2. Add the following option (or update the existing one) to disable the analytics:
```
"nativescript.analytics.enabled": false
```

> Note: This option will disable only the analytics for the Visual Studio Code extension. To disable the analytics for the NativeScript CLI, open a command prompt or terminal and run the following commands:

```
tns usage-reporting disable
tns error-reporting disable
```