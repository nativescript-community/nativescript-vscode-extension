import * as _ from 'lodash';
import * as sinon from 'sinon';
import { ChromeDebugAdapter } from 'vscode-chrome-debug-core';
import { Event } from 'vscode-debugadapter';
import * as extProtocol from '../common/extensionProtocol';
import { NativeScriptDebugAdapter } from '../debug-adapter/nativeScriptDebugAdapter';

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
    appRoot: 'appRootMock',
    diagnosticLogging: true,
    platform: 'android',
    request: 'attach',
    stopOnEntry: true,
    tnsArgs: [ 'mockArgs'],
    watch: true,
};

const mockConstructor = (mockObject: any): any => {
    return function() {
        return mockObject;
    };
};

describe('NativeScriptDebugAdapter', () => {
    let nativeScriptDebugAdapter: any;
    let chromeSessionMock: any;
    let chromeConnectionMock: any;
    let pathTransformerMock: any;

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
            setTargetPlatform: () => ({}),
        };

        nativeScriptDebugAdapter = new NativeScriptDebugAdapter(
            { chromeConnection: mockConstructor(chromeConnectionMock), pathTransformer: mockConstructor(pathTransformerMock) },
            chromeSessionMock,
        );

        ChromeDebugAdapter.prototype.attach = () => Promise.resolve();
    });

    const platforms = [ 'android', 'ios' ];
    const launchMethods = [ 'launch', 'attach' ];

    platforms.forEach((platform) => {
        launchMethods.forEach((method) => {
            const argsMock = _.merge({}, defaultArgsMock, { platform, request: method });

            it(`${method} for ${platform} should raise debug start event`, async () => {
                const spy = sinon.spy(chromeSessionMock, 'sendEvent');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({ event: extProtocol.BEFORE_DEBUG_START }));
            });

            it(`${method} for ${platform} should call project setTargetPlatform`, async () => {
                const spy = sinon.spy(pathTransformerMock, 'setTargetPlatform');

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

            it(`${method} for ${platform} should translate args to chrome debug args`, async () => {
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    trace: true,
                    webRoot: 'appRootMock',
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
