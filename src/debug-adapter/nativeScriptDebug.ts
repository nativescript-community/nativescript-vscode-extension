import { chromeConnection, chromeTargetDiscoveryStrategy, telemetry, logger, ChromeDebugSession, UrlPathTransformer } from 'vscode-chrome-debug-core';
import * as path from 'path';
import * as os from 'os';
// import { PathTransformerNew } from './adapter/PathTransformerNew';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as Path from 'path';


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

export class FallbackToClientPathTransformer extends UrlPathTransformer {
    private static FILE_PATH = new RegExp("^(file:)?/*data/(data|user/\\d+)/.*?/files/(.*)$", "i");

    protected async targetUrlToClientPath(webRoot: string, scriptUrl: string): Promise<string> {
        var pathSeparator = "\\";
        var altSeparator = "/";

        if (!scriptUrl)
        {
            return;
        }

        if (_.startsWith(scriptUrl, "mdha:"))
        {
            scriptUrl = _.trimStart(scriptUrl, "mdha:");
        }

        if (path.isAbsolute(scriptUrl) && fs.existsSync(scriptUrl))
        {
            return Promise.resolve(scriptUrl);
        }

        var altScriptUrl = scriptUrl.replace(pathSeparator, altSeparator);
        const matches = FallbackToClientPathTransformer.FILE_PATH.exec(altScriptUrl);
        let relativePath = matches ? matches[3] : scriptUrl;

        relativePath = relativePath.replace(altSeparator, pathSeparator);
        relativePath = relativePath.replace("tns_modules", "..\\node_modules");

        // var fileExtension = Path.extname(relativePath);

        // if (fileExtension)
        // {
        //     return Promise.resolve(scriptUrl);
        // }

        var absolutePath = Path.resolve(Path.join(webRoot, relativePath));
        // var platformSpecificAbsolutePath = absolutePath.replace(fileExtension, $".{targetPlatform.ToLower()}{fileExtension}");

        if (fs.existsSync(absolutePath))
        {
            return Promise.resolve(absolutePath);
        }

        return Promise.resolve(scriptUrl);
        // else if (this.fileSystemHelper.Exists(platformSpecificAbsolutePath))
        // {
        //     scriptPath = platformSpecificAbsolutePath;
        // }

        // return scriptPath != null;
    }
}

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        logFilePath: path.join(os.tmpdir(), 'nativescript-extension.txt'),
        adapter: NativeScriptDebugAdapter,
        extensionName: 'nativescript-extension',
        chromeConnection: NSAndroidConnection,
        pathTransformer: FallbackToClientPathTransformer
    }));
