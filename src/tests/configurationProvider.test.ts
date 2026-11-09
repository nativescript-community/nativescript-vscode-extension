import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigurationResolver,
  DynamicConfigurationProvider,
  launchConfigurations,
} from '../debug-adapter/configurationProvider';

const showQuickPick = vi.mocked(vscode.window.showQuickPick);

describe('launchConfigurations', () => {
  it('offers iOS and Android on macOS', () => {
    expect(launchConfigurations('darwin').map((c) => [c.name, c.platform as unknown])).toEqual([
      ['Launch on iOS', 'ios'],
      ['Launch on Android', 'android'],
    ]);
  });

  it('offers only Android elsewhere', () => {
    expect(launchConfigurations('linux').map((c) => c.platform as unknown)).toEqual(['android']);
  });

  it('builds launch configurations with HMR/watch on', () => {
    expect(launchConfigurations('linux')[0]).toEqual({
      name: 'Launch on Android',
      type: 'nativescript',
      request: 'launch',
      platform: 'android',
      appRoot: '${workspaceFolder}',
      sourceMaps: true,
      watch: true,
    });
  });
});

describe('DynamicConfigurationProvider', () => {
  let root: string;
  const folder = () => ({ uri: vscode.Uri.file(root), name: 'app', index: 0 }) as unknown as vscode.WorkspaceFolder;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-config-provider-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists launch configurations for a NativeScript workspace', () => {
    fs.writeFileSync(path.join(root, 'nativescript.config.ts'), 'export default {};\n');
    expect(new DynamicConfigurationProvider('darwin').provideDebugConfigurations(folder())).toEqual(
      launchConfigurations('darwin'),
    );
  });

  it('lists nothing for other workspaces or without a folder', () => {
    const provider = new DynamicConfigurationProvider('darwin');
    expect(provider.provideDebugConfigurations(folder())).toEqual([]);
    expect(provider.provideDebugConfigurations(undefined)).toEqual([]);
  });
});

describe('ConfigurationResolver', () => {
  it('passes configurations from launch.json through unchanged', async () => {
    const config = { type: 'nativescript', request: 'launch', name: 'Mine', platform: 'ios' };
    await expect(new ConfigurationResolver('darwin').resolveDebugConfiguration(undefined, config)).resolves.toBe(
      config,
    );
    expect(showQuickPick).not.toHaveBeenCalled();
  });

  it('asks for the platform when started without a launch.json', async () => {
    showQuickPick.mockImplementationOnce((items) => Promise.resolve((items as vscode.QuickPickItem[])[1]));

    const resolved = await new ConfigurationResolver('darwin').resolveDebugConfiguration(
      undefined,
      {} as vscode.DebugConfiguration,
    );

    expect(resolved).toEqual(launchConfigurations('darwin')[1]);
  });

  it('cancels the launch when the platform pick is dismissed', async () => {
    await expect(
      new ConfigurationResolver('darwin').resolveDebugConfiguration(undefined, {} as vscode.DebugConfiguration),
    ).resolves.toBeUndefined();
  });

  it('uses Android without asking when it is the only platform', async () => {
    const resolved = await new ConfigurationResolver('win32').resolveDebugConfiguration(
      undefined,
      {} as vscode.DebugConfiguration,
    );

    expect(resolved).toEqual(launchConfigurations('win32')[0]);
    expect(showQuickPick).not.toHaveBeenCalled();
  });
});
