import * as os from 'os';
import * as path from 'path';
import { chromeConnection, ChromeDebugSession } from 'vscode-chrome-debug-core';
import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';
import { NativeScriptPathTransformer } from './nativeScriptPathTransformer';
import { NativeScriptTargetDiscovery } from './nativeScriptTargetDiscovery';

class NSAndroidConnection extends chromeConnection.ChromeConnection {
    constructor() {
        super(new NativeScriptTargetDiscovery());
    }
}

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: NativeScriptDebugAdapter,
        chromeConnection: NSAndroidConnection,
        extensionName: 'nativescript-extension',
        logFilePath: path.join(os.tmpdir(), 'nativescript-extension.txt'),
        pathTransformer: NativeScriptPathTransformer,
    }));
