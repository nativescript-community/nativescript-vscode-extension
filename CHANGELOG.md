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
