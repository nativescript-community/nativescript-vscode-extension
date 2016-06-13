import * as ua from 'universal-analytics';
import { AnalyticsBaseInfo, OperatingSystem } from './AnalyticsBaseInfo';

/**
 * Google Universal Analytics Service
 */
export class GUAService {
    private _visitor: any;
    private _getBasePayload: () => any;

    constructor(trackingId: string, baseInfo: AnalyticsBaseInfo) {
        this._visitor = ua(trackingId);
        this._getBasePayload = () => {
            return {
                uid: baseInfo.userId,
                dh: baseInfo.hostname,
                cd5: baseInfo.cliVersion,
                cd6: OperatingSystem[baseInfo.operatingSystem],
                cd7: baseInfo.extensionVersion
            };
        };
    }

    public launchDebugger(request: string, platform: string, emulator: boolean): Promise<any> {
        let payload = this._getBasePayload();
        payload.ec = 'vscode-extension-debug'; // event category
        payload.ea = `debug-${request}-on-${platform}-${emulator ? 'emulator' : 'device'}`; // event action
        return this.sendEvent(payload);
    }

    public runRunCommand(platform: string, emulator: boolean): Promise<any> {
        let payload = this._getBasePayload();
        payload.ec = 'vscode-extension-command'; // event category
        payload.ea = `command-run-on-${platform}-${emulator ? 'emulator' : 'device'}`; // event action
        return this.sendEvent(payload);
    }

    private sendEvent(params): Promise<any> {
        return new Promise<any>((res, rej) => {
            this._visitor.event(params, err => {
                return err ? rej(err) : res();
            });
        });
    }
}