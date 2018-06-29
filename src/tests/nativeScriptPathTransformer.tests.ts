import * as assert from 'assert';
import * as fs from 'fs';
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
            it(`should transform [${test.platform}] device path ${test.scriptUrl} -> ${test.expectedResult}`, async () => {
                nativeScriptPathTransformer.setTargetPlatform(test.platform);
                existsSyncStub = sinon.stub(fs, 'existsSync').callsFake((arg: string) => arg === test.existingPath);

                const result = await nativeScriptPathTransformer.targetUrlToClientPath(webRoot, test.scriptUrl);

                assert.equal(result, test.expectedResult);
            });
        }

        afterEach(() => {
            existsSyncStub.restore();
        });
    });

});
