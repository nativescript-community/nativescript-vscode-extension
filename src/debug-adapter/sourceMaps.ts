import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ILogger } from '../common/logger';
import { getAppDirectory, readPackageJson } from '../project/projectInfo';

const SOURCE_EXTENSIONS = ['js', 'mjs', 'ts', 'mts', 'vue', 'svelte', 'jsx', 'tsx'];
const PROBE_MARKER = '__NS_WEBPACK_OUTPUT__';
const PROBE_TIMEOUT_MS = 30_000;

// Runs in a separate node process with cwd = app root, so the user's webpack config can't touch extension host state.
const WEBPACK_OUTPUT_PROBE = `
const path = require('path');
const platform = process.env.NS_PLATFORM;
const exported = require(path.resolve('webpack.config.js'));
Promise.resolve(typeof exported === 'function' ? exported({ [platform]: platform }) : exported).then((config) => {
  const output = (Array.isArray(config) ? config[0] : config)?.output ?? {};
  const library = typeof output.library === 'string' ? output.library : output.library?.name;
  process.stdout.write('\\n${PROBE_MARKER}' + JSON.stringify({
    devtoolNamespace: typeof output.devtoolNamespace === 'string' ? output.devtoolNamespace : undefined,
    library: typeof library === 'string' ? library : undefined,
  }));
});
`;

export interface WebpackOutputInfo {
  devtoolNamespace?: string;
  library?: string;
}

export interface SourceMapOptions {
  sourceMapPathOverrides: Record<string, string>;
  /** `null` lets js-debug load maps from anywhere; see computeSourceMapOptions. */
  resolveSourceMapLocations: string[] | null;
}

export interface SourceMapConfig {
  platform?: string;
  sourceMapPathOverrides?: Record<string, string>;
  resolveSourceMapLocations?: string[] | null;
}

export async function computeSourceMapOptions(
  appRoot: string,
  config: SourceMapConfig,
  logger: ILogger,
): Promise<SourceMapOptions> {
  const webpackOutput = await readWebpackOutput(appRoot, config.platform, logger);

  return {
    sourceMapPathOverrides: {
      ...deviceMapOverrides(appRoot, config.platform),
      ...defaultPathOverrides(appRoot, readPackageJson(appRoot)?.name, webpackOutput),
      ...config.sourceMapPathOverrides,
    },
    // Scripts run on the device, so their maps are inline data: URLs, device file:// paths or nsruntime:// URLs,
    // none of which live under the app root. Restricting locations would make js-debug drop them silently.
    resolveSourceMapLocations: config.resolveSourceMapLocations === undefined ? null : config.resolveSourceMapLocations,
  };
}

/**
 * js-debug fetches a non-file map URL over HTTP, then through CDP Network.loadNetworkResource (which runtimes that
 * rewrite sourceMapURL to nsruntime:// answer from device disk), and only then maps the URL through
 * sourceMapPathOverrides to a local file. These entries are that last fallback: they point device locations at the
 * copy of the bundle the CLI left under platforms/. Older runtimes send plain file:// device URLs, which only this
 * fallback can resolve.
 *
 * `?:*` is js-debug's non-capturing wildcard; only one capturing `*` is allowed per key.
 */
export function deviceMapOverrides(appRoot: string, platform: string | undefined): Record<string, string> {
  const overrides: Record<string, string> = {
    // webpack's FixSourceMapUrlPlugin points maps at the host build output; the runtime prefixes that with nsruntime://.
    'nsruntime:///*': '/*',
  };

  const localAppDir = getLocalPlatformAppDir(appRoot, platform);
  if (!localAppDir) return overrides;

  const devicePatterns =
    platform?.toLowerCase() === 'ios'
      ? ['/app/*', '/?:*.app/app/*']
      : // Android exposes the same files as /data/data/<pkg> and /data/user/0/<pkg>.
        ['/data/?:*/files/app/*'];

  for (const pattern of devicePatterns) {
    overrides[`nsruntime://${pattern}`] = `${localAppDir}/*`;
    overrides[`file://${pattern}`] = `${localAppDir}/*`;
  }

  return overrides;
}

/** Where the CLI copies the built app for the platform, or undefined if it hasn't been built yet. */
export function getLocalPlatformAppDir(appRoot: string, platform: string | undefined): string | undefined {
  const normalized = platform?.toLowerCase();

  if (normalized === 'android') {
    const dir = path.join(appRoot, 'platforms', 'android', 'app', 'src', 'main', 'assets', 'app');
    return fs.existsSync(dir) ? dir : undefined;
  }

  if (normalized === 'ios') {
    const iosDir = path.join(appRoot, 'platforms', 'ios');
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(iosDir, { withFileTypes: true });
    } catch {
      return undefined;
    }
    // platforms/ios/<XcodeProjectName>/app; the project name is derived by the CLI, so find it on disk.
    for (const entry of entries) {
      const dir = path.join(iosDir, entry.name, 'app');
      if (entry.isDirectory() && !entry.name.endsWith('.xcodeproj') && fs.existsSync(dir)) {
        return dir;
      }
    }
  }

  return undefined;
}

export function defaultPathOverrides(
  appRoot: string,
  packageName: string | undefined,
  webpackOutput: WebpackOutputInfo,
): Record<string, string> {
  const appDir = path.join(appRoot, getAppDirectory(appRoot));
  const overrides: Record<string, string> = {
    'webpack:///*': `${appDir}/*`,
  };

  // webpack 5 names sources webpack://<output.uniqueName>/./<path>, and uniqueName defaults to the package name.
  const namespace = webpackOutput.devtoolNamespace ?? packageName;
  if (namespace) {
    for (const ext of SOURCE_EXTENSIONS) {
      overrides[`webpack://${namespace}/*.${ext}`] = `${appRoot}/*.${ext}`;
    }
  }

  if (webpackOutput.library) {
    overrides[`webpack://${webpackOutput.library}/*`] ??= `${appDir}/*`;
  }

  return overrides;
}

/**
 * Only evaluates webpack.config.js when it customizes the fields we need; @nativescript/webpack
 * leaves both at their defaults, and loading the config costs seconds.
 */
export async function readWebpackOutput(
  appRoot: string,
  platform: string | undefined,
  logger: ILogger,
): Promise<WebpackOutputInfo> {
  const configFile = path.join(appRoot, 'webpack.config.js');
  let content: string;
  try {
    content = fs.readFileSync(configFile, 'utf8');
  } catch {
    return {};
  }

  if (!/\b(devtoolNamespace|library)\b/.test(content)) {
    return {};
  }

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['-e', WEBPACK_OUTPUT_PROBE],
      {
        cwd: appRoot,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NS_PLATFORM: platform?.toLowerCase() },
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout) => {
        const markerIndex = stdout?.lastIndexOf(PROBE_MARKER) ?? -1;
        if (error || markerIndex < 0) {
          logger.log(`[NativeScript] Could not evaluate ${configFile}: ${error?.message ?? 'no output'}\n`);
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(stdout.slice(markerIndex + PROBE_MARKER.length)) as WebpackOutputInfo);
        } catch {
          resolve({});
        }
      },
    );
  });
}
