import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// tslint:disable-next-line:class-name
export class iOSTeamService {
    public selectTeam(): Promise<{ id: string, name: string }> {
        return new Promise((resolve, reject) => {
            const workspaceTeamId = vscode.workspace.getConfiguration().get<string>('nativescript.iosTeamId');

            if (workspaceTeamId) {
                resolve({
                    id: workspaceTeamId,
                    name: undefined, // irrelevant
                });

                return;
            }

            const developmentTeams = this.getDevelopmentTeams();

            if (developmentTeams.length > 1) {
                const quickPickItems: vscode.QuickPickItem[] = developmentTeams.map((team) => {
                    return {
                        description: team.id,
                        label: team.name,
                    };
                });

                vscode.window.showQuickPick(
                    quickPickItems, {
                    placeHolder: 'Select your development team',
                })
                    .then((val: vscode.QuickPickItem) => {
                        vscode.workspace.getConfiguration().update('nativescript.iosTeamId', val.description);
                        resolve({
                            id: val.description,
                            name: val.label,
                        });
                    });
            } else {
                resolve(null);
            }
        });
    }

    private getDevelopmentTeams(): Array<{ id: string, name: string }> {
        try {
            const dir = path.join(process.env.HOME, 'Library/MobileDevice/Provisioning Profiles/');
            const files = fs.readdirSync(dir);
            const teamIds: any = {};

            for (const file of files) {
                const filePath = path.join(dir, file);
                const data = fs.readFileSync(filePath, { encoding: 'utf8' });
                const teamId = this.getProvisioningProfileValue('TeamIdentifier', data);
                const teamName = this.getProvisioningProfileValue('TeamName', data);

                if (teamId) {
                    teamIds[teamId] = teamName;
                }
            }

            const teamIdsArray = new Array<{ id: string, name: string }>();

            for (const teamId in teamIds) {
                teamIdsArray.push({ id: teamId, name: teamIds[teamId] });
            }

            return teamIdsArray;
        } catch (e) {
            // no matter what happens, don't break
            return new Array<{ id: string, name: string }>();
        }
    }

    private getProvisioningProfileValue(name: string, text: string): string {
        const findStr = '<key>' + name + '</key>';
        let index = text.indexOf(findStr);

        if (index > 0) {
            index = text.indexOf('<string>', index + findStr.length);
            if (index > 0) {
                index += '<string>'.length;
                const endIndex = text.indexOf('</string>', index);
                const result = text.substring(index, endIndex);

                return result;
            }
        }

        return null;
    }
}
