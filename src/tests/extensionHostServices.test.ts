import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quoteShellArg } from '../common/utilities';
import { ExtensionHostServices } from '../services/extensionHostServices';
import { testing } from './mocks/vscode';

describe('ExtensionHostServices.createCli', () => {
  let services: ExtensionHostServices;
  let appRoot: string;

  const installLocalCli = () => {
    const bin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'ns.cmd' : 'ns');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '');
    return bin;
  };

  beforeEach(() => {
    appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ns app '));
    services = new ExtensionHostServices();
    services.logger = { log: vi.fn() };
  });

  afterEach(() => {
    testing.configuration = {};
    fs.rmSync(appRoot, { recursive: true, force: true });
  });

  describe('with nsPath configured', () => {
    it.each(['ns', 'npx ns', '/usr/local/bin/ns'])('uses %j as-is', (nsPath) => {
      testing.configuration = { nsPath };
      installLocalCli();

      expect(services.createCli(appRoot).path).toBe(nsPath);
    });

    it('resolves a path-like relative value against the app root', () => {
      testing.configuration = { nsPath: './node_modules/.bin/ns' };

      expect(services.createCli(appRoot).path).toBe(path.join(appRoot, 'node_modules/.bin/ns'));
    });

    it('keeps a relative value as-is without an app root', () => {
      testing.configuration = { nsPath: './node_modules/.bin/ns' };

      expect(services.createCli().path).toBe('./node_modules/.bin/ns');
    });
  });

  describe('without nsPath configured', () => {
    it('uses the CLI installed in the project, quoted for the shell', () => {
      const bin = installLocalCli();

      const cliPath = services.createCli(appRoot).path;

      expect(cliPath).toBe(quoteShellArg(bin));
      expect(cliPath).not.toBe(bin);
    });

    it('finds the CLI installed in a parent directory', () => {
      const bin = installLocalCli();
      const nested = path.join(appRoot, 'apps', 'mobile');
      fs.mkdirSync(nested, { recursive: true });

      expect(services.createCli(nested).path).toBe(quoteShellArg(bin));
    });

    it('falls back to ns when no local CLI exists', () => {
      expect(services.createCli(appRoot).path).toBe('ns');
    });

    it('falls back to ns without an app root', () => {
      expect(services.createCli().path).toBe('ns');
    });
  });
});
