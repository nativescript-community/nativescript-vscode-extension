import * as os from 'os';
import { Version } from '../common/version';
import { GUAService } from './GUAService';
import { TelerikAnalyticsService } from './TelerikAnalyticsService';
import { AnalyticsBaseInfo, OperatingSystem } from './AnalyticsBaseInfo';
import { Services } from '../services/extensionHostServices';
import * as utils from '../common/utilities';

export class AnalyticsService {
    private _baseInfo: AnalyticsBaseInfo;
    private _gua: GUAService;
    private _ta: TelerikAnalyticsService;
    private _analyticsEnabled: boolean;

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

    constructor() {
        this._analyticsEnabled = Services.workspaceConfigService().isAnalyticsEnabled;
        let operatingSystem = OperatingSystem.Other;
        switch(process.platform) {
            case 'win32': { operatingSystem = OperatingSystem.Windows; break; }
            case 'darwin': { operatingSystem = OperatingSystem.OSX; break; }
            case 'linux':
            case 'freebsd': { operatingSystem = OperatingSystem.Linux; break; }
        };

        this._baseInfo = {
            cliVersion: Services.cli().version.toString(),
            extensionVersion: utils.getInstalledExtensionVersion().toString(),
            operatingSystem: operatingSystem,
            userId: AnalyticsService.generateMachineId()
        };

        if(this._analyticsEnabled) {
            this._gua = new GUAService('UA-111455-29', this._baseInfo);
            this._ta = new TelerikAnalyticsService('b8b2e51f188f43e9b0dfb899f7b71cc6', this._baseInfo);
        }
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
}