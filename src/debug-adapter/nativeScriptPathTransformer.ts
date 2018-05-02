import * as path from 'path';
import * as fs from 'fs';
import { UrlPathTransformer } from 'vscode-chrome-debug-core';
import * as _ from 'lodash';

export class NativeScriptPathTransformer extends UrlPathTransformer {
    private filePatterns = {
        android: new RegExp("^(file:)?/*data/(data|user/\\d+)/.*?/files/(.*)$", "i")
    };

    private targetPlatform: string;

    public setTargetPlatform(targetPlatform: string) {
        this.targetPlatform = targetPlatform.toLowerCase();
    }

    protected async targetUrlToClientPath(webRoot: string, scriptUrl: string): Promise<string> {
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

        const filePattern = this.filePatterns[this.targetPlatform];
        const pathSeparator = "\\";
        const altSeparator = "/";
        const altScriptUrl = scriptUrl.replace(pathSeparator, altSeparator);
        const matches = filePattern.exec(altScriptUrl);
        let relativePath = matches ? matches[3] : scriptUrl;

        relativePath = relativePath.replace(altSeparator, pathSeparator);
        relativePath = relativePath.replace("tns_modules", "..\\node_modules");

        const absolutePath = path.resolve(path.join(webRoot, relativePath));

        if (fs.existsSync(absolutePath))
        {
            return Promise.resolve(absolutePath);
        }

        const fileExtension = path.extname(absolutePath);

        if (fileExtension)
        {
            const platformSpecificAbsolutePath = absolutePath.replace(fileExtension, `.${this.targetPlatform}${fileExtension}`);
            if (fs.existsSync(platformSpecificAbsolutePath))
            {
                return Promise.resolve(platformSpecificAbsolutePath);
            }
        }

        return Promise.resolve(scriptUrl);
    }
}