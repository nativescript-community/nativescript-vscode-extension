import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ILogger } from '../common/logger';
import {
  computeSourceMapOptions,
  defaultPathOverrides,
  deviceMapOverrides,
  getLocalPlatformAppDir,
  readWebpackOutput,
} from '../debug-adapter/sourceMaps';

vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();
  return { ...original, execFile: vi.fn(original.execFile) };
});

const EXTENSIONS = ['js', 'mjs', 'ts', 'mts', 'vue', 'svelte', 'jsx', 'tsx'];

describe('sourceMaps', () => {
  let appRoot: string;
  let logger: { log: Mock<ILogger['log']> };

  const writeAppFile = (relativePath: string, content: string) => {
    const file = path.join(appRoot, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  beforeEach(() => {
    appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-source-maps-'));
    logger = { log: vi.fn<ILogger['log']>() };
  });

  afterEach(() => {
    fs.rmSync(appRoot, { recursive: true, force: true });
  });

  describe('defaultPathOverrides', () => {
    it('maps webpack:/// to the app directory and the package namespace to the app root', () => {
      fs.mkdirSync(path.join(appRoot, 'src'));

      const overrides = defaultPathOverrides(appRoot, 'demo-app', {});

      const expected: Record<string, string> = { 'webpack:///*': `${appRoot}/src/*` };
      for (const ext of EXTENSIONS) expected[`webpack://demo-app/*.${ext}`] = `${appRoot}/*.${ext}`;
      expect(overrides).toEqual(expected);
    });

    it('falls back to the app/ directory', () => {
      expect(defaultPathOverrides(appRoot, undefined, {})['webpack:///*']).toBe(path.join(appRoot, 'app') + '/*');
    });

    it('honors appPath from nativescript.config.ts', () => {
      fs.mkdirSync(path.join(appRoot, 'src'));
      writeAppFile('nativescript.config.ts', "export default { id: 'org.demo', appPath: 'src/app' };\n");

      expect(defaultPathOverrides(appRoot, undefined, {})['webpack:///*']).toBe(`${appRoot}/src/app/*`);
    });

    it('prefers devtoolNamespace over the package name', () => {
      const overrides = defaultPathOverrides(appRoot, 'demo-app', { devtoolNamespace: 'custom-ns' });

      expect(overrides['webpack://custom-ns/*.ts']).toBe(`${appRoot}/*.ts`);
      expect(Object.keys(overrides).some((key) => key.includes('demo-app'))).toBe(false);
    });

    it('maps the library name to the app directory', () => {
      const overrides = defaultPathOverrides(appRoot, undefined, { library: 'MyLib' });

      expect(overrides['webpack://MyLib/*']).toBe(path.join(appRoot, 'app') + '/*');
    });

    it('only maps webpack:/// without a package name or namespace', () => {
      expect(defaultPathOverrides(appRoot, undefined, {})).toEqual({
        'webpack:///*': path.join(appRoot, 'app') + '/*',
      });
    });
  });

  describe('getLocalPlatformAppDir', () => {
    it('finds the Android assets app dir', () => {
      const dir = path.join(appRoot, 'platforms/android/app/src/main/assets/app');
      fs.mkdirSync(dir, { recursive: true });

      expect(getLocalPlatformAppDir(appRoot, 'Android')).toBe(dir);
    });

    it('finds the iOS app dir inside the Xcode project folder, skipping .xcodeproj', () => {
      fs.mkdirSync(path.join(appRoot, 'platforms/ios/Demo.xcodeproj/app'), { recursive: true });
      fs.mkdirSync(path.join(appRoot, 'platforms/ios/build'), { recursive: true });
      const dir = path.join(appRoot, 'platforms/ios/Demo/app');
      fs.mkdirSync(dir, { recursive: true });

      expect(getLocalPlatformAppDir(appRoot, 'ios')).toBe(dir);
    });

    it('returns undefined before the platform is built or for unknown platforms', () => {
      expect(getLocalPlatformAppDir(appRoot, 'android')).toBeUndefined();
      expect(getLocalPlatformAppDir(appRoot, 'ios')).toBeUndefined();
      fs.mkdirSync(path.join(appRoot, 'platforms/ios/Demo'), { recursive: true });
      expect(getLocalPlatformAppDir(appRoot, 'ios')).toBeUndefined();
      expect(getLocalPlatformAppDir(appRoot, undefined)).toBeUndefined();
    });
  });

  describe('deviceMapOverrides', () => {
    it('only maps nsruntime:/// before the platform is built', () => {
      expect(deviceMapOverrides(appRoot, 'android')).toEqual({ 'nsruntime:///*': '/*' });
      expect(deviceMapOverrides(appRoot, 'ios')).toEqual({ 'nsruntime:///*': '/*' });
    });

    it('maps Android device paths to the local assets app dir', () => {
      const dir = path.join(appRoot, 'platforms/android/app/src/main/assets/app');
      fs.mkdirSync(dir, { recursive: true });

      expect(deviceMapOverrides(appRoot, 'android')).toEqual({
        'nsruntime:///*': '/*',
        'nsruntime:///data/?:*/files/app/*': `${dir}/*`,
        'file:///data/?:*/files/app/*': `${dir}/*`,
      });
    });

    it('maps iOS bundle paths to the local Xcode project app dir', () => {
      const dir = path.join(appRoot, 'platforms/ios/Demo/app');
      fs.mkdirSync(dir, { recursive: true });

      expect(deviceMapOverrides(appRoot, 'iOS')).toEqual({
        'nsruntime:///*': '/*',
        'nsruntime:///app/*': `${dir}/*`,
        'file:///app/*': `${dir}/*`,
        'nsruntime:///?:*.app/app/*': `${dir}/*`,
        'file:///?:*.app/app/*': `${dir}/*`,
      });
    });
  });

  describe('computeSourceMapOptions', () => {
    it('merges device and webpack defaults and leaves resolveSourceMapLocations unrestricted', async () => {
      writeAppFile('package.json', JSON.stringify({ name: 'demo-app' }));
      const localAppDir = path.join(appRoot, 'platforms/android/app/src/main/assets/app');
      fs.mkdirSync(localAppDir, { recursive: true });

      const options = await computeSourceMapOptions(appRoot, { platform: 'android' }, logger);

      expect(options.sourceMapPathOverrides).toMatchObject({
        'nsruntime:///*': '/*',
        'file:///data/?:*/files/app/*': `${localAppDir}/*`,
        'webpack:///*': path.join(appRoot, 'app') + '/*',
        'webpack://demo-app/*.ts': `${appRoot}/*.ts`,
      });
      expect(options.resolveSourceMapLocations).toBeNull();
    });

    it('lets user overrides win over device and webpack defaults', async () => {
      fs.mkdirSync(path.join(appRoot, 'platforms/android/app/src/main/assets/app'), { recursive: true });

      const options = await computeSourceMapOptions(
        appRoot,
        {
          platform: 'android',
          sourceMapPathOverrides: {
            'webpack:///*': '/custom/*',
            'nsruntime:///*': '/runtime/*',
            'file:///data/?:*/files/app/*': '/device/*',
            'extra:///*': '/extra/*',
          },
        },
        logger,
      );

      expect(options.sourceMapPathOverrides).toMatchObject({
        'webpack:///*': '/custom/*',
        'nsruntime:///*': '/runtime/*',
        'file:///data/?:*/files/app/*': '/device/*',
        'extra:///*': '/extra/*',
      });
    });

    it.each([[['/only/**']], [null]])('passes resolveSourceMapLocations %j through', async (locations) => {
      const options = await computeSourceMapOptions(appRoot, { resolveSourceMapLocations: locations }, logger);

      expect(options.resolveSourceMapLocations).toEqual(locations);
    });

    it('uses the namespace read from webpack.config.js', async () => {
      writeAppFile('package.json', JSON.stringify({ name: 'demo-app' }));
      writeAppFile('webpack.config.js', "module.exports = { output: { devtoolNamespace: 'from-config' } };\n");

      const options = await computeSourceMapOptions(appRoot, { platform: 'android' }, logger);

      expect(options.sourceMapPathOverrides['webpack://from-config/*.js']).toBe(`${appRoot}/*.js`);
      expect(options.sourceMapPathOverrides['webpack://demo-app/*.js']).toBeUndefined();
    });
  });

  describe('readWebpackOutput', () => {
    it('returns {} when there is no webpack.config.js', async () => {
      await expect(readWebpackOutput(appRoot, 'android', logger)).resolves.toEqual({});
      expect(childProcess.execFile).not.toHaveBeenCalled();
    });

    it('returns {} without evaluating a config that does not customize the output names', async () => {
      writeAppFile('webpack.config.js', "throw new Error('must not be evaluated');\n");

      await expect(readWebpackOutput(appRoot, 'android', logger)).resolves.toEqual({});
      expect(childProcess.execFile).not.toHaveBeenCalled();
    });

    it('evaluates a function config with the platform env and reads library.name', async () => {
      writeAppFile(
        'webpack.config.js',
        [
          'module.exports = (env) => ({',
          "  output: { devtoolNamespace: env.ios === 'ios' ? 'ios-ns' : 'other-ns', library: { name: 'MyLib' } },",
          '});',
        ].join('\n'),
      );

      await expect(readWebpackOutput(appRoot, 'iOS', logger)).resolves.toEqual({
        devtoolNamespace: 'ios-ns',
        library: 'MyLib',
      });
      expect(childProcess.execFile).toHaveBeenCalledOnce();
    });

    it('reads a string library from the first entry of an async array config', async () => {
      writeAppFile(
        'webpack.config.js',
        "module.exports = async () => [{ output: { library: 'StrLib' } }, { output: { library: 'Second' } }];\n",
      );

      await expect(readWebpackOutput(appRoot, 'android', logger)).resolves.toEqual({ library: 'StrLib' });
    });

    it('ignores console output printed by the config', async () => {
      writeAppFile(
        'webpack.config.js',
        "console.log('loading config');\nmodule.exports = { output: { devtoolNamespace: 'noisy' } };\n",
      );

      await expect(readWebpackOutput(appRoot, 'android', logger)).resolves.toEqual({ devtoolNamespace: 'noisy' });
    });

    it('returns {} and logs when the config throws', async () => {
      writeAppFile('webpack.config.js', "// output.library\nthrow new Error('boom');\n");

      await expect(readWebpackOutput(appRoot, 'android', logger)).resolves.toEqual({});
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Could not evaluate'));
    });
  });
});
