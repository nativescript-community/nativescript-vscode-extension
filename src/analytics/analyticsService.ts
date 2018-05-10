import * as os from 'os';
import { Version } from '../common/version';
import { GUAService } from './guaService';
import { TelerikAnalyticsService } from './telerikAnalyticsService';
import { AnalyticsBaseInfo, OperatingSystem } from './analyticsBaseInfo';
import { Services } from '../services/extensionHostServices';
import * as utils from '../common/utilities';
import * as vscode from 'vscode';

export class AnalyticsService {
    private static HAS_ANALYTICS_PROMPT_SHOWN = "nativescript.hasAnalyticsPromptShown";
    private static ANALYTICS_PROMPT_MESSAGE = "Help improve NativeScript Extension by allowing Progress to collect data usage.";
    private static ANALYTICS_PROMPT_ACTION = "Track";

    private _globalState: vscode.Memento;
    private _baseInfo: AnalyticsBaseInfo;
    private _gua: GUAService;
    private _ta: TelerikAnalyticsService;
    private _analyticsEnabled: boolean;
    private disposables: vscode.Disposable[] = [];

    public static generateMachineId(): string {
        let machineId = '';
        try {
            let netInterfaces = os.networkInterfaces();
            Object.keys(netInterfaces).forEach(interfName => {
                netInterfaces[interfName].forEach(interf => {
                    if (!interf.internal) {
                        machineId += `${interf.mac}-`;
                    }
                });
            });
        } catch(e) {}
        return machineId;
    }

    constructor(globalState: vscode.Memento) {
        this._globalState = globalState;

        //TODO: Dispose
        vscode.workspace.onDidChangeConfiguration(() => this.updateAnalyticsEnabled());

        this._baseInfo = {
            cliVersion: Services.cli().version.toString(),
            extensionVersion: utils.getInstalledExtensionVersion().toString(),
            operatingSystem: AnalyticsService.getOperatingSystem(),
            userId: AnalyticsService.generateMachineId()
        };

        this.initializeAnalytics();
    }

    public launchDebugger(request: string, platform: string): Promise<any> {
        if(this._analyticsEnabled) {
            try {
                return Promise.all([
                    this._gua.launchDebugger(request, platform),
                    this._ta.launchDebugger(request, platform)
                ]);
            } catch(e) {}
        }
        return Promise.resolve();
    }

    public runRunCommand(platform: string): Promise<any> {
        if(this._analyticsEnabled) {
            try {
                return Promise.all([
                    this._gua.runRunCommand(platform),
                    this._ta.runRunCommand(platform)
                ]);
            } catch(e) { }
        }
        return Promise.resolve();
    }

    private static getOperatingSystem() : OperatingSystem {
        switch(process.platform) {
            case 'win32':
                return OperatingSystem.Windows;
            case 'darwin':
                return OperatingSystem.OSX;
            case 'linux':
            case 'freebsd':
                return OperatingSystem.Linux;
            default:
                return OperatingSystem.Other;
        };
    }

    private initializeAnalytics() : void {
        const hasAnalyticsPromptShown = this._globalState.get(AnalyticsService.HAS_ANALYTICS_PROMPT_SHOWN);
        if(hasAnalyticsPromptShown) {
            vscode.window.showInformationMessage(AnalyticsService.ANALYTICS_PROMPT_MESSAGE, AnalyticsService.ANALYTICS_PROMPT_ACTION)
            .then(result => this.onAnalyticsMessageConfirmation(result));

            return;
        }

        this.updateAnalyticsEnabled();
    }

    private onAnalyticsMessageConfirmation(result: string) : void {
        const shouldEnableAnalytics = result === AnalyticsService.ANALYTICS_PROMPT_ACTION ? true : false;

        Services.workspaceConfigService().isAnalyticsEnabled = shouldEnableAnalytics;
        this.updateAnalyticsEnabled();
        this._globalState.update(AnalyticsService.HAS_ANALYTICS_PROMPT_SHOWN, true);
    }

    private updateAnalyticsEnabled() {
        this._analyticsEnabled = Services.workspaceConfigService().isAnalyticsEnabled;

        if(this._analyticsEnabled) {
            this._gua = this._gua || new GUAService('UA-111455-29', this._baseInfo);
            this._ta = this._ta ||  new TelerikAnalyticsService('b8b2e51f188f43e9b0dfb899f7b71cc6', this._baseInfo);
        }
    }
}