import * as os from 'os';
import { Version } from '../../common/Version';
import { GUAService } from './GUAService';
import { AnalyticsBaseInfo, OperatingSystem } from './AnalyticsBaseInfo';
import { ExtensionVersionInfo } from '../ExtensionVersionInfo';
import * as ns from '../NsCliService';

export class AnalyticsService {
    private static _instance: AnalyticsService;

    private _baseInfo: AnalyticsBaseInfo;
    private _gua: GUAService;

    public static getInstance(): AnalyticsService {
        if (!this._instance) {
            this._instance = new AnalyticsService();
        }
        return this._instance;
    }

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
        let operatingSystem = OperatingSystem.Other;
        switch(process.platform) {
            case 'win32': { operatingSystem = OperatingSystem.Windows; break; }
            case 'darwin': { operatingSystem = OperatingSystem.OSX; break; }
            case 'linux':
            case 'freebsd': { operatingSystem = OperatingSystem.Linux; break; }
        };

        this._baseInfo = {
            cliVersion: Version.stringify(ns.CliVersionInfo.getInstalledCliVersion()),
            extensionVersion: Version.stringify(ExtensionVersionInfo.getExtensionVersion()),
            operatingSystem: operatingSystem,
            userId: AnalyticsService.generateMachineId(),
            hostname: 'ns-vs-extension.org'
        };

        this._gua = new GUAService('UA-111455-29', this._baseInfo);
    }

    public launchDebugger(request: string, platform: string, emulator: boolean): Promise<any> {
        try {
            return this._gua.launchDebugger(request, platform, emulator);
        } catch(e) {}
    }

    public runRunCommand(platform: string, emulator: boolean): Promise<any> {
        try {
            return this._gua.runRunCommand(platform, emulator);
        } catch(e) {}
    }
}