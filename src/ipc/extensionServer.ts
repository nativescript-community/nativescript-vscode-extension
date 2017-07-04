import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as extProtocol from './extensionProtocol';
import {Services} from '../services/extensionHostServices';
let ipc = require('node-ipc');

export class ExtensionServer {
    private _isRunning: boolean;

    public static getTempFilePathForDirectory(directoryPath: string) {
        let fileName: string = 'vsc-ns-ext-' + crypto.createHash('md5').update(directoryPath).digest("hex") + '.sock';
        return path.join(os.tmpdir(), fileName);
    }

    constructor() {
        this._isRunning = false;
    }

    public getPipeHandlePath(): string {
        return vscode.workspace.rootPath ?
            ExtensionServer.getTempFilePathForDirectory(vscode.workspace.rootPath) :
            null;
    }

    public start() {
        if (!this._isRunning) {
            let pipeHandlePath = this.getPipeHandlePath();
            if (pipeHandlePath) {
                ipc.serve(
                    pipeHandlePath,
                    () => {
                        ipc.server.on('extension-protocol-message', (data: extProtocol.Request, socket) => {
                            return (<Promise<Object>>this[data.method].call(this, data.args)).then(result => {
                                let response: extProtocol.Response = { requestId: data.id, result: result };
                                return ipc.server.emit(socket, 'extension-protocol-message', response);
                            });
                        });
                    });
                ipc.server.start();
                this._isRunning = true;
            }
        }
        return this._isRunning;
    }

    public stop() {
        if (this._isRunning) {
            ipc.server.stop();
            this._isRunning = false;
        }
    }

    public isRunning() {
        return this._isRunning;
    }

    public getInitSettings(): Promise<extProtocol.InitSettingsResult> {
        let tnsPath = Services.workspaceConfigService().tnsPath;
        return Promise.resolve({ tnsPath: tnsPath });
    }

    public analyticsLaunchDebugger(args: extProtocol.AnalyticsLaunchDebuggerArgs): Promise<any> {
        return Services.analyticsService().launchDebugger(args.request, args.platform);
    }

    public runRunCommand(args: extProtocol.AnalyticsRunRunCommandArgs): Promise<any> {
        return Services.analyticsService().runRunCommand(args.platform);
    }

    public selectTeam() : Promise<{ id: string, name: string }> {
        return new Promise((resolve, reject) => {
            let developmentTeams = this.getDevelopmentTeams();
            if(developmentTeams.length > 1) {
                let quickPickItems = developmentTeams.map((team) => {
                    return {
                        label: team.name,
                        description: team.id
                    };
                });
                vscode.window.showQuickPick(quickPickItems)
                    .then(val => resolve({
                            id: val.description,
                            name: val.label
                        }));
            } else {
                resolve();
            }
        });
    }

    private getDevelopmentTeams(): Array<{ id: string, name: string }> {
        try {
            let dir = path.join(process.env.HOME, "Library/MobileDevice/Provisioning Profiles/");
            let files = fs.readdirSync(dir);
            let teamIds: any = {};
            for (let file of files) {
                let filePath = path.join(dir, file);
                let data = fs.readFileSync(filePath, { encoding: "utf8" });
                let teamId = this.getProvisioningProfileValue("TeamIdentifier", data);
                let teamName = this.getProvisioningProfileValue("TeamName", data);
                if (teamId) {
                    teamIds[teamId] = teamName;
                }
            }

            let teamIdsArray = new Array<{ id: string, name: string }>();
            for (let teamId in teamIds) {
                teamIdsArray.push({ id: teamId, name: teamIds[teamId] });
            }

            return teamIdsArray;
        } catch (e) {
            // no matter what happens, don't break
            return new Array<{ id: string, name: string }>();
        }
	}

    private getProvisioningProfileValue(name: string, text: string): string {
		let findStr = "<key>" + name + "</key>";
		let index = text.indexOf(findStr);
		if (index > 0) {
			index = text.indexOf("<string>", index + findStr.length);
			if (index > 0) {
				index += "<string>".length;
				let endIndex = text.indexOf("</string>", index);
				let result = text.substring(index, endIndex);
				return result;
			}
		}

		return null;
	}
}