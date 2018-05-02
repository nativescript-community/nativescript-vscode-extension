import { chromeConnection, chromeTargetDiscoveryStrategy, ChromeDebugAdapter, telemetry, logger, ChromeDebugSession, UrlPathTransformer } from 'vscode-chrome-debug-core';
import * as path from 'path';
import * as os from 'os';
import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';
import { NativeScriptPathTransformer } from './nativeScriptPathTransformer';
import * as uuid from "uuid";

class Discovery extends chromeTargetDiscoveryStrategy.ChromeTargetDiscovery {
    constructor() {
        super(logger, new telemetry.TelemetryReporter())
    }

    public getTarget(address: string, port: number, targetFilter?: any, targetUrl?: string): Promise<chromeConnection.ITarget> {
        return Promise.resolve({
            webSocketDebuggerUrl: `ws://${address}:${port}`,
            description: "NS Debug Target",
            id: uuid.v4(),
            title: "NS Debug Target",
            type: "node",
            devtoolsFrontendUrl: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&ws=${address}:${port}`
        });
    }

    async getAllTargets(address: string, port: number, targetFilter?: chromeConnection.ITargetFilter, targetUrl?: string): Promise<chromeConnection.ITarget[]> {
        const target = await this.getTarget(address, port);
        return Promise.resolve([ target ]);
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
        pathTransformer: NativeScriptPathTransformer
    }));
