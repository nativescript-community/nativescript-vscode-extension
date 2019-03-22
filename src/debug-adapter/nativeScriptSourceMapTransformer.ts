import { BaseSourceMapTransformer } from 'vscode-chrome-debug-core';
import { NativeScriptDebugAdapter } from './nativeScriptDebugAdapter';

export class NativeScriptSourceMapTransformer extends BaseSourceMapTransformer {
    private debugAdapter: NativeScriptDebugAdapter;

    constructor(sourceHandles: any) {
        super(sourceHandles);
    }

    public setDebugAdapter(debugAdapter: NativeScriptDebugAdapter): void {
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
}
