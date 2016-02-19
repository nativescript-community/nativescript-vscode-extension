NativeScript Extension for Visual Studio Code
========

### Introduction

The NativeScript extension for Visual Studio Code aids your [NativeScript](https://www.nativescript.org/) project development within Visual Studio Code.

### Install NativeScript

To install [NativeScript](https://www.nativescript.org/) and all its dependencies, follow the instructions in our [getting started guide](http://docs.nativescript.org/start/getting-started#getting-up-and-running).

### Setup the extension

Create NativeScript application by running `tns create MyApp` and open `MyApp` folder in Visual Studio Code. Open the Debug Panel, click the gear icon

![gear icon](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/1-gear-icon.jpg)

and choose NativeScript debug environment.

![NativeScript debug settings](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/2-nativescript-debug-settings.jpg)

### Debug your NativeScript application

To start the application with attached debugger, choose one of the launch configurations from the drop-down list and then click the start button.

![Launch settings](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/4-nativescript-launch-configurations.jpg)

Your application will be launched and the VSCode debugger will break on the first JavaScript statement. Click continue and your app will show up on the emulator/device. If you want to attach to already running NativeScript application, use one of the attach configurations. More information on what you can do with the Visual Studio Code Debugger you can find [here](https://code.visualstudio.com/docs/editor/debugging).

### NativeScript commands

Type `NativeScript` in the Command Palette and you will see all available commands. 

![NativeScript Commands](https://raw.githubusercontent.com/NativeScript/nativescript-vscode-extension/master/images/7-nativescript-commands.jpg)

There's only a couple of them but the list will grow in the future.

The `Run` command triggers `tns run` on emulator or device. You can run your app both on iOS and Android.

If your version of NativeScript is incompatible with the extension you will see a warning the first time you run a command.