import * as fs from 'fs';
import * as _ from 'lodash';
import { join } from 'path';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { ChromeDebugAdapter } from 'vscode-chrome-debug-core';
import { Event } from '@vscode/debugadapter';
import * as extProtocol from '../common/extensionProtocol';
const appRoot = 'appRootMock';
const webpackConfigFunctionStub = sinon.stub();

proxyquire.noCallThru();
const nativeScriptDebugAdapterLib = proxyquire('../debug-adapter/nativeScriptDebugAdapter', {
    [join(appRoot, 'webpack.config.js')]: webpackConfigFunctionStub,
});

const examplePort = 456;

const customMessagesResponses = {
    buildService: {
        processRequest: examplePort,
    },
    workspaceConfigService: {
        tnsPath: 'tnsPathMock',
    },
};

const defaultArgsMock: any = {
    appRoot,
    diagnosticLogging: true,
    platform: 'android',
    request: 'attach',
    stopOnEntry: true,
    tnsArgs: ['mockArgs'],
    watch: true,
};

const mockConstructor = (mockObject: any): any => {
    return function () {
        return mockObject;
    };
};

describe('NativeScriptDebugAdapter', () => {
    let nativeScriptDebugAdapter: any;
    let chromeSessionMock: any;
    let chromeConnectionMock: any;
    let pathTransformerMock: any;
    let sourceMapTransformer: any;

    beforeEach(() => {
        chromeSessionMock = {
            sendEvent: (e: Event) => {
                const request = (e as any).body as extProtocol.IRequest;

                if (e.event === extProtocol.NS_DEBUG_ADAPTER_MESSAGE) {
                    const result = customMessagesResponses[request.service] && customMessagesResponses[request.service][request.method];

                    (nativeScriptDebugAdapter as any).onExtensionResponse({ requestId: request.id, result });
                }
            },
        };

        chromeConnectionMock = {
            attach: () => Promise.resolve({}),
        };

        pathTransformerMock = {
            attach: () => ({}),
            clearTargetContext: () => ({}),
            setTransformOptions: () => ({}),
        };

        sourceMapTransformer = {
            clearTargetContext: () => undefined,
            setTransformOptions: () => undefined,
        };

        nativeScriptDebugAdapter = new nativeScriptDebugAdapterLib.NativeScriptDebugAdapter({
            chromeConnection: mockConstructor(chromeConnectionMock),
            pathTransformer: mockConstructor(pathTransformerMock),
            sourceMapTransformer: mockConstructor(sourceMapTransformer),
        },
            chromeSessionMock,
        );

        ChromeDebugAdapter.prototype.attach = () => Promise.resolve();
    });

    const platforms = ['android', 'ios'];
    const launchMethods = ['launch', 'attach'];

    platforms.forEach((platform) => {
        launchMethods.forEach((method) => {
            let argsMock: any;

            beforeEach(() => {
                argsMock = _.merge({}, defaultArgsMock, { platform, request: method });
            });

            it(`${method} for ${platform} should raise debug start event`, async () => {
                const spy = sinon.spy(chromeSessionMock, 'sendEvent');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({ event: extProtocol.BEFORE_DEBUG_START }));
            });

            it(`${method} for ${platform} should call project setTransformOptions`, async () => {
                const spy = sinon.spy(pathTransformerMock, 'setTransformOptions');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, argsMock.platform);
            });

            it(`${method} for ${platform} should set debug port`, async () => {
                const debugPort = 1234;
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');

                customMessagesResponses.buildService.processRequest = debugPort;

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    port: debugPort,
                }));
            });

            it(`${method} for ${platform} should set debug address`, async () => {
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    address: platform === "ios" ? "localhost" : undefined,
                }));
            });

            it(`${method} for ${platform} should translate args to chrome debug args`, async () => {
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    trace: true,
                    webRoot: appRoot,
                }));
            });

            it(`${method} for ${platform} should add sourceMapPathOverrides data`, async () => {
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');
                const existsSyncStub = sinon.stub(fs, 'existsSync');
                // Need to also stub isAngularProject to return false or it will always return true bc it utilizes
                // `fs.existsSync` which is also stubbed and made to return true in this test.
                const isAngularProjectStub = sinon.stub(nativeScriptDebugAdapter, 'isAngularProject');

                existsSyncStub.returns(true);
                isAngularProjectStub.returns(false);
                webpackConfigFunctionStub
                    .withArgs({ [platform]: platform })
                    .returns({ output: { library: 'myLib' } });

                await nativeScriptDebugAdapter[method](argsMock);

                existsSyncStub.restore();
                sinon.assert.calledWith(spy, sinon.match({
                    sourceMapPathOverrides: {
                        'webpack:///*': `${join(appRoot, 'app')}/*`,
                        'webpack://myLib/*': `${join(appRoot, 'app')}/*`,
                    },
                    trace: true,
                    webRoot: appRoot,
                }));

            });

            it(`${method} for ${platform} should not fail when unable to require webpack.config.js`, async () => {
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');
                const existsSyncStub = sinon.stub(fs, 'existsSync');
                // Need to also stub isAngularProject to return false or it will always return true bc it utilizes
                // `fs.existsSync` which is also stubbed and made to return true in this test.
                const isAngularProjectStub = sinon.stub(nativeScriptDebugAdapter, 'isAngularProject');

                existsSyncStub.returns(true);
                isAngularProjectStub.returns(false);
                webpackConfigFunctionStub
                    .withArgs({ [platform]: platform })
                    .throws(new Error('test'));

                await nativeScriptDebugAdapter[method](argsMock);

                existsSyncStub.restore();
                sinon.assert.calledWith(spy, sinon.match({
                    sourceMapPathOverrides: {
                        'webpack:///*': `${join(appRoot, 'app')}/*`,
                    },
                    trace: true,
                    webRoot: appRoot,
                }));
            });

            it(`${method} for ${platform} - after process exit should send Terminate event`, async () => {
                const spy = sinon.spy(chromeSessionMock, 'sendEvent');

                customMessagesResponses.buildService.processRequest = undefined;

                await nativeScriptDebugAdapter.attach(argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    event: 'terminated',
                }));
            });
        });
    });
});
