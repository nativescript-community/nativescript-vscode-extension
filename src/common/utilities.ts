import { ChildProcess, execSync, spawn } from 'child_process';
import * as os from 'os';
import { ILogger, LogLevel } from '../common/logger';

/** Launch-config style environment overrides: a `null` value removes the variable. */
export type EnvOverrides = Record<string, string | null | undefined>;

export interface ShellSpawnOptions {
  cwd: string;
  env?: EnvOverrides;
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

/**
 * Commands run through the user's login shell so PATH managers (nvm, asdf, ...) apply even when VS Code was
 * started from the Dock. cmd.exe avoids https://github.com/NativeScript/nativescript-vscode-extension/issues/121
 */
export function getShell(): string | undefined {
  return getPlatform() === Platform.Windows ? 'cmd.exe' : process.env.SHELL;
}

export function resolveEnv(overrides?: EnvOverrides): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === null) {
      delete env[key];
    } else if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

/** Quotes one argument for the shell returned by getShell(), so it reaches the program as a single argument. */
export function quoteShellArg(arg: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    return /^[\w\-+=:,./\\@]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`;
  }
  // A leading `=` is expanded to a command path by zsh (EQUALS option), so it must be quoted.
  return /^[\w\-+:,./@%][\w\-+=:,./@%]*$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * Runs a command line through the shell. On POSIX the child leads its own process group so killProcess can signal
 * the whole tree (e.g. `npx` → `nx` → `ns` → bundler), like Ctrl+C in a terminal.
 */
export function spawnInShell(commandLine: string, options: ShellSpawnOptions): ChildProcess {
  const child = spawn(commandLine, {
    cwd: options.cwd,
    env: resolveEnv(options.env),
    shell: getShell() ?? true,
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  return child;
}

export function killProcess(childProcess: ChildProcess, logger?: ILogger, signal: NodeJS.Signals = 'SIGINT'): void {
  const pid = childProcess.pid;
  if (pid === undefined) return;

  logger?.log(`Stopping process: ${pid}`);

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`);
      return;
    }

    try {
      process.kill(-pid, signal);
    } catch {
      // Not a process group leader (spawned without spawnInShell).
      childProcess.kill(signal);
    }
  } catch (error) {
    logger?.log(String(error), LogLevel.Error);
  }
}
