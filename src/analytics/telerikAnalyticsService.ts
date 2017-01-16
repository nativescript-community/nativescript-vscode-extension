import { AnalyticsBaseInfo, OperatingSystem } from './analyticsBaseInfo';
import * as os from 'os';

// Hack needed for the Telerik Analytics JavaScript monitor to work in node environment
(global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
(global as any).XMLHttpRequest.prototype.withCredentials = false;

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export class TelerikAnalyticsService {

    private _eqatecMonitor: any;

    private static getUserAgentString(): string {
		let userAgentString: string;
		let osType = os.type();
		if(osType === "Windows_NT") {
			userAgentString = "(Windows NT " + os.release() + ")";
		} else if(osType === "Darwin") {
			userAgentString = "(Mac OS X " + os.release() + ")";
		} else {
			userAgentString = "(" + osType +")";
		}

		return userAgentString;
	}

    constructor(projectKey: string, baseInfo: AnalyticsBaseInfo) {
        require("./eqatecMonitor.min");
        let eqatec = (global as any)._eqatec;
        let settings = eqatec.createSettings(projectKey);
        settings.useHttps = false;
        settings.userAgent = TelerikAnalyticsService.getUserAgentString();
        settings.version = baseInfo.extensionVersion;
        settings.useCookies = false;

        /*
        settings.loggingInterface = {
            logMessage: console.log,
            logError: console.log
        };
        */

        //settings.testMode = true;
        this._eqatecMonitor = eqatec.createMonitor(settings);
        this._eqatecMonitor.setInstallationID(baseInfo.userId);
        this._eqatecMonitor.setUserID(baseInfo.userId);
        this._eqatecMonitor.start();
        process.on('exit', () =>  {
            this._eqatecMonitor.stop();
        });
        this._eqatecMonitor.trackFeature(`CLIVersion.${baseInfo.cliVersion}`);
        this._eqatecMonitor.trackFeature(`ExtensionVersion.${baseInfo.extensionVersion}`);
    }

    public launchDebugger(request: string, platform: string): Promise<any> {
        this._eqatecMonitor.trackFeature(`${capitalizeFirstLetter(request)}.${capitalizeFirstLetter(platform)}`);
        return Promise.resolve();
    }

    public runRunCommand(platform: string): Promise<any> {
        this._eqatecMonitor.trackFeature(`Run.${capitalizeFirstLetter(platform)}`);
        return Promise.resolve();
    }
}