import { ChildProcess, execSync } from 'child_process';
import * as os from 'os';
import { ILogger, LogLevel } from '../common/logger';

export function killProcess(childProcess: ChildProcess, logger?: ILogger): void {
  logger?.log(`Stopping process: ${childProcess.pid}`);

  try {
    switch (process.platform) {
      case 'win32':
        execSync(`taskkill /pid ${childProcess.pid!} /T /F`);
        break;

      default:
        // ctrl + c
        execSync(`kill -2 ${childProcess.pid!.toString()}`);
        break;
    }
  } catch (error) {
    logger?.log(String(error), LogLevel.Error);
  }
}

export const enum Platform {
  Windows,
  OSX,
  Linux,
}

export function getPlatform(): Platform {
  const platform = os.platform();

  return platform === 'darwin' ? Platform.OSX : platform === 'win32' ? Platform.Windows : Platform.Linux;
}
