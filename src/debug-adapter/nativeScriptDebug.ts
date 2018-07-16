import * as os from 'os';
import * as path from 'path';
import { chromeConnection, ChromeDebugSession } from 'vscode-chrome-debug-core';
import { AndroidProject } from '../project/androidProject';
import { IosProject } from '../project/iosProject';
import { NativeScriptCli } from '../project/nativeScriptCli';
import { nativeScriptDebugAdapterGenerator } from './nativeScriptDebugAdapter';
import { NativeScriptPathTransformer } from './nativeScriptPathTransformer';
import { NativeScriptTargetDiscovery } from './nativeScriptTargetDiscovery';

class NSAndroidConnection extends chromeConnection.ChromeConnection {
    constructor() {
        super(new NativeScriptTargetDiscovery());
    }
}

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: nativeScriptDebugAdapterGenerator(IosProject, AndroidProject, NativeScriptCli),
        chromeConnection: NSAndroidConnection,
        extensionName: 'nativescript-extension',
        logFilePath: path.join(os.tmpdir(), 'nativescript-extension.txt'),
        pathTransformer: NativeScriptPathTransformer,
    }));
