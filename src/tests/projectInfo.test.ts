import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAppDirectory, getBundler, isVitestProject, readPackageJson } from '../project/projectInfo';

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
