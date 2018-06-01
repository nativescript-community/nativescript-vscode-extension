import * as ua from 'universal-analytics';
import { IAnalyticsBaseInfo, OperatingSystem } from './analyticsBaseInfo';

/**
 * Google Universal Analytics Service
 */
export class GUAService {
    private _visitor: ua.Visitor;
    private _getBasePayload: () => any;

    constructor(trackingId: string, baseInfo: IAnalyticsBaseInfo) {
        const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
        const requestOptions = proxy ? { proxy } : {};
        this._visitor = ua(trackingId, baseInfo.clientId, { requestOptions, strictCidFormat: false });
        this._getBasePayload = () => {
            return {
                cd5: baseInfo.cliVersion,
                cd6: OperatingSystem[baseInfo.operatingSystem],
                cd7: baseInfo.extensionVersion,
                cid: baseInfo.clientId,
                dh: 'ns-vs-extension.org',
            };
        };
    }

    public launchDebugger(request: string, platform: string): Promise<any> {
        const payload = this._getBasePayload();

        payload.ec = 'vscode-extension-debug'; // event category
        payload.ea = `debug-${request}-on-${platform}`; // event action

        return this.sendEvent(payload);
    }

    public runRunCommand(platform: string): Promise<any> {
        const payload = this._getBasePayload();

        payload.ec = 'vscode-extension-command'; // event category
        payload.ea = `command-run-on-${platform}`; // event action

        return this.sendEvent(payload);
    }

    private sendEvent(params): Promise<any> {
        return new Promise<any>((res, rej) => {
            this._visitor.event(params, (err) => {
                return err ? rej(err) : res();
            });
        });
    }
}
