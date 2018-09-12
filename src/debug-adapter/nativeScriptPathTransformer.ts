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

    public setTargetPlatform(targetPlatform: string) {
        this.targetPlatform = targetPlatform.toLowerCase();
    }

    protected async targetUrlToClientPath(webRoot: string, scriptUrl: string): Promise<string> {
        if (!scriptUrl) {
            return;
        }

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
            relativePath = this.targetPlatform === 'android' ? matches[3] : matches[2];
        }

        const nodePath = path.join('..', 'node_modules');

        relativePath = relativePath.replace('tns_modules', nodePath);

        const pathToNsconfig = path.join(webRoot, 'nsconfig.json');

        if (fs.existsSync(pathToNsconfig)) {
            try {
                const content = fs.readFileSync(pathToNsconfig).toString();
                const jsonContent = JSON.parse(content);

                if (jsonContent.appPath) {
                    relativePath = relativePath.replace('app', jsonContent.appPath);
                }
            } catch (err) {
                // Ignore the error for the moment
            }
        }

        const absolutePath = path.resolve(path.join(webRoot, relativePath));

        if (fs.existsSync(absolutePath)) {
            return Promise.resolve(absolutePath);
        }

        const fileExtension = path.extname(absolutePath);

        if (fileExtension) {
            const platformSpecificPath = absolutePath.replace(fileExtension, `.${this.targetPlatform}${fileExtension}`);

            if (fs.existsSync(platformSpecificPath)) {
                return Promise.resolve(platformSpecificPath);
            }
        }

        return Promise.resolve(scriptUrl);
    }
}
