import { EventEmitter } from 'events';
import * as _ from 'lodash';
import * as sinon from 'sinon';
import { ChromeDebugAdapter } from 'vscode-chrome-debug-core';
import { Event } from 'vscode-debugadapter';
import * as extProtocol from '../common/extensionProtocol';
import { nativeScriptDebugAdapterGenerator } from '../debug-adapter/nativeScriptDebugAdapter';

const customMessagesResponses = {
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
    let projectMock: any;
    let nativeScriptCliMock: any;
    let cliCommandMock: any;
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

        cliCommandMock = {
            tnsOutputEventEmitter: {
                on: (event, callback) => {
                    callback();
                },
            },
        };

        pathTransformerMock = {
            attach: () => ({}),
            clearTargetContext: () => ({}),
            setTargetPlatform: () => ({}),
        };

        projectMock = {
            attach: () => cliCommandMock,
            debug: () => cliCommandMock,
        };

        nativeScriptCliMock = {
            executeGetVersion: () => 'cliVersionMock',
        };

        const projectClass: any =  function(appRoot, cli) {
            return _.merge({
                appRoot,
                cli,
            }, projectMock);
        };

        const nativeScriptDebugAdapterClass = nativeScriptDebugAdapterGenerator(projectClass, projectClass, mockConstructor(nativeScriptCliMock));

        nativeScriptDebugAdapter = new nativeScriptDebugAdapterClass(
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

            it(`${method} for ${platform} should call analyticsService`, async () => {
                const spy = sinon.spy(chromeSessionMock, 'sendEvent');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    body: {
                        args: [method, platform],
                        method: 'launchDebugger',
                        service: 'analyticsService',
                    },
                    event: extProtocol.NS_DEBUG_ADAPTER_MESSAGE,
                }));
            });

            it(`${method} for ${platform} should call project setTargetPlatform`, async () => {
                const spy = sinon.spy(pathTransformerMock, 'setTargetPlatform');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, argsMock.platform);
            });

            it(`${method} for ${platform} should set debug port`, async () => {
                const port = 1234;

                sinon.stub(cliCommandMock.tnsOutputEventEmitter, 'on').callsFake((event, callback) => callback(port));
                const spy = sinon.spy(ChromeDebugAdapter.prototype, 'attach');

                await nativeScriptDebugAdapter[method](argsMock);

                sinon.assert.calledWith(spy, sinon.match({
                    port,
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
                const fakeEmitter = {
                    on: () => ({}),
                };

                cliCommandMock.tnsProcess = new EventEmitter();
                cliCommandMock.tnsProcess.stderr = fakeEmitter;
                cliCommandMock.tnsProcess.stdout = fakeEmitter;

                await nativeScriptDebugAdapter.attach(argsMock);
                cliCommandMock.tnsProcess.emit('close', -1);

                sinon.assert.calledWith(spy, sinon.match({
                    event: 'terminated',
                }));
            });
        });
    });

    it('attach should call project attach method with correct args', async () => {
        const attachSpy = sinon.spy(projectMock, 'attach');
        const debugSpy = sinon.spy(projectMock, 'debug');

        const argsMock = _.merge({}, defaultArgsMock, { request: 'attach' });

        await nativeScriptDebugAdapter.attach(argsMock);

        sinon.assert.calledOnce(attachSpy);
        sinon.assert.calledWith(attachSpy, argsMock.tnsArgs);
        sinon.assert.notCalled(debugSpy);
    });

    it('launch should call project debug method with correct args', async () => {
        const attachSpy = sinon.spy(projectMock, 'attach');
        const debugSpy = sinon.spy(projectMock, 'debug');

        const argsMock = _.merge({}, defaultArgsMock, { request: 'launch' });

        await nativeScriptDebugAdapter.launch(argsMock);

        sinon.assert.calledOnce(debugSpy);
        sinon.assert.calledWith(debugSpy, { stopOnEntry: argsMock.stopOnEntry, watch: argsMock.watch }, argsMock.tnsArgs);
        sinon.assert.notCalled(attachSpy);
    });
});
