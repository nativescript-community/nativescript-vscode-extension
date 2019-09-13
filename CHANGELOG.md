0.10.2
====
## Bug Fixes
 - [Unable to debug applications when output.library in webpack.config.js is set](https://github.com/NativeScript/nativescript-vscode-extension/issues/263)


0.10.1
====
## Bug Fixes
 - [Could not load source 'undefined' when debugging unit tests](https://github.com/NativeScript/nativescript-vscode-extension/issues/237)
 - [[Debugging] Break points in platform specific files and/or symlink files in `node_modules` are not hit with "@next" version](https://github.com/NativeScript/nativescript-vscode-extension/issues/252)
 - [Cannot debug unit tests with HMR](https://github.com/NativeScript/nativescript-vscode-extension/issues/251)

0.10.0
====
## What's new
 - [Add support for debug with hot module replacement](https://github.com/NativeScript/nativescript-vscode-extension/issues/221)

0.9.0
====
## What's new
 - [Add configurations for unit testing](https://github.com/NativeScript/nativescript-vscode-extension/issues/144)

## Bug Fixes
 - [Cannot attach to `tns test android --debug-brk`](https://github.com/NativeScript/nativescript-vscode-extension/issues/234)

0.8.4
=====
## Bug Fixes
 - [Set correct source map path for webpack](https://github.com/NativeScript/nativescript-vscode-extension/issues/222)
 - [Wait for '# NativeScript Debugger started #' only on `debug-brk` as now we don't restart the app in the other cases](https://github.com/NativeScript/nativescript-vscode-extension/pull/223)
 - [Make the android debugging backwards compatible](https://github.com/NativeScript/nativescript-vscode-extension/pull/226)

0.8.3
=====
## Bug Fixes
 - [Debugger hangs if build of app fails](https://github.com/NativeScript/nativescript-vscode-extension/issues/206)
 - [Unable to debug with webpack enabled.](https://github.com/NativeScript/nativescript-vscode-extension/issues/213)
 - ["Launch on iOS" on Windows hangs VS Code](https://github.com/NativeScript/nativescript-vscode-extension/issues/217)

0.8.2
=====
## Bug Fixes
 - [Unable to debug when project's app directory is renamed](https://github.com/NativeScript/nativescript-vscode-extension/issues/205)

0.8.1
=====
## Bug Fixes
 - [When file watch is active saving shutdowns emulator](https://github.com/NativeScript/nativescript-vscode-extension/issues/195)
    - The LiveSync process will no longer stop the emulator and you will be able to continue the debugging session after the changes are synced. **Note that emulators launched through VS Code will be stopped when the currently active debugging session is terminated. To avoid this behavior, you need to launch the emulators manually and not through VS Code.**

- The Debug Console panel now shows only device related logs. All other NativeScript related logs are printed in the Output panel.

0.8.0
=====
## What's new
- [The debugger now uses *vscode-chrome-debug-core*](https://github.com/NativeScript/nativescript-vscode-extension/pull/181)
- [Removed IPC, now using the debug adapter events for communication with the extension host process](https://github.com/NativeScript/nativescript-vscode-extension/pull/182)
- [Added tests/travis](https://github.com/NativeScript/nativescript-vscode-extension/pull/190)
- [Added tslint](https://github.com/NativeScript/nativescript-vscode-extension/pull/185)
- [Added source map paths config for debugging with webpack](https://github.com/NativeScript/nativescript-vscode-extension/pull/192)
- [The NS Extension log is not shown on startup](https://github.com/NativeScript/nativescript-vscode-extension/pull/177)

0.7.4
=====

## What's new
 - [GDPR Compliance](https://github.com/NativeScript/nativescript-vscode-extension/issues/173)

## Bug Fixes
 - [Debugger stops after Typescript compile error](https://github.com/NativeScript/nativescript-vscode-extension/issues/157)
 - The breakpoints in TypeScript files are not resolved on Windows

0.7.3
=====

## What's new
 - [Debug via extension broken with VSCode 1.20](https://github.com/NativeScript/nativescript-vscode-extension/issues/158)
 - [Add option to save teamId once it is selected](https://github.com/NativeScript/nativescript-vscode-extension/issues/138)
 - TypeScript compiler updated to 2.4.0
 - Upgrade to ES6

0.7.2
=====

## Bug Fixes
- [Debug with "Launch on iOS" with 0.7.0 and no provisioning profiles not working](https://github.com/NativeScript/nativescript-vscode-extension/issues/133)

0.7.1
=======

## Bug Fixes
- [Debug with "Launch on iOS" with 0.7.0 and no provisioning profiles not working](https://github.com/NativeScript/nativescript-vscode-extension/issues/133)

0.7.0
=====

## What's New
- [UI for selecting teamId for iOS device debugging](https://github.com/NativeScript/nativescript-vscode-extension/issues/93)

## Bug Fixes
- [Variables are no longer displayed when debugging in VS Code 1.9.0 and {N} plugin 0.6.x](https://github.com/NativeScript/nativescript-vscode-extension/issues/112)
- [Set using cmd when executing node child processes on Windows](https://github.com/NativeScript/nativescript-vscode-extension/issues/121)


0.6.1
=====

## What's New
- [Hint VS Code for the languages supported by the debugger](https://github.com/NativeScript/nativescript-vscode-extension/issues/111)
- [Display changelog on extension update](https://github.com/NativeScript/nativescript-vscode-extension/issues/91)

0.6.0
=====

## What's New
- [Replace the v8 remtoe debugging protocol with Chrome Debugging Protocol](https://github.com/NativeScript/nativescript-vscode-extension/pull/107)

0.5.1
=====

## What's New
- [Bug fix: VSCode Extension v0.5.0 Crashes On Linux](https://github.com/NativeScript/nativescript-vscode-extension/issues/100)

0.5.0
=====

## What's New
- [Enable loading more than 20 call frames](https://github.com/NativeScript/nativescript-vscode-extension/pull/98)
- [[iOS] Support for breakpoints with ignoreCount in iOS only](https://github.com/NativeScript/nativescript-vscode-extension/pull/97)
- [Enable debugging with livesync](https://github.com/NativeScript/nativescript-vscode-extension/pull/96)
- [Introduce tnsPath workspace setting](https://github.com/NativeScript/nativescript-vscode-extension/commit/1c327fff71b3e3551da308aad3d596ebc06bc4d5)

0.4.0
=====

## What's New
- [Bug fix: Android API level 24](https://github.com/NativeScript/nativescript-vscode-extension/pull/79)
- [Bug fix: Sync on Android configuration](https://github.com/NativeScript/nativescript-vscode-extension/pull/89)
- [Bug fix: Support for iOS Runtime v2.4](https://github.com/NativeScript/nativescript-vscode-extension/commit/506766e4347a91e8c651e2da644ed14285e2a3f4)

0.3.1
=====

## What's New
- [Added 'Sync' configuration](https://github.com/NativeScript/nativescript-vscode-extension/pull/65)
This PR adds `Sync on iOS`/ `Sync on Android` debug configuration. The `sync` operation is the same as `launch` with the only difference that it livesyncs your app instead of fully build it. This makes the deployment much faster and the experience - much better.


0.3.0
=====

## What's New
- [Google Analytics and Telerik Analytics monitoring of the extension](https://github.com/NativeScript/nativescript-vscode-extension/pull/54)

## Bug Fixes
 - [Launch on Android Emulator doesn't work if emulator is not started on beforehand](https://github.com/NativeScript/nativescript-vscode-extension/issues/44)
 - [Handle Console.messageRepeatCountUpdated event](https://github.com/NativeScript/nativescript-vscode-extension/issues/36)

0.2.1
=====

## What's New
- [Support preliminary breakpoints](https://github.com/NativeScript/nativescript-vscode-extension/pull/30)

0.2.0
=====

## What's New
- [Change shortcuts for run commands](https://github.com/NativeScript/nativescript-vscode-extension/issues/18)
- [Add support for conditional breakpoints](https://github.com/NativeScript/nativescript-vscode-extension/issues/22)
- [Auto-check for new versions of the extension in the marketplace](https://github.com/NativeScript/nativescript-vscode-extension/issues/32)

## Bug Fixes
- [(VS Code 0.10.10) Already not depending on args.cwd to be passed to the debug adapter by VS Code](https://github.com/NativeScript/nativescript-vscode-extension/commit/1ec44c35a51e67669263bf6033f48c271052e4ea)
- [(VS Code 0.10.10) "Path must be a string" error message](https://github.com/NativeScript/nativescript-vscode-extension/issues/27)
- [(VS Code 0.10.10) "Unexpected end of input" error message](https://github.com/NativeScript/nativescript-vscode-extension/issues/28)
