import * as https from 'https';
import * as vscode from 'vscode';
import {Version} from './version';
import * as utils from './utilities';

export type LatestPublishedVersionCheckResult = {latestPublishedVersion: string, timestamp: number};

export class ExtensionVersionService {
    private static _extensionId: string = '8d837914-d8fa-45b5-965d-f76ebd6dbf5c';
    private static _getLatestPublishedVersionPromise: Promise<LatestPublishedVersionCheckResult> = null;
    private _memento: vscode.Memento;

    private static getExtensionMetadataFromVSCodeMarketplace(): Promise<LatestPublishedVersionCheckResult> {
        return new Promise<LatestPublishedVersionCheckResult>((resolve, reject) =>{
            let postData: string = `{ filters: [{ criteria: [{ filterType: 4, value: "${ExtensionVersionService._extensionId}" }] }], flags: 262 }`;

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
                    let bodyObj = JSON.parse(body);
                    if (bodyObj.results[0].extensions[0].extensionId == ExtensionVersionService._extensionId) {
                        let latestPublishedVersion = bodyObj.results[0].extensions[0].versions[0].version;
                        resolve({ latestPublishedVersion: latestPublishedVersion, timestamp: Date.now() });
                    }
                });
            });

            request.on('error', (e) => {
                reject(e);
            });

            request.end(postData);
        });
    }

    constructor(context: vscode.Memento) {
        this._memento = context;
    }

    public get latestPublishedVersion(): Promise<Version> {
        if (ExtensionVersionService._getLatestPublishedVersionPromise) {
            return ExtensionVersionService._getLatestPublishedVersionPromise.then(result =>  Version.parse(result.latestPublishedVersion) );
        }

        // Check the cache for extension version information
        let cachedResult: LatestPublishedVersionCheckResult = this._memento.get<LatestPublishedVersionCheckResult>('LatestPublishedExtensionVersion');
        if (cachedResult && cachedResult.timestamp > Date.now() - 24 * 60 * 60 * 1000) { // Version is cached for a day
            ExtensionVersionService._getLatestPublishedVersionPromise = Promise.resolve(cachedResult);
        }
        else {
            ExtensionVersionService._getLatestPublishedVersionPromise = ExtensionVersionService.getExtensionMetadataFromVSCodeMarketplace().then((result: LatestPublishedVersionCheckResult) => {
                this._memento.update('LatestPublishedExtensionVersion', result); // save in cache
                return result;
            });
        }
        return ExtensionVersionService._getLatestPublishedVersionPromise.then(result => Version.parse(result.latestPublishedVersion));
    }

    public get isLatestInstalled(): Promise<{ result: boolean, error: string }> {
        return this.latestPublishedVersion.then(latestVersion => {
            let extensionVersion = utils.getInstalledExtensionVersion();
            let isLatest: boolean = extensionVersion.compareBySubminorTo(latestVersion) >= 0;
            let error = isLatest ? null : `A new version of the NativeScript extension is available. Open "Extensions" panel to update to v${latestVersion}.`;
            return {result: isLatest, error: error};
        });
    }
}