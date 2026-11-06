import { ChildProcess, exec, spawn } from 'child_process';
import * as semver from 'semver';
import { ILogger } from '../common/logger';
import * as utils from '../common/utilities';

const ANALYTICS_CLIENT_ARGS = ['--analyticsClient', 'VSCode'];

export class NativeScriptCli {
  private static CLI_OUTPUT_VERSION_REGEXP = /^(?:\d+\.){2}\d+.*?$/m;

  private _path: string;
  private _shellPath: string | undefined;
  private _logger: ILogger;

  constructor(cliPath: string, logger: ILogger) {
    this._path = cliPath;
    this._logger = logger;

    // cmd.exe avoids https://github.com/NativeScript/nativescript-vscode-extension/issues/121
    this._shellPath = utils.getPlatform() === utils.Platform.Windows ? 'cmd.exe' : process.env.SHELL;
  }

  public get path(): string {
    return this._path;
  }

  public getVersion(): Promise<string> {
    const command = [this._path, ...ANALYTICS_CLIENT_ARGS, '--version'].join(' ');
    this._logger.log(`[NativeScriptCli] execute: ${command}`);

    return new Promise((resolve, reject) => {
      exec(command, { encoding: 'utf8', shell: this._shellPath, timeout: 60_000 }, (error, stdout) => {
        if (error) {
          this._logger.log(String(error));
          reject(
            new Error(
              `NativeScript CLI not found at '${this._path}'. Use the 'nativescript.nsPath' setting to set the absolute path to the NativeScript CLI.`,
            ),
          );
          return;
        }

        const version = stdout.match(NativeScriptCli.CLI_OUTPUT_VERSION_REGEXP)?.[0];
        if (version) {
          resolve(version);
        } else {
          reject(new Error(`Could not read the NativeScript CLI version from its output: ${stdout.trim()}`));
        }
      });
    });
  }

  /** Resolves with the CLI version, or rejects with a user-facing message if it is missing or too old. */
  public async getSupportedVersion(minVersion: string): Promise<string> {
    const version = await this.getVersion();
    const parsed = semver.coerce(version);

    if (parsed && semver.lt(parsed, minVersion)) {
      throw new Error(
        `The NativeScript extension requires NativeScript CLI v${minVersion} or greater, but v${version} is installed. Update it with 'npm install -g nativescript'.`,
      );
    }

    return version;
  }

  public execute(args: string[], cwd: string): ChildProcess {
    const fullArgs = [...ANALYTICS_CLIENT_ARGS, ...args];
    this._logger.log(`[NativeScriptCli] execute: ${[this._path, ...fullArgs].join(' ')}`);

    const child = spawn(this._path, fullArgs, { cwd, shell: this._shellPath });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    return child;
  }
}
