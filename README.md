NativeScript extension for Visual Studio Code
========

### Introduction
The NativeScript extension for Visual Studio Code aids your NativeScript
project development within Visual Studio Code.

### Installation
1. Load Visual Studio Code
2. Press `F1`
3. Type `Install Extension`
4. Type `NativeScript`
5. Hit ENTER

### Build

#### Prerequisites
1. [Set up Visual Studio Code](https://code.visualstudio.com/docs/editor/setup)
2. [Install nodejs](https://nodejs.org/en/download/)
3. Install [gulp](http://gulpjs.com/) globally (`npm install gulp -g`)
4. Install [tsd](http://definitelytyped.org/tsd/) globally (`npm install tsd -g`)
5. Install [vsce](https://code.visualstudio.com/docs/tools/vscecli) globally (`npm install -g vsce`)
7. run `npm install` from `/nativescript-cli` folder to install nativescript CLI. If the required version of the CLI is not published, yet, paste the build artefacts of [NativeScript CLI](https://github.com/NativeScript/nativescript-cli) under the `/nativescript-cli/node_modules/nativescript` folder
8. run `npm install` from the project folder to have the dependent node.js modules installed
9. run `tsd install` from the project folder to have the TypeScript declarations installed

#### Build and Install
1. run `gulp` from the project folder to build the extension. An `out` folder should be created containing the build artifacts
2. run `vsce package` from the project folder. `nativescript-x.x.x.vsix` file should be created in your project folder.
3. [Install the extension](https://code.visualstudio.com/docs/extensions/install-extension) by running `code nativescript-x.x.x.vsix` from the project folder.

> Visit [the official visual studio code site]
(https://code.visualstudio.com/docs/extensions/example-hello-world) for more information on running Visual Studio Code plugins.
