import * as assert from 'assert';
import * as sinon from 'sinon';
import { NativeScriptTargetDiscovery } from '../debug-adapter/nativeScriptTargetDiscovery';

describe('NativeScriptTargetDiscovery', () => {
    let nativeScriptTargetDiscovery: NativeScriptTargetDiscovery;
    let stub;

    before(() => {
        nativeScriptTargetDiscovery = new NativeScriptTargetDiscovery();
    });

    it(`getTarget returns correct target`, async () => {
        const address = 'localhost';
        const port = 41000;

        const target = await nativeScriptTargetDiscovery.getTarget(address, port);

        assert.equal(target.webSocketDebuggerUrl, `ws://${address}:${port}`);
        assert.equal(target.devtoolsFrontendUrl, `chrome-devtools://devtools/bundled/inspector.html?experiments=true&ws=${address}:${port}`);
    });

    it(`getTargets calls getTarget`, async () => {
        const testTarget: any = {
            devtoolsFrontendUrl: 'url',
            webSocketDebuggerUrl: 'socket',
        };
        const address = 'localhost';
        const port = 41000;

        stub = sinon.stub(nativeScriptTargetDiscovery, 'getTarget').callsFake(() => Promise.resolve(testTarget));
        const targets = await nativeScriptTargetDiscovery.getAllTargets(address, port);

        sinon.assert.calledOnce(stub);
        sinon.assert.calledWith(stub, address, port);
        assert.equal(targets.length, 1);
        assert.deepEqual(targets[0], testTarget);
    });

    afterEach(() => {
        if (stub) {
            stub.restore();
        }
    });
});
