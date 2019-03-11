import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import { UrlPathTransformer } from 'vscode-chrome-debug-core';

export class NativeScriptPathTransformer extends UrlPathTransformer {
    private filePatterns = {
        android: new RegExp('^(file:)?/*data/(data|user/\\d+)/.*?/files/(.*)$', 'i'),
        ios: new RegExp('^(file:)?/*(.*)$', 'i'),
    };

    private targetPlatform: string;
    private appDirPath: string;
    private webRoot: string;

    public setTransformOptions(targetPlatform: string, appDirPath: string, webRoot: string) {
        this.targetPlatform = targetPlatform.toLowerCase();
        this.appDirPath = appDirPath;
        this.webRoot = webRoot;
    }

    protected async targetUrlToClientPath(scriptUrl: string): Promise<string> {
        if (!scriptUrl) {
            return;
        }

        const isAndroid = this.targetPlatform === 'android';

        if (_.startsWith(scriptUrl, 'mdha:')) {
            scriptUrl = _.trimStart(scriptUrl, 'mdha:');
        }

        if (path.isAbsolute(scriptUrl) && fs.existsSync(scriptUrl)) {
            return Promise.resolve(scriptUrl);
        }

        const filePattern = this.filePatterns[this.targetPlatform];

        const matches = filePattern.exec(scriptUrl);

        let relativePath = scriptUrl;

        if (matches) {
            relativePath = isAndroid ? matches[3] : matches[2];
        }

        const nodePath = path.join('..', 'node_modules');

        relativePath = relativePath.replace('tns_modules', nodePath);

        if (this.appDirPath) {
            relativePath = relativePath.replace('app', this.appDirPath);
        }

        let absolutePath = path.resolve(path.join(this.webRoot, relativePath));
        let platformSpecificPath = this.getPlatformSpecificPath(absolutePath);

        if (platformSpecificPath) {
            return Promise.resolve(platformSpecificPath);
        }

        if (isAndroid) {
            // handle files like /data/data/internal/ts_helpers.ts
            absolutePath = path.resolve(path.join(this.webRoot, 'platforms', this.targetPlatform.toLowerCase(), 'app', 'src', 'main', 'assets', relativePath));
            platformSpecificPath = this.getPlatformSpecificPath(absolutePath);

            if (platformSpecificPath) {
                return Promise.resolve(platformSpecificPath);
            }
        }

        return Promise.resolve(scriptUrl);
    }

    private getPlatformSpecificPath(rawPath: string): string {
        if (fs.existsSync(rawPath)) {
            return rawPath;
        }

        const fileExtension = path.extname(rawPath);

        if (fileExtension) {
            const platformSpecificPath = rawPath.replace(fileExtension, `.${this.targetPlatform}${fileExtension}`);

            if (fs.existsSync(platformSpecificPath)) {
                return platformSpecificPath;
            }
        }

        return null;
    }
}
