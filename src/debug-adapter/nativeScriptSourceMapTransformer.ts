import * as path from 'path';
import { BaseSourceMapTransformer, logger as vsCodeChromeDebugLogger, utils as vsCodeChromeDebugUtils } from 'vscode-chrome-debug-core';
import * as sourceMapUtils from 'vscode-chrome-debug-core/out/src/sourceMaps/sourceMapUtils'; // tslint:disable-line
import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';

export class NativeScriptSourceMapTransformer extends BaseSourceMapTransformer {
    private debugAdapter: NativeScriptDebugAdapter;
    private targetPlatform: string;

    constructor(sourceHandles: any) {
        super(sourceHandles);
        this.setupSourceMapPathOverrides();
    }

    public setTransformOptions(targetPlatform: string, debugAdapter: NativeScriptDebugAdapter) {
        this.targetPlatform = targetPlatform.toLowerCase();
        this.debugAdapter = debugAdapter;
    }

    public async scriptParsed(pathToGenerated: string, sourceMapURL: string): Promise<string[]> {
        const scriptParsedResult = await super.scriptParsed(pathToGenerated, sourceMapURL);

        if (scriptParsedResult && scriptParsedResult.length) {
            for (const script of scriptParsedResult) {
                await this.debugAdapter.setCachedBreakpointsForScript(script);
            }
        }

        return scriptParsedResult;
    }

    private setupSourceMapPathOverrides() {
        // a workaround for https://github.com/NativeScript/nativescript-vscode-extension/issues/252
        // tslint:disable
        //--- begin part copied from vscode-chrome-debug-core (https://github.com/microsoft/vscode-chrome-debug-core/blob/d1fe8ca062e277a3480879e1fb63a8ef3b48015a/src/sourceMaps/sourceMapUtils.ts#L78)
        //
        // VS Code - Debugger for Chrome
        //
        // Copyright (c) Microsoft Corporation
        //
        // All rights reserved.
        //
        // MIT License
        //
        // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the ""Software""), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
        //
        // The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

        sourceMapUtils.applySourceMapPathOverrides = (sourcePath, sourceMapPathOverrides, isVSClient = false) => {
            const forwardSlashSourcePath = sourcePath.replace(/\\/g, '/');
            // Sort the overrides by length, large to small
            const sortedOverrideKeys = Object.keys(sourceMapPathOverrides)
                .sort((a, b) => b.length - a.length);

            // Iterate the key/vals, only apply the first one that matches.
            for (const leftPattern of sortedOverrideKeys) {
                const rightPattern = sourceMapPathOverrides[leftPattern];
                const entryStr = `"${leftPattern}": "${rightPattern}"`;
                const asterisks = leftPattern.match(/\*/g) || [];

                if (asterisks.length > 1) {
                    vsCodeChromeDebugLogger.log(`Warning: only one asterisk allowed in a sourceMapPathOverrides entry - ${entryStr}`);
                    continue;
                }
                const replacePatternAsterisks = rightPattern.match(/\*/g) || [];

                if (replacePatternAsterisks.length > asterisks.length) {
                    vsCodeChromeDebugLogger.log(`Warning: the right side of a sourceMapPathOverrides entry must have 0 or 1 asterisks - ${entryStr}}`);
                    continue;
                }
                // Does it match?
                const escapedLeftPattern = vsCodeChromeDebugUtils.escapeRegexSpecialChars(leftPattern, '/*');
                const leftRegexSegment = escapedLeftPattern
                    .replace(/\*/g, '(.*)')
                    .replace(/\\\\/g, '/');
                const leftRegex = new RegExp(`^${leftRegexSegment}$`, 'i');
                const overridePatternMatches = forwardSlashSourcePath.match(leftRegex);

                if (!overridePatternMatches) {
                    continue;
                }
                // Grab the value of the wildcard from the match above, replace the wildcard in the
                // replacement pattern, and return the result.
                const wildcardValue = overridePatternMatches[1];

                // ***************** CUSTOM CODE START *****************
                // handle linked files
                let mappedPath = path.isAbsolute(wildcardValue) ? wildcardValue : rightPattern.replace(/\*/g, wildcardValue);
                // ***************** CUSTOM CODE END *****************

                mappedPath = path.join(mappedPath); // Fix any ..

                // ***************** CUSTOM CODE START *****************
                // handle platform-specific files
                const { dir, name, ext } = path.parse(mappedPath);

                const tnsFileName = `${name}.tns${ext}`;
                const tnsPath = path.join(dir, tnsFileName);

                if (vsCodeChromeDebugUtils.existsSync(tnsPath)) {
                    mappedPath = tnsPath;
                }

                const platformFileName = `${name}.${this.targetPlatform}${ext}`;
                const platformPath = path.join(dir, platformFileName);

                if (vsCodeChromeDebugUtils.existsSync(platformPath)) {
                    mappedPath = platformPath;
                }
                // ***************** CUSTOM CODE END *****************

                if (isVSClient && leftPattern === 'webpack:///./*' && !vsCodeChromeDebugUtils.existsSync(mappedPath)) {
                    // This is a workaround for a bug in ASP.NET debugging in VisualStudio because the wwwroot is not properly configured
                    const pathFixingASPNETBug = path.join(rightPattern.replace(/\*/g, path.join('../ClientApp', wildcardValue)));

                    if (vsCodeChromeDebugUtils.existsSync(pathFixingASPNETBug)) {
                        mappedPath = pathFixingASPNETBug;
                    }
                }
                vsCodeChromeDebugLogger.log(`SourceMap: mapping ${sourcePath} => ${mappedPath}, via sourceMapPathOverrides entry - ${entryStr}`);

                return mappedPath;
            }

            return sourcePath;
        };

        //--- end part copied from vscode-chrome-debug-core
        // tslint:enable
    }
}
