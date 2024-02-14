import * as semver from 'semver';
import * as vscode from 'vscode';
import * as extProtocol from './common/extensionProtocol';
import * as utils from './common/utilities';
import { AndroidProject } from './project/androidProject';
import { IosProject } from './project/iosProject';
import { Project } from './project/project';
import { ChannelLogger } from './services/channelLogger';
import { services } from './services/extensionHostServices';
import { COMPLETION_PROVIDER } from './services/language-services/autocomplete';
import { HOVER_PROVIDERS } from './services/language-services/hover/hover';
import { SUGGESTION_PROVIDERS } from './services/language-services/suggestions';
import { Connection, Server, WebSocketTransport } from "vscode-cdp-proxy";
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceConfigService } from './common/workspaceConfigService';
import { NativeScriptSessionManager } from "./nativeScriptSessionManager"
import { DebugSession } from '@vscode/debugadapter';
// this method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {

    services.globalState = context.globalState;
    services.cliPath = 'tns';

    const channel = vscode.window.createOutputChannel('NativeScript Extension');

    services.logger = new ChannelLogger(channel);
    const nativescriptSessionManager = new NativeScriptSessionManager(services.logger);

    const packageJSON = vscode.extensions.getExtension('nativescript.nativescript').packageJSON;
    const cliVersion = services.cli().executeGetVersion();

    if (!cliVersion) {
        // tslint:disable-next-line:max-line-length
        vscode.window.showErrorMessage("NativeScript CLI not found. Use 'nativescript.tnsPath' workspace setting to explicitly set the absolute path to the NativeScript CLI.");

        return;
    }

    if (!semver.gte(cliVersion, packageJSON.minNativescriptCliVersion)) {
        // tslint:disable-next-line:max-line-length
        vscode.window.showErrorMessage(`The existing NativeScript extension is compatible with NativeScript CLI v${packageJSON.minNativescriptCliVersion} or greater.
            The currently installed NativeScript CLI is v${cliVersion}.You can update the NativeScript CLI by executing 'npm install -g nativescript'.`);

        return;
    }

    services.cliVersion = cliVersion;
    services.extensionVersion = packageJSON.version;

    logExtensionInfo(cliVersion, packageJSON);

    services.analyticsService.initialize();

    const showOutputChannelCommand = vscode.commands.registerCommand('nativescript.showOutputChannel', () => {
        channel.show();
    });
    let entry = false;
    const beforeBuildDisposables = new Array<vscode.Disposable>();
    const runCommand = (session: any) => {
        console.log("RUN COMMAND");

        async function connect() {
            if (!entry) {
                entry = true;
                try {
                    console.log(uuidv4());

                    const server = await Server.create({ port: 8999 });
                    server.onConnection(async ([toDebugger, req]) => {

                        services.logger.log('Got connection from debugger')
                        console.log('Got connection from debugger');
                        toDebugger.pause(); // don't listen for events until the target is ready

                        toDebugger.onError(err => console.error('Error on debugger transport', err));

                        const url = new URL('http://localhost' + req.url);
                        const browserInspectUri = url.searchParams.get('browser');
                        console.log('connecting');
                        services.logger.log('connecting')
                        let toTarget: Connection = null!
                        try {

                            //   toTarget = new Connection(await WebSocketTransport.create("ws://localhost:41000"));

                            // toTarget = new Connection();
                            toTarget = new Connection(await WebSocketTransport.create("ws://127.0.0.1:40000"));
                            console.log('Connected to target');
                            services.logger.log('Connected to target')
                        } catch (error) {
                            console.log("ERRORRRR");
                            console.log(error);
                            return;
                        }
                        const id = uuidv4()
                        function sendCommand() {
                            toTarget.send({ method: "Runtime.enable", params: {} })

                        }
                        // sendCommand();

                        toTarget.onError(err => console.error('Error on target transport', err));

                        // Copy commands (requests) from one pipe to the other.
                        toTarget.onCommand(evt => {
                            console.log(`onCommand target -> debugger`, evt);
                            toDebugger.send({ ...{ id: i++ }, ...evt });
                        });
                        toDebugger.onCommand((evt: any) => {
                            console.log(`onCommand debugger -> target`, evt);
                            if (evt.method == "Debugger.paused") {
                                //    evt.params.hitBreakpoints[0] = '1:215:12:file:\\/\\/\\/Users\\/vallemar\\/workspaces\\/test\\/debug-vue-3\\/platforms\\/android\\/app\\/src\\/main\\/assets\\/app\\/bundle\\.js($|\\?)|\\/Users\\/vallemar\\/workspaces\\/test\\/debug-vue-3\\/platforms\\/android\\/app\\/src\\/main\\/assets\\/app\\/bundle\\.js($|\\?)'

                            }
                            toTarget.send(evt);
                        });


                        // Copy replies (responses) the same way
                        const convertToDebug = (evt: any) => {
                            if (evt?.result?.breakpointId && evt?.result?.breakpointId.includes("org.nativescript.debugvue3")) {
                                //evt.result.breakpointId = "1:215:12:file:///debug-vue-3/src/components/Home.vue"
                                const split = evt.result.breakpointId.split("file")
                                //  evt.result.breakpointId = split[0] + "file:///data/data/org.nativescript.debugvue3/files/app/bundle.js"
                                //  evt.result.locations = [{ scriptId: scriptIdMap.get(), lineNumber: split[1], columnNumber: split[2] }]
                                //  evt.result.locations = [{ scriptId: "8", lineNumber: 215, columnNumber: 12 }]
                            }
                            return evt;
                        }
                        const scriptIdMap = new Map()
                        const saveScript = (evt) => {
                            if (evt.method === "Debugger.scriptParsed") {
                                scriptIdMap.set(evt.params.url.split("/")[evt.params.url.split("/").length - 1], evt.params)
                            }
                        }
                        toTarget.onReply(evt => {
                            console.log(`onReply target -> debugger`, convertToDebug(evt));
                            saveScript(evt)
                            toDebugger.send(convertToDebug(evt));

                        });
                        const convertToTarget = (evt: any) => {
                            if (evt.method === "Debugger.setBreakpointByUrl" && evt.params?.urlRegex?.includes("android")) {
                                //   console.log(evt.params.urlRegex);

                                //  evt.params.url = "file:///data/data/org.nativescript.debugvue3/files/app/bundle.js"
                                //  delete evt.params.urlRegex;
                            }
                            return evt;
                        }
                        toDebugger.onReply((evt: any) => {
                            console.log(`onReply debugger -> target`, convertToTarget(evt));
                            toTarget.send(convertToTarget(evt));
                        });
                        const mensagges = [
                            //   { method: 'Attach', params: {} },
                            //  { method: 'Attach.ConfigureDebuggingSession.Internal', params: {} },
                            //{ method: 'Attach.ConfigureDebuggingSession.Target', params: {} },
                            //{ method: "Attach.ConfigureDebuggingSession.End", params: {} },
                            // { method: "Attach.RequestDebuggerTargetsInformation", params: {} },
                            //{ method: 'Attach.AttachToTargetDebuggerWebsocket', params: {} },
                            { method: 'Network.enable', params: { "maxPostDataSize": 65536 } },
                            { method: "Runtime.enable", params: {} },
                            { method: "DOM.enable", params: {} },
                            { method: "CSS.enable", params: {} },
                            {
                                method: "Debugger.setPauseOnExceptions", params: {
                                    "state": "none"
                                }
                            },
                            {
                                method: "Debugger.setAsyncCallStackDepth", params: {
                                    "maxDepth": 32
                                }
                            },
                            { method: "Profiler.enable", params: {} },
                            {
                                method: "Debugger.setBlackboxPatterns", params: {
                                    "patterns": [
                                        "/node_modules/|/bower_components/"
                                    ]
                                }
                            },
                            { method: "Runtime.runIfWaitingForDebugger", params: {} },


                        ]

                        let i = 5;
                        setTimeout(() => {
                            toDebugger.unpause();

                            /*  setTimeout(() => {
                                 mensagges.forEach(x => {
                                     // toTarget.call(x.method.trim(), x.params);
                                     toTarget.send({ id: i++, method: x.method.trim(), params: x.params });
                                 })
                             }, 500);
  */

                        }, 1000);                        //    toDebugger.api.Network.enable({ "maxPostDataSize": 65536 })

                        console.log(toDebugger.getId());

                    });
                    console.log("vscode.debug.activeDebugSession");
                    console.log(vscode.debug.activeDebugSession);
                    console.log(nativescriptSessionManager.session);
                    const bb = vscode.debug.breakpoints;
                    setTimeout(() => {
                        vscode.debug.addBreakpoints(bb)
                    }, 1500);

                    vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0]/* {
                        uri: vscode.Uri.file("/Users/vallemar/workspaces/test/debug-vue-3"),
                        name: "debug-vue-3",
                        index: 1,
                    } */, {
                            "type": "node",
                            "request": "attach",
                            "name": "attach chrome",
                            "port": 8999,
                            "stopOnEntry": false,
                            "appRoot": "/Users/vallemar/workspaces/test/debug-vue-3",
                            "webRoot": "/Users/vallemar/workspaces/test/debug-vue-3",
                            "url": "localhost",
                            "watch": false,
                            "sourceMaps": true,
                            "trace": true,
                            "_resolveSourceMapLocations_": [
                                "/Users/vallemar/workspaces/test/debug-vue-3/platforms/ios/debugvue3/app/**",
                                "/Users/vallemar/workspaces/test/debug-vue-3/platforms/android/app/src/main/assets/app/**",
                                "!**/node_modules/**"
                            ],
                            "_sourceMapPathOverrides_": {
                                "webpack:///./*": "/Users/vallemar/workspaces/test/debug-vue-3/*",
                                "webpack:///src/*": "/Users/vallemar/workspaces/test/debug-vue-3/*",
                                "webpack:///./~/*": "/Users/vallemar/workspaces/test/debug-vue-3/node_modules/*",
                                "webpack:///*": "/Users/vallemar/workspaces/test/debug-vue-3/app/*",
                                "webpack://debug-vue-3/*.js": "/Users/vallemar/workspaces/test/debug-vue-3/*.js",
                                "webpack://debug-vue-3/*.ts": "/Users/vallemar/workspaces/test/debug-vue-3/*.ts",
                                "webpack://debug-vue-3/*.vue": "/Users/vallemar/workspaces/test/debug-vue-3/*.vue",
                                "webpack://debug-vue-3/*.svelte": "/Users/vallemar/workspaces/test/debug-vue-3/*.svelte",
                                "webpack://debug-vue-3/src/components/Home.vue": "/Users/vallemar/workspaces/test/debug-vue-3/src/components/Home.vue",
                                "webpack://debug-vue-3/*.jsx": "/Users/vallemar/workspaces/test/debug-vue-3/*.jsx",
                                "webpack://debug-vue-3/*.tsx": "/Users/vallemar/workspaces/test/debug-vue-3/*.tsx",
                                "webpack:/*": "/Users/vallemar/workspaces/test/debug-vue-3/*",
                                "/./*": "/Users/vallemar/workspaces/test/debug-vue-3/*",
                                "/src/*": "/Users/vallemar/workspaces/test/debug-vue-3/*",
                                "/*": "*",
                                "/./~/*": "/Users/vallemar/workspaces/test/debug-vue-3/node_modules/*",
                                "webpack:///./src/*": "/Users/vallemar/workspaces/test/debug-vue-3/src/*"
                            }
                        },
                        {
                            parentSession: session,
                            consoleMode: vscode.DebugConsoleMode.MergeWithParent,
                        })




                } catch (error) {
                    console.log(error);

                }
            }

        }
        connect()
        /*  if (vscode.workspace.rootPath === undefined) {
             vscode.window.showErrorMessage('No workspace opened.');

             return;
         }

         // Show output channel
         const runChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Run on ${project.platformName()}`);
         runChannel.clear();
         runChannel.show(vscode.ViewColumn.Two);

         services.analyticsService.runRunCommand(project.platformName());

         const tnsProcess = project.run();
         tnsProcess.on('error', (err) => {
             vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
         });
         tnsProcess.stderr.on('data', (data) => {
             runChannel.append(data.toString());
         });
         tnsProcess.stdout.on('data', (data) => {
             runChannel.append(data.toString());
         });
         tnsProcess.on('exit', (exitCode) => {
             tnsProcess.stdout.removeAllListeners('data');
             tnsProcess.stderr.removeAllListeners('data');
         });
         tnsProcess.on('close', (exitCode) => {
             runChannel.hide();
         });

         const disposable = {
             dispose: () => {
                 services.buildService.disconnect();
                 utils.killProcess(tnsProcess);
             },
         };

         context.subscriptions.push(disposable);
         beforeBuildDisposables.push(disposable); */
    };

    const runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        console.log("RUN COMMAND runIos");

        //   return runCommand();
    });

    const runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        console.log("RUN COMMAND runAndroid");
        services.logger.log('RUN COMMAND runAndroid')

        //  return runCommand();
    });

    context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
        console.log("onDidReceiveDebugSessionCustomEvent");

        runCommand(event.session);
    }));


    context.subscriptions.push(vscode.debug.onDidStartDebugSession(() => {
        console.log('startDebugging')

    }));

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
    context.subscriptions.push(showOutputChannelCommand);

    context.subscriptions.push(COMPLETION_PROVIDER);
    context.subscriptions.concat(SUGGESTION_PROVIDERS);
    context.subscriptions.concat(HOVER_PROVIDERS);
}

function logExtensionInfo(cliVersion: string, packageJSON: any): void {
    packageJSON.version && services.logger.log(`Version: ${packageJSON.version}`);
    packageJSON.buildVersion && services.logger.log(`Build version: ${packageJSON.buildVersion}`);
    packageJSON.commitId && services.logger.log(`Commit id: ${packageJSON.commitId}`);
    services.logger.log(`NativeScript CLI: ${cliVersion}`);
}
