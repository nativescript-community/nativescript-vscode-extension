
import {DebugProtocol} from 'vscode-debugprotocol';
import {NsDebugClient} from './nsDebugClient';

export class Scenario {
    private resolveStarted: () => any;

    private resolveBeforeLaunch: () => any;
    private resolveBeforeAttach: () => any;
    private resolveBeforeConfigurationDone: () => any;

    private resolveAfterLaunch: () => any;
    private resolveAfterAttach: () => any;
    private resolveAfterConfigurationDone: () => any;

    public client: NsDebugClient;

    public started: Promise<void> = new Promise<void>(r => this.resolveStarted = r);
    public initializeRequest: Promise<DebugProtocol.InitializeResponse>;
    public launchRequest: Promise<DebugProtocol.LaunchResponse>;
    public attachRequest: Promise<DebugProtocol.AttachResponse>;
    public configurationDoneRequest: Promise<DebugProtocol.ConfigurationDoneRequest>;

    // The corresponding command will not start before these promises are resolved
    public beforeLaunchRequest: Promise<any> = new Promise<any>(r => this.resolveBeforeLaunch = r);
    public beforeAttachRequest: Promise<any> = new Promise<any>(r => this.resolveBeforeAttach = r);
    public beforeConfigurationDoneRequest: Promise<any> = new Promise<any>(r => this.resolveBeforeConfigurationDone = r);

    // The corresponding command promise will not be resolved/rejected before these promises are resolved
    public afterLaunchRequest: Promise<any> = new Promise<any>(r => this.resolveAfterLaunch = r);
    public afterAttachRequest: Promise<any> = new Promise<any>(r => this.resolveAfterAttach = r);
    public afterConfigurationDoneRequest: Promise<any> = new Promise<any>(r => this.resolveAfterConfigurationDone = r);

    public initializedEvent: Promise<DebugProtocol.InitializedEvent>;
    public firstStoppedEvent: Promise<DebugProtocol.StoppedEvent>;

    public initializeRequestArgs: DebugProtocol.InitializeRequestArguments;
    public launchRequestArgs: DebugProtocol.LaunchRequestArguments;
    public attachRequestArgs: DebugProtocol.AttachRequestArguments;
    public configurationDoneArgs: DebugProtocol.ConfigurationDoneArguments;

    public attachInsteadOfLaunch: boolean;

    public static getDefaultInitArgs(): DebugProtocol.InitializeRequestArguments {
        return {
            adapterID: 'nativescript',
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: 'path'
        };
    }

    public static getDefaultLaunchArgs(platform: string, appRoot: string, emulator: boolean): DebugProtocol.LaunchRequestArguments {
        let args = {
            platform: platform,
            request: "launch",
            appRoot: appRoot,
            sourceMaps: true,
            emulator: emulator,
            tnsArgs: process.env.DeviceId ? ['--device', process.env.DeviceId] : []
        };
        return args;
    }

    public static getDefaultAttachArgs(platform: string, appRoot: string, emulator: boolean): DebugProtocol.LaunchRequestArguments {
        let args = {
            platform: platform,
            request: "attach",
            appRoot: appRoot,
            sourceMaps: true,
            emulator: emulator,
            tnsArgs: process.env.DeviceId ? ['--device', process.env.DeviceId] : []
        };
        return args;
    }

    constructor(client: NsDebugClient) {
        this.client = client;

        this.initializedEvent = this.client.onNextTime('initialized');
        this.firstStoppedEvent = this.client.onNextTime('stopped');

        this.initializeRequest = this.started.then(() => {
            return this.client.initializeRequest(this.initializeRequestArgs || Scenario.getDefaultInitArgs());
        });

        this.launchRequest = this.initializeRequest.then(() => {
            if (!this.attachInsteadOfLaunch) {
                this.resolveBeforeLaunch();
                return this.beforeLaunchRequest.then(() => {
                    return this.client.launchRequest(this.launchRequestArgs).then(launchResponse => {
                        this.resolveAfterLaunch();
                        return this.afterLaunchRequest.then(_ => launchResponse);
                    });
                });
            }
        });

        this.attachRequest = this.initializeRequest.then(() => {
            if (this.attachInsteadOfLaunch) {
                this.resolveBeforeAttach();
                return this.beforeAttachRequest.then(() => {
                    return this.client.attachRequest(this.attachRequestArgs).then(attachResponse => {
                        this.resolveAfterAttach();
                        return this.afterAttachRequest.then(_ => attachResponse);
                    });
                });
            }
        });

        this.configurationDoneRequest = Promise.all<{}>([this.launchRequest, this.attachRequest, this.initializedEvent]).then(() => {
            this.resolveBeforeConfigurationDone();
            return this.beforeConfigurationDoneRequest.then(() => {
                return this.client.configurationDoneRequest(this.configurationDoneArgs).then(confDoneResponse => {
                    this.resolveAfterConfigurationDone();
                    return this.afterConfigurationDoneRequest.then(_ => confDoneResponse);
                });
            });
        });
    }

    public start(): Promise<{}> {
        this.resolveStarted();
        return Promise.all<{}>([this.configurationDoneRequest, this.firstStoppedEvent]);
    }
}