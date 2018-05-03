import { chromeConnection, chromeTargetDiscoveryStrategy, telemetry, logger, ChromeDebugSession } from 'vscode-chrome-debug-core';
import * as path from 'path';
import * as os from 'os';
// import { PathTransformerNew } from './adapter/PathTransformerNew';

import * as test from 'vscode-chrome-debug-core';

import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';

class Discovery extends chromeTargetDiscoveryStrategy.ChromeTargetDiscovery {
    constructor() {
        super(logger, new telemetry.TelemetryReporter())
    }

    public getTarget(address: string, port: number, targetFilter?: any, targetUrl?: string): Promise<chromeConnection.ITarget> {
        return Promise.resolve({
            webSocketDebuggerUrl: `ws://${address}:${port}`,
            description: "",
            id: "1",
            title: "gg",
            type: "GG",
            devtoolsFrontendUrl: "ggg"
        });
    }

    getAllTargets(address: string, port: number, targetFilter?: chromeConnection.ITargetFilter, targetUrl?: string): Promise<chromeConnection.ITarget[]> {
        return Promise.resolve([{
            webSocketDebuggerUrl: `ws://${address}:${port}`,
            description: "",
            id: "1",
            title: "gg",
            type: "GG",
            devtoolsFrontendUrl: "ggg"
        }]);
    }
}

class NSAndroidConnection extends chromeConnection.ChromeConnection {
    constructor() {
        super(new Discovery());
    }
}

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        logFilePath: path.join(os.tmpdir(), 'nativescript-extension.txt'),
        adapter: NativeScriptDebugAdapter,
        extensionName: 'nativescript-extension',
        chromeConnection: NSAndroidConnection,
        // pathTransformer: PathTransformerNew
    }));
