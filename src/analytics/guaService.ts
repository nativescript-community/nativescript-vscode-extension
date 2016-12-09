import * as ua from 'universal-analytics';
import { AnalyticsBaseInfo, OperatingSystem } from './analyticsBaseInfo';

/**
 * Google Universal Analytics Service
 */
export class GUAService {
    private _visitor: any;
    private _getBasePayload: () => any;

    constructor(trackingId: string, baseInfo: AnalyticsBaseInfo) {
        this._visitor = ua(trackingId, baseInfo.userId, { requestOptions: {}, strictCidFormat: false });
        this._getBasePayload = () => {
            return {
                uid: baseInfo.userId,
                dh: 'ns-vs-extension.org',
                cd5: baseInfo.cliVersion,
                cd6: OperatingSystem[baseInfo.operatingSystem],
                cd7: baseInfo.extensionVersion
            };
        };
    }

    public launchDebugger(request: string, platform: string): Promise<any> {
        let payload = this._getBasePayload();
        payload.ec = 'vscode-extension-debug'; // event category
        payload.ea = `debug-${request}-on-${platform}`; // event action
        return this.sendEvent(payload);
    }

    public runRunCommand(platform: string): Promise<any> {
        let payload = this._getBasePayload();
        payload.ec = 'vscode-extension-command'; // event category
        payload.ea = `command-run-on-${platform}`; // event action
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