import { ChildProcess, exec } from 'child_process';
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

    this._shellPath = utils.getShell();
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
              `NativeScript CLI not found at '${this._path}'. Install it in the project ('npm install -D nativescript') or globally ('npm install -g nativescript'), or set 'nativescript.nsPath' to its path.`,
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

  /**
   * Arguments are joined unquoted, so nsPath values like `npx ns` and tnsArgs written with shell quoting keep
   * working.
   */
  public execute(args: string[], options: utils.ShellSpawnOptions): ChildProcess {
    const commandLine = [this._path, ...ANALYTICS_CLIENT_ARGS, ...args].join(' ');
    this._logger.log(`[NativeScriptCli] execute: ${commandLine}`);

    return utils.spawnInShell(commandLine, options);
  }
}
