import * as uuid from 'uuid';
import { chromeConnection, chromeTargetDiscoveryStrategy, logger, telemetry } from 'vscode-chrome-debug-core';

export class NativeScriptTargetDiscovery extends chromeTargetDiscoveryStrategy.ChromeTargetDiscovery {
    constructor() {
        super(logger, new telemetry.TelemetryReporter());
    }

    public getTarget(address: string, port: number, targetFilter?: any, targetUrl?: string): Promise<chromeConnection.ITarget> {
        return Promise.resolve({
            description: 'NS Debug Target',
            devtoolsFrontendUrl: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&ws=${address}:${port}`,
            id: uuid.v4(),
            title: 'NS Debug Target',
            type: 'node',
            version: null,
            webSocketDebuggerUrl: `ws://${address}:${port}`,
        });
    }

    public async getAllTargets(address: string,
                               port: number, targetFilter?: chromeConnection.ITargetFilter,
                               targetUrl?: string): Promise<chromeConnection.ITarget[]> {
        const target = await this.getTarget(address, port);

        return Promise.resolve([ target ]);
    }
}
