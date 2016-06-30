import {Version} from '../common/Version';
import * as https from 'https';

export class ExtensionVersionInfo {
    private static extensionVersion: number[] = null;
    private static minNativescriptCliVersion: number[] = null;
    private static extensionId: string = '8d837914-d8fa-45b5-965d-f76ebd6dbf5c';
    private static marketplaceQueryResult: Promise<any> = null;

    private latestVersionMeta: any;
    private timestamp: number;

    private static initVersionsFromPackageJson() {
        let packageJson = require('../../package.json');
        this.extensionVersion = Version.parse(packageJson.version);
        this.minNativescriptCliVersion = Version.parse(packageJson.minNativescriptCliVersion);
    }

    public static getExtensionVersion(): number[] {
        if (this.extensionVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.extensionVersion;
    }

    public static getMinSupportedNativeScriptVersion(): number[] {
        if (this.minNativescriptCliVersion === null) {
            this.initVersionsFromPackageJson();
        }
        return this.minNativescriptCliVersion;
    }

    public static getMarketplaceExtensionData(): Promise<any> {
        if (this.marketplaceQueryResult == null) {
            this.marketplaceQueryResult = new Promise<any>((resolve, reject) => {
                let postData: string = `{ filters: [{ criteria: [{ filterType: 4, value: "${ExtensionVersionInfo.extensionId}" }] }], flags: 262 }`;

                let request = https.request({
                    hostname: 'marketplace.visualstudio.com',
                    path: '/_apis/public/gallery/extensionquery',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json;api-version=2.2-preview.1',
                        'Content-Type': 'application/json',
                        'Transfer-Encoding': 'chunked',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, response => {
                    if (response.statusCode != 200) {
                        reject(`Unable to download data from Visual Studio Marketplace. Status code: ${response.statusCode}`);
                        return;
                    }
                    let body = '';
                    response.on('data', chunk => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        resolve(JSON.parse(body));
                    });
                });

                request.on('error', (e) => {
                    reject(e);
                });

                request.end(postData);
            });
        }
        return this.marketplaceQueryResult;
    }

    public static createFromMarketplace(): Promise<ExtensionVersionInfo> {
        return this.getMarketplaceExtensionData()
        .then(marketplaceData => {
            let latestVersion = null;
            try {
                if (marketplaceData.results[0].extensions[0].extensionId == ExtensionVersionInfo.extensionId) {
                    latestVersion = marketplaceData.results[0].extensions[0].versions[0];
                }
            } catch (e) { }
            return new ExtensionVersionInfo(latestVersion);
        });
    }

    constructor(latestVersionMeta: any, timestamp?: number) {
        this.latestVersionMeta = latestVersionMeta;
        this.timestamp = timestamp || Date.now();
    }

    public getLatestVersionMeta(): any {
        return this.latestVersionMeta;
    }

    public isLatest(): boolean {
        if (!this.getLatestVersionMeta()) {
            return true;
        }
        return Version.compareBySubminor(ExtensionVersionInfo.getExtensionVersion(), Version.parse(this.getLatestVersionMeta().version)) >= 0;
    }

    public getTimestamp(): number {
        return this.timestamp;
    }
}