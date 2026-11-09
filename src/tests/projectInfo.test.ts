import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findLocalCli,
  getAppDirectory,
  getBundler,
  getInstalledPackageVersion,
  hasDependency,
  isVitestProject,
  readPackageJson,
} from '../project/projectInfo';

describe('projectInfo', () => {
  let appRoot: string;

  const writeAppFile = (relativePath: string, content: string) => {
    const file = path.join(appRoot, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  beforeEach(() => {
    appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-project-info-'));
  });

  afterEach(() => {
    fs.rmSync(appRoot, { recursive: true, force: true });
  });

  describe('getAppDirectory', () => {
    it('defaults to app', () => {
      expect(getAppDirectory(appRoot)).toBe('app');
    });

    it('uses src when it exists', () => {
      fs.mkdirSync(path.join(appRoot, 'src'));
      expect(getAppDirectory(appRoot)).toBe('src');
    });

    it('reads appPath from nsconfig.json first', () => {
      writeAppFile('nsconfig.json', JSON.stringify({ appPath: 'legacy' }));
      writeAppFile('nativescript.config.ts', "export default { appPath: 'modern' };\n");

      expect(getAppDirectory(appRoot)).toBe('legacy');
    });

    it.each([
      ['invalid JSON', '{ not json'],
      ['no appPath', JSON.stringify({ appResourcesPath: 'res' })],
      ['empty appPath', JSON.stringify({ appPath: '' })],
    ])('falls through when nsconfig.json has %s', (_label, content) => {
      writeAppFile('nsconfig.json', content);
      fs.mkdirSync(path.join(appRoot, 'src'));

      expect(getAppDirectory(appRoot)).toBe('src');
    });

    it.each([
      ['nativescript.config.ts', "export default {\n  id: 'org.demo',\n  appPath: 'src/app',\n};\n"],
      ['nativescript.config.js', 'module.exports = { appPath: "client" };\n'],
      ['nativescript.config.mjs', 'export default { appPath: `mjs-app` };\n'],
    ])('reads appPath from %s', (file, content) => {
      writeAppFile(file, content);
      fs.mkdirSync(path.join(appRoot, 'src'));

      expect(getAppDirectory(appRoot)).toBe(content.match(/appPath: ["'`]([^"'`]+)/)![1]);
    });

    it('prefers nativescript.config.ts over .js', () => {
      writeAppFile('nativescript.config.ts', "export default { appPath: 'from-ts' };\n");
      writeAppFile('nativescript.config.js', "module.exports = { appPath: 'from-js' };\n");

      expect(getAppDirectory(appRoot)).toBe('from-ts');
    });
  });

  describe('getBundler', () => {
    it('defaults to webpack without a config', () => {
      expect(getBundler(appRoot)).toBe('webpack');
    });

    it.each([
      ['vite', 'vite'],
      ['rspack', 'rspack'],
      ['webpack', 'webpack'],
      ['parcel', 'webpack'],
    ] as const)('maps bundler %s to %s', (bundler, expected) => {
      writeAppFile('nativescript.config.ts', `export default { id: 'org.demo', bundler: '${bundler}' };\n`);
      expect(getBundler(appRoot)).toBe(expected);
    });

    it('defaults to webpack when the config has no bundler', () => {
      writeAppFile('nativescript.config.ts', "export default { id: 'org.demo' };\n");
      expect(getBundler(appRoot)).toBe('webpack');
    });
  });

  describe('isVitestProject', () => {
    it('is false without a vitest config', () => {
      writeAppFile('vite.config.ts', 'export default {};\n');
      expect(isVitestProject(appRoot)).toBe(false);
    });

    it.each(['ts', 'mts', 'js', 'mjs'])('detects vitest.config.%s', (ext) => {
      writeAppFile(`vitest.config.${ext}`, 'export default {};\n');
      expect(isVitestProject(appRoot)).toBe(true);
    });
  });

  describe('hasDependency', () => {
    it('finds runtime and dev dependencies', () => {
      writeAppFile('package.json', JSON.stringify({ dependencies: { a: '1' }, devDependencies: { b: '1' } }));

      expect(hasDependency(appRoot, 'a')).toBe(true);
      expect(hasDependency(appRoot, 'b')).toBe(true);
      expect(hasDependency(appRoot, 'c')).toBe(false);
    });

    it('is false without a package.json', () => {
      expect(hasDependency(appRoot, 'a')).toBe(false);
    });
  });

  describe('getInstalledPackageVersion', () => {
    const installPackage = (dir: string, content: string) =>
      writeAppFile(path.join(dir, 'node_modules', '@nativescript', 'vite', 'package.json'), content);

    it('reads the version from the nearest install', () => {
      installPackage('.', JSON.stringify({ version: '8.0.22' }));
      installPackage('apps/mobile', JSON.stringify({ version: '8.1.0' }));

      expect(getInstalledPackageVersion(appRoot, '@nativescript/vite')).toBe('8.0.22');
      expect(getInstalledPackageVersion(path.join(appRoot, 'apps', 'mobile'), '@nativescript/vite')).toBe('8.1.0');
    });

    it('walks up to a workspace root install', () => {
      installPackage('.', JSON.stringify({ version: '8.0.23' }));
      const nested = path.join(appRoot, 'apps', 'mobile');
      fs.mkdirSync(nested, { recursive: true });

      expect(getInstalledPackageVersion(nested, '@nativescript/vite')).toBe('8.0.23');
    });

    it('is undefined when the package is missing or its package.json is unreadable', () => {
      expect(getInstalledPackageVersion(appRoot, '@nativescript/vite')).toBeUndefined();

      installPackage('.', '{ not json');
      expect(getInstalledPackageVersion(appRoot, '@nativescript/vite')).toBeUndefined();
    });
  });

  describe('findLocalCli', () => {
    const installCli = (dir: string, bin = 'ns') => {
      const file = path.join(appRoot, dir, 'node_modules', '.bin', bin);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '');
      return file;
    };

    it('finds the CLI installed in the app root', () => {
      const cli = installCli('.');
      expect(findLocalCli(appRoot, 'darwin')).toBe(cli);
    });

    it('walks up to a parent directory', () => {
      const cli = installCli('.');
      const nested = path.join(appRoot, 'apps', 'mobile');
      fs.mkdirSync(nested, { recursive: true });

      expect(findLocalCli(nested, 'linux')).toBe(cli);
    });

    it('prefers the nearest install', () => {
      installCli('.');
      const nearest = installCli('apps/mobile');

      expect(findLocalCli(path.join(appRoot, 'apps', 'mobile'), 'linux')).toBe(nearest);
    });

    it('looks for ns.cmd on Windows', () => {
      installCli('.');
      expect(findLocalCli(appRoot, 'win32')).toBeUndefined();

      const cmd = installCli('.', 'ns.cmd');
      expect(findLocalCli(appRoot, 'win32')).toBe(cmd);
    });

    it('returns undefined when no ancestor has the CLI', () => {
      expect(findLocalCli(appRoot, 'darwin')).toBeUndefined();
    });
  });

  describe('readPackageJson', () => {
    it('parses package.json', () => {
      writeAppFile('package.json', JSON.stringify({ name: 'demo-app', version: '1.0.0' }));
      expect(readPackageJson(appRoot)).toEqual({ name: 'demo-app', version: '1.0.0' });
    });

    it('returns undefined when missing or invalid', () => {
      expect(readPackageJson(appRoot)).toBeUndefined();
      writeAppFile('package.json', '{ invalid');
      expect(readPackageJson(appRoot)).toBeUndefined();
    });
  });
});
