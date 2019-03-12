import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { NativeScriptPathTransformer } from '../debug-adapter/nativeScriptPathTransformer';
import * as tests from './pathTransformData';

describe('NativeScriptPathTransformer', () => {
    let nativeScriptPathTransformer: any;
    let existsSyncStub;

    before(() => {
        nativeScriptPathTransformer = new NativeScriptPathTransformer();
    });

    describe('targetUrlToClientPath() method', () => {
        const webRoot = 'C:\\projectpath';

        for (const test of tests as any) {
            const nsConfigPartInTestName = test.nsconfig ? " when there's nsconfig" : '';

            it(`should transform [${test.platform}] device path ${test.scriptUrl} -> ${test.expectedResult}${nsConfigPartInTestName}`, async () => {
                (path as any).join = path.win32.join;
                (path as any).resolve = path.win32.resolve;
                nativeScriptPathTransformer.setTransformOptions(test.platform, test.nsconfig ? test.nsconfig.appPath : null, webRoot);

                existsSyncStub = sinon
                    .stub(fs, 'existsSync')
                    .callsFake((arg: string) => arg === test.existingPath);
                const result = await nativeScriptPathTransformer.targetUrlToClientPath(test.scriptUrl);

                assert.equal(result, test.expectedResult);
            });
        }

        afterEach(() => {
            existsSyncStub.restore();
        });
    });

});
