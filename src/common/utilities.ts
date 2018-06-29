import { ChildProcess, execSync, spawnSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';

export function killProcess(childProcess: ChildProcess): void {
    try {
        switch (process.platform) {
            case 'win32':
                execSync(`taskkill /pid ${childProcess.pid} /T /F`);
                break;

            default:
                const cmd = path.join(__dirname, 'terminateProcess.sh');

                spawnSync(cmd, [ childProcess.pid.toString() ]);
                break;
        }
    } catch (error) {
        // TODO: Log error
    }
}

export const enum Platform {
    Windows, OSX, Linux,
}

export function getPlatform(): Platform {
    const platform = os.platform();

    return platform === 'darwin' ? Platform.OSX :
        platform === 'win32' ? Platform.Windows :
            Platform.Linux;
}
