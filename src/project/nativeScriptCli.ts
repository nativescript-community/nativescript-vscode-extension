import { ChildProcess, execSync, spawn } from 'child_process';
import { ILogger } from '../common/logger';
import * as utils from '../common/utilities';

export class NativeScriptCli {
    private _path: string;
    private _shellPath: string;
    private _logger: ILogger;

    constructor(cliPath: string, logger: ILogger) {
        this._path = cliPath;
        this._logger = logger;

        this._shellPath = process.env.SHELL;

        // always default to cmd on Windows
        // workaround for issue #121 https://github.com/NativeScript/nativescript-vscode-extension/issues/121
        if (utils.getPlatform() === utils.Platform.Windows) {
            this._shellPath = 'cmd.exe';
        }
    }

    public get path(): string { return this._path; }

    public executeGetVersion(): string {
        try {
            return this.executeSync(['--version'], undefined);
        } catch (e) {
            this._logger.log(e);

            const errorMessage = `NativeScript CLI not found. Use 'nativescript.tnsPath' workspace setting
                                  to explicitly set the absolute path to the NativeScript CLI.`;

            throw new Error(errorMessage);
        }
    }

    public executeSync(args: string[], cwd: string): string {
        args.unshift('--analyticsClient', 'VSCode');
        const command: string = `${this._path} ${args.join(' ')}`;

        this._logger.log(`[NativeScriptCli] execute: ${command}`);

        return execSync(command, { encoding: 'utf8', cwd, shell: this._shellPath}).toString().trim();
    }

    public execute(args: string[], cwd: string): ChildProcess {
        args.unshift('--analyticsClient', 'VSCode');
        const command: string = `${this._path} ${args.join(' ')}`;

        this._logger.log(`[NativeScriptCli] execute: ${command}`);

        const options = { cwd, shell: this._shellPath };
        const child: ChildProcess = spawn(this._path, args, options);

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');

        return child;
    }
}
