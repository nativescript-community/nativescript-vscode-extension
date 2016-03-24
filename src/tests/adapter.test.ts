import * as path from 'path';
import * as assert from 'assert';
import {DebugProtocol} from 'vscode-debugprotocol';
import {NsDebugClient} from './nsDebugClient';
import {Scenario} from './scenario';
import {TestsConfig, TestsContext} from './testsContext';

describe('The adapter', () => {

    let dc: NsDebugClient;
    let context: TestsContext = new TestsContext();
    let config: TestsConfig = context.getTestsConfig();

    console.log(`Tests Configuration: ${JSON.stringify(config)}`);
    
    function waitFor(miliseconds) {
        return new Promise(r => setTimeout(r, miliseconds));
    }
    
    function iosOrAndroid(platform, iosValue, androidValue) {
        return platform == 'ios' ? iosValue : androidValue;
    }

    before(function() {
        if (!config.skipSuitePrepare) {
            context.prepare();
        }

        dc = new NsDebugClient('node', context.getDebugAdapterMainPath(), 'nativescript');
        // dc.setTimeout(0); // No timeout. Useful when debugging the debug adapter.
    });

    beforeEach(function(done) {
        dc.start(config.port || undefined).then(_ => done(), done);
    });

    afterEach(function(done) {
        dc.removeAllListeners('stopped');
        dc.removeAllListeners('initialized');
        dc.stop().then(_ => waitFor(10000)).then(_ => done(), done); // Stop the DebugClient
    });

    it('should produce error on unknown request', done => {
        dc.send('illegal_request').then(() => {
            done(new Error('doesn\'t produce error error on unknown request'));
        }, err => { done() });
    });

    it('should return supported features', () => {
        return dc.initializeRequest().then(response => {
            assert.equal(response.body.supportsFunctionBreakpoints, false);
            assert.equal(response.body.supportsConfigurationDoneRequest, true);
        });
    });

    it.skip('should produce error for invalid \'pathFormat\'', done => {
        dc.initializeRequest({
            adapterID: 'mock',
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: 'url'
        }).then(response => {
            done(new Error('does not report error on invalid \'pathFormat\' attribute'));
        }).catch(err => {
            done(); // error expected
        });
    });

    // Test cases are generated for all active platforms
    config.platforms.forEach(platform => {
        let meta = `on ${platform} ${config.emulator ? 'emulator' : 'device'}`;
        let initialStopReason = iosOrAndroid(platform, 'pause', 'step');
        let breakpointStopReason = iosOrAndroid(platform, 'breakpoint', 'step');
        let exceptionStopReason = iosOrAndroid(platform, 'exception', 'step');

        it(`${meta} should stop on the first line after launch`, () => {
            let appRoot = context.getAppPath('JsApp');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.start();
            return scenario.client.assertStoppedLocation(initialStopReason, { line: 1 });
        });

        it(`${meta} should disconnect`, () => {
            let appRoot = context.getAppPath('JsApp');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            return scenario.start().then(() => {
                return scenario.client.disconnectRequest();
            });
		});

        it(`${meta} should stop on debugger statement`, () => {
            let appRoot = context.getAppPath('DebuggerStatement');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            // continue after first stop
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, 'step', { line: 4 });
		});

        it(`${meta} should stop on breakpoint`, () => {
            let appRoot = context.getAppPath('JsApp');
            let bpPath = path.join(appRoot, 'app', 'main-page.js');
            let bpLine = 5;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(bpPath, [{ line: bpLine }]);
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: bpPath, line: bpLine, column: 4 });
		});

        it.skip(`${meta} should stop on breakpoint in file with spaces in its name`, () => {
            let appRoot = context.getAppPath('TestApp1');
            let bpPath = path.join(appRoot, 'app', 'file with space in name.js');
            let bpLine = 5;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(bpPath, [{ line: bpLine }]);
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: bpPath, line: bpLine, column: 0 });
		});

        it(`${meta} should stop on conditional breakpoint when the condition is true`, () => {
            let appRoot = context.getAppPath('TestApp1');
            let bpPath = path.join(appRoot, 'app', 'conditionalBreakpoint.js');
            let bpLine = 2;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(bpPath, [{ line: bpLine, condition: 'a === 3' }]);
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: bpPath, line: bpLine, column: 0 })
            .then(response => {
                const frame = response.body.stackFrames[0];
                return scenario.client.evaluateRequest({ context: 'watch', frameId: frame.id, expression: 'a' }).then(response => {
                    assert.equal(response.body.result, 3, 'a !== 3');
                    return response;
                });
            });
		});

        it(`${meta} should stop on typescript breakpoint`, () => {
            let appRoot = context.getAppPath('TsApp');
            let bpPath = path.join(appRoot, 'app', 'main-page.ts');
            let bpLine = 9;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(bpPath, [{ line: bpLine }]);
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: bpPath, line: bpLine, column: 4 });
		});

        it(`${meta} should stop on typescript even if breakpoint was set in JavaScript`, () => {
            let appRoot = context.getAppPath('TsApp');
            let jsPath = path.join(appRoot, 'app', 'main-page.js');
            let jsLine = 7;
            let tsPath = path.join(appRoot, 'app', 'main-page.ts');
            let tsLine = 9;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(jsPath, [{ line: jsLine }]);
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: tsPath, line: tsLine, column: 4 });
		});

        it(`${meta} should stop on caught error`, () => {
            let appRoot = context.getAppPath('TestApp2');
            let breakpointColumn = iosOrAndroid(platform, 35, 4);

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.setExceptionBreakpointsRequest({ filters: ['all'] });
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, exceptionStopReason, { path: path.join(appRoot, 'app', 'app.js'), line: 3, column: breakpointColumn });
		});

        it.skip(`${meta} should stop on uncaught error`, () => {
            let appRoot = context.getAppPath('TestApp2');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.setExceptionBreakpointsRequest({ filters: ['uncaught'] });
            });

            scenario.start();
            return scenario.client.assertNthStoppedLocation(2, exceptionStopReason, { path: path.join(appRoot, 'app', 'app.js'), line: 9, column: 24 });
		});

        it(`${meta} should receive output event when console.log is called`, () => {
            let appRoot = context.getAppPath('TestApp1');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.afterLaunchRequest = scenario.afterLaunchRequest.then(() => {
                return scenario.client.onNextTime('output').then(e => {
                    let event = e as DebugProtocol.OutputEvent;
                    assert.equal(event.body.category, 'stdout', 'message category mismatch');
                    assert.equal(event.body.output.startsWith('console.log called'), true, 'message mismatch');
                });
            });
            scenario.start();
            return scenario.afterLaunchRequest;
		});

        it(`${meta} should receive 2 output events when console.log is called twice with the same message`, () => {
            let appRoot = context.getAppPath('TestApp1');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.afterLaunchRequest = scenario.afterLaunchRequest.then(() => {
                let assertOutputEvent = e => {
                    let event = e as DebugProtocol.OutputEvent;
                    assert.equal(event.body.category, 'stdout', 'message category mismatch');
                    assert.equal(event.body.output.startsWith('console.log called'), true, 'message mismatch');
                };

                return Promise.all([
                    scenario.client.onNthTime(1, 'output').then(assertOutputEvent),
                    scenario.client.onNthTime(2, 'output').then(assertOutputEvent)]);
            });

            scenario.start();
            return scenario.afterLaunchRequest;
		});

        it(`${meta} should step over`, () => {
            let appRoot = context.getAppPath('JsApp');
            let filePath = path.join(appRoot, 'app', 'main-view-model.js');
            let bpLine = 12;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(filePath, [{ line: bpLine }]);
            });

            scenario.start();

            return Promise.all([
                scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: filePath, line: bpLine, column: 4 }).then(() => {
                    return scenario.client.nextRequest({ threadId: 1 });
                }),
                scenario.client.assertNthStoppedLocation(3, 'step', { path: filePath, line: bpLine + 1, column: 4 }).then(() => {
                    return scenario.client.nextRequest({ threadId: 1 });
                }),
                scenario.client.assertNthStoppedLocation(4, 'step', { path: filePath, line: bpLine + 2, column: 4 })
            ]);
		});

        it(`${meta} should step in`, () => {
            let appRoot = context.getAppPath('JsApp');
            let filePath = path.join(appRoot, 'app', 'main-view-model.js');
            let bpLine = 14;
            
            let firstStepExpected = iosOrAndroid(platform, { path: filePath, line: 3, column: 19 }, { path: filePath, line: 4, column: 4 });
            let secondStepExpected = iosOrAndroid(platform, { path: filePath, line: 4, column: 4 }, { path: filePath, line: 7, column: 8 });

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(filePath, [{ line: bpLine }]);
            });

            scenario.start();

            return Promise.all([
                scenario.client.assertNthStoppedLocation(2, breakpointStopReason, { path: filePath, line: bpLine, column: 4 }).then(() => {
                    return scenario.client.stepInRequest({ threadId: 1 });
                }),
                scenario.client.assertNthStoppedLocation(3, 'step', firstStepExpected).then(() => {
                    return scenario.client.stepInRequest({ threadId: 1 });
                }),
                scenario.client.assertNthStoppedLocation(4, 'step', secondStepExpected)
            ]);
		});

        it(`${meta} should pause`, () => {
            let appRoot = context.getAppPath('JsApp');
            let filePath = path.join(appRoot, 'app', 'main-view-model.js');
            let bpLine = 14;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));

            return scenario.start().then(() => {
                return scenario.client.pauseRequest({ threadId: 1 });
            });
		});

        it(`${meta} should evaluate expression when stopped on breakpoint`, () => {
            let appRoot = context.getAppPath('JsApp');
            let filePath = path.join(appRoot, 'app', 'main-view-model.js');
            let bpLine = 12;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(filePath, [{ line: bpLine }]);
            });

            scenario.start();

            return scenario.client.onNthTime(2, 'stopped').then(() => {
                return scenario.client.stackTraceRequest({ threadId: 1, levels: 20 }).then((response) => {
                    return scenario.client.evaluateRequest({
                        expression: 'getMessage(-5)',
                        context: 'watch',
                        frameId: response.body.stackFrames[0].id
                    })
                    .then((response) => {
                        assert.equal(response.body.result, '"Hoorraaay! You unlocked the NativeScript clicker achievement!"', 'result mismatch');
                    });
                });
            });
		});

        it(`${meta} should return all threads`, () => {
            let appRoot = context.getAppPath('JsApp');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));

            return scenario.start().then(() => {
                scenario.client.threadsRequest().then(response => {
                    assert.deepEqual(response.body.threads, [{ id: 1, name: 'Thread 1' }]);
                });
            });
		});

        it(`${meta} should return stack trace`, () => {
            let appRoot = context.getAppPath('JsApp');
            let filePath = path.join(appRoot, 'app', 'main-view-model.js');
            let bpLine = 13;

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));
            scenario.beforeConfigurationDoneRequest = scenario.beforeConfigurationDoneRequest.then(() => {
                return scenario.client.assertSetBreakpoints(filePath, [{ line: bpLine }]);
            });

            scenario.start();

            return scenario.client.onNthTime(2, 'stopped').then(e => {
                return scenario.client.stackTraceRequest({ threadId: e.body.threadId }).then(response => {
                    let stackFrames = response.body.stackFrames;
                    let firstFrame = stackFrames[0];
                    let lastFrame = stackFrames[stackFrames.length - 1];
                    let expectedStackFramesCount = iosOrAndroid(platform, 22, 10);
                    assert.equal(stackFrames.length, expectedStackFramesCount, 'wrong stack frames count');
                    assert.equal(firstFrame.name, 'createViewModel', 'wrong top frame name');
                    assert.equal(firstFrame.source.path, filePath, 'wrong top frame path');
                    assert.equal(lastFrame.name, 'promiseReactionJob', 'wrong last frame name');
                });
            });
		});

        it.only(`${meta} should attach`, () => {
            let appRoot = context.getAppPath('JsApp');

            let scenario = new Scenario(dc);
            scenario.launchRequestArgs = Scenario.getDefaultLaunchArgs(platform, appRoot, config.emulator);
            scenario.client.onNextTime('stopped').then(e => scenario.client.continueRequest({ threadId: 1 }));

            return scenario.start().then(() => {
                return scenario.client.disconnectRequest().then(() => {
                    return scenario.client.attachRequest(Scenario.getDefaultAttachArgs(platform, appRoot, config.emulator));
                });
            });
		});
    });
});