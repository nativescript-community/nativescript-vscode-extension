import * as os from 'os';
import * as path from 'path';
import { chromeConnection, ChromeDebugSession } from 'vscode-chrome-debug-core';
import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';
import { NativeScriptPathTransformer } from './nativeScriptPathTransformer';
import { NativeScriptSourceMapTransformer } from './nativeScriptSourceMapTransformer';
import { NativeScriptTargetDiscovery } from './nativeScriptTargetDiscovery';
import { DebugSession, } from '@vscode/debugadapter';

class NSAndroidConnection extends chromeConnection.ChromeConnection {
    constructor() {
        super(new NativeScriptTargetDiscovery());
    }
}

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
        sourceMapTransformer: NativeScriptSourceMapTransformer,
    }));

DebugSession.run(

)