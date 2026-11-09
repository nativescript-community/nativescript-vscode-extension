import * as fs from 'fs';
import * as path from 'path';

export type Bundler = 'webpack' | 'rspack' | 'vite';

const CONFIG_FILES = ['nativescript.config.ts', 'nativescript.config.js', 'nativescript.config.mjs'];

function readFile(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function readNativeScriptConfig(appRoot: string): string | undefined {
  for (const name of CONFIG_FILES) {
    const content = readFile(path.join(appRoot, name));
    if (content !== undefined) return content;
  }
  return undefined;
}

/** Reads a top-level string property from nativescript.config.* without evaluating it. */
function readConfigString(appRoot: string, key: string): string | undefined {
  const config = readNativeScriptConfig(appRoot);
  return config?.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];
}

export function readPackageJson(appRoot: string): { name?: string; [key: string]: unknown } | undefined {
  const content = readFile(path.join(appRoot, 'package.json'));
  if (content === undefined) return undefined;
  try {
    return JSON.parse(content) as { name?: string; [key: string]: unknown };
  } catch {
    return undefined;
  }
}

export function hasDependency(appRoot: string, packageName: string): boolean {
  const packageJson = readPackageJson(appRoot);
  return ['dependencies', 'devDependencies'].some((field) => {
    const deps = packageJson?.[field];
    return typeof deps === 'object' && deps !== null && packageName in deps;
  });
}

/** Mirrors the CLI's ProjectData.getAppDirectoryRelativePath. */
export function getAppDirectory(appRoot: string): string {
  const legacyConfig = readFile(path.join(appRoot, 'nsconfig.json'));
  if (legacyConfig !== undefined) {
    try {
      const appPath = (JSON.parse(legacyConfig) as { appPath?: unknown }).appPath;
      if (typeof appPath === 'string' && appPath) return appPath;
    } catch {
      // fall through to the defaults
    }
  }

  return readConfigString(appRoot, 'appPath') ?? (fs.existsSync(path.join(appRoot, 'src')) ? 'src' : 'app');
}

export function getBundler(appRoot: string): Bundler {
  const bundler = readConfigString(appRoot, 'bundler');
  return bundler === 'vite' || bundler === 'rspack' ? bundler : 'webpack';
}

/**
 * Finds `node_modules/<relativePath>` in appRoot or any parent directory, like Node resolution and npx do, so
 * monorepos that install packages at the workspace root are covered.
 */
function findInNodeModules(appRoot: string, relativePath: string): string | undefined {
  let dir = path.resolve(appRoot);

  while (true) {
    const candidate = path.join(dir, 'node_modules', relativePath);
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function findLocalCli(appRoot: string, platform: NodeJS.Platform = process.platform): string | undefined {
  return findInNodeModules(appRoot, path.join('.bin', platform === 'win32' ? 'ns.cmd' : 'ns'));
}

export function getInstalledPackageVersion(appRoot: string, packageName: string): string | undefined {
  const packageJson = findInNodeModules(appRoot, path.join(packageName, 'package.json'));
  if (!packageJson) return undefined;
  try {
    const version = (JSON.parse(fs.readFileSync(packageJson, 'utf8')) as { version?: unknown }).version;
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}

export function isVitestProject(appRoot: string): boolean {
  return ['ts', 'mts', 'js', 'mjs'].some((ext) => fs.existsSync(path.join(appRoot, `vitest.config.${ext}`)));
}
