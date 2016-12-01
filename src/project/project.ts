import {ChildProcess} from 'child_process';
import {EventEmitter} from 'events';
import * as path from 'path';
import {Version} from '../common/version';
import {NativeScriptCli} from './nativeScriptCli';

export type DebugResult = { tnsProcess: ChildProcess, tnsOutputEventEmitter: EventEmitter };

export abstract class Project {
    private _appRoot: string;
    private _cli: NativeScriptCli;

    constructor(appRoot: string, cli: NativeScriptCli) {
        this._appRoot = appRoot;
        this._cli = cli;
    }

    public get appRoot(): string { return this._appRoot; }

    public get cli(): NativeScriptCli { return this._cli; }

    public abstract platformName(): string;

    public platformBuildPath(): string {
        return path.join(this.appRoot, 'platforms', this.platformName(), 'build');
    }

    public build(tnsArgs: string[]): ChildProcess {
        return this.executeBuildCommand(tnsArgs);
    }

    public run(tnsArgs?: string[]): ChildProcess {
        return this.executeRunCommand(tnsArgs);
    }

    public abstract attach(tnsArgs?: string[]): DebugResult;

    public abstract debugWithSync(options: { stopOnEntry: boolean, syncAllFiles: boolean }, tnsArgs?: string[]): DebugResult;

    public abstract debug(options: { stopOnEntry: boolean }, tnsArgs?: string[]): DebugResult;

    protected executeRunCommand(args: string[]): ChildProcess {
        return this.cli.execute(["run", this.platformName()].concat(args), this._appRoot);
    }

    protected executeBuildCommand(args: string[]): ChildProcess {
        return this.cli.execute(["build", this.platformName()].concat(args), this._appRoot);
    }

    protected executeDebugCommand(args: string[]): ChildProcess {
        return this.cli.execute(["debug", this.platformName(), "--no-client"].concat(args), this._appRoot);
    }
}
