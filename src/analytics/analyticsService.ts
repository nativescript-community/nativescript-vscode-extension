import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { ILogger } from '../common/logger';
import { services } from '../services/extensionHostServices';
import { IAnalyticsBaseInfo, OperatingSystem } from './analyticsBaseInfo';
import { GUAService } from './guaService';

export class AnalyticsService {
    private static HAS_ANALYTICS_PROMPT_SHOWN_KEY = 'nativescript.hasAnalyticsPromptShown';
    private static CLIENT_ID_KEY = 'nativescript.analyticsClientId';
    private static DOCS_LINK = 'https://github.com/NativeScript/nativescript-vscode-extension/blob/master/README.md#how-to-disable-the-analytics';
    private static ANALYTICS_PROMPT_MESSAGE = `Help us improve the NativeScript extension by allowing Progress to collect anonymous usage data.
                                               For more information about the gathered information and how it is used,
                                               read our [privacy statement](https://www.progress.com/legal/privacy-policy).
                                               You can [disable the analytics and data collection](${AnalyticsService.DOCS_LINK}) at any given time.
                                               Do you want to enable analytics?`;

    private static ANALYTICS_PROMPT_ACCEPT_ACTION = 'Yes';
    private static ANALYTICS_PROMPT_DENY_ACTION = 'No';

    private static getOperatingSystem(): OperatingSystem {
        switch (process.platform) {
            case 'win32':
                return OperatingSystem.Windows;
            case 'darwin':
                return OperatingSystem.OSX;
            case 'linux':
            case 'freebsd':
                return OperatingSystem.Linux;
            default:
                return OperatingSystem.Other;
        }
    }

    private _globalState: vscode.Memento;
    private _logger: ILogger;
    private _baseInfo: IAnalyticsBaseInfo;
    private _gua: GUAService;
    private _analyticsEnabled: boolean;

    constructor(globalState: vscode.Memento, cliVersion: string, extensionVersion: string, logger: ILogger) {
        this._globalState = globalState;
        this._logger = logger;

        vscode.workspace.onDidChangeConfiguration(() => this.updateAnalyticsEnabled());

        this._baseInfo = {
            cliVersion,
            clientId: this.getOrGenerateClientId(),
            extensionVersion,
            operatingSystem: AnalyticsService.getOperatingSystem(),
        };
    }

    public launchDebugger(request: string, platform: string): Promise<any> {
        if (this._analyticsEnabled) {
            try {
                return this._gua.launchDebugger(request, platform);
            } catch (e) {
                this._logger.log(`Analytics error: ${_.isString(e) ? e : e.message}`);
            }
        }

        return Promise.resolve();
    }

    public runRunCommand(platform: string): Promise<any> {
        if (this._analyticsEnabled) {
            try {
                return this._gua.runRunCommand(platform);
            } catch (e) {
                this._logger.log(`Analytics error: ${_.isString(e) ? e : e.message}`);
            }
        }

        return Promise.resolve();
    }

    public initialize(): void {
        const hasAnalyticsPromptShown = this._globalState.get<boolean>(AnalyticsService.HAS_ANALYTICS_PROMPT_SHOWN_KEY);

        if (!hasAnalyticsPromptShown) {
            vscode.window.showInformationMessage(AnalyticsService.ANALYTICS_PROMPT_MESSAGE,
                AnalyticsService.ANALYTICS_PROMPT_ACCEPT_ACTION,
                AnalyticsService.ANALYTICS_PROMPT_DENY_ACTION,
            )
                .then((result) => this.onAnalyticsMessageConfirmation(result));

            return;
        }

        this.updateAnalyticsEnabled();
    }

    private getOrGenerateClientId(): string {
        let clientId = this._globalState.get<string>(AnalyticsService.CLIENT_ID_KEY);

        if (!clientId) {
            clientId = uuidv4();
            this._globalState.update(AnalyticsService.CLIENT_ID_KEY, clientId);
        }

        return clientId;
    }

    private onAnalyticsMessageConfirmation(result: string): void {
        const shouldEnableAnalytics = result === AnalyticsService.ANALYTICS_PROMPT_ACCEPT_ACTION ? true : false;

        this._globalState.update(AnalyticsService.HAS_ANALYTICS_PROMPT_SHOWN_KEY, true);

        services.workspaceConfigService.isAnalyticsEnabled = shouldEnableAnalytics;
        this.updateAnalyticsEnabled();
    }

    private updateAnalyticsEnabled() {
        this._analyticsEnabled = services.workspaceConfigService.isAnalyticsEnabled;

        if (this._analyticsEnabled && !this._gua) {
            this._gua = new GUAService('UA-111455-29', this._baseInfo);
        }
    }
}
