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
    private isAndroid: boolean;
    private isIOS: boolean;

    public setTransformOptions(targetPlatform: string, appDirPath: string, webRoot: string) {
        this.targetPlatform = targetPlatform.toLowerCase();
        this.appDirPath = appDirPath;
        this.webRoot = webRoot;
        this.isAndroid = this.targetPlatform === 'android';
        this.isIOS = this.targetPlatform === 'ios';
    }

    protected async targetUrlToClientPath(scriptUrl: string): Promise<string> {
        if (!scriptUrl) {
            return;
        }

        if (_.startsWith(scriptUrl, 'mdha:')) {
            scriptUrl = _.trimStart(scriptUrl, 'mdha:');
        }

        if (path.isAbsolute(scriptUrl) && fs.existsSync(scriptUrl)) {
            return scriptUrl;
        }

        const filePattern = this.filePatterns[this.targetPlatform];

        const matches = filePattern.exec(scriptUrl);

        let relativePath = scriptUrl;

        if (matches) {
            relativePath = this.isAndroid ? matches[3] : matches[2];
        }

        return this.getFileFromAppDir(relativePath) ||
            this.getFileFromNodeModulesDir(relativePath) ||
            this.getFileFromPlatformsDir(relativePath) ||
            scriptUrl;
    }

    private getFileFromAppDir(rawDevicePath: string): string {
        if (this.appDirPath) {
            rawDevicePath = rawDevicePath.replace('app', this.appDirPath);
        }

        const absolutePath = path.resolve(path.join(this.webRoot, rawDevicePath));

        return this.getPlatformSpecificPath(absolutePath);
    }

    private getFileFromNodeModulesDir(rawDevicePath: string): string {
        const nodePath = path.join('..', 'node_modules');

        rawDevicePath = rawDevicePath.replace('tns_modules', nodePath);

        const absolutePath = path.resolve(path.join(this.webRoot, rawDevicePath));

        return this.getPlatformSpecificPath(absolutePath);
    }

    private getFileFromPlatformsDir(rawDevicePath: string): string {
        let absolutePath: string = null;

        // handle files like file://app/starter.js (produced with bundle and required when using with --debug-brk)
        if (this.isAndroid) {
            // handle files like /data/data/internal/ts_helpers.ts
            absolutePath = path.resolve(path.join(this.webRoot, 'platforms', this.targetPlatform.toLowerCase(), 'app', 'src', 'main', 'assets', rawDevicePath));
        } else if (this.isIOS) {
            absolutePath = path.resolve(path.join(this.webRoot, 'platforms', this.targetPlatform.toLowerCase(), this.getAppName(this.webRoot), rawDevicePath));
        }

        return this.getPlatformSpecificPath(absolutePath);
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

    private getAppName(projectDir: string): string {
        return _.filter(path.basename(projectDir).split(''), (c) => /[a-zA-Z0-9]/.test(c)).join('');
    }
}
