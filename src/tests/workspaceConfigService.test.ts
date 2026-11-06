import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel } from '../common/logger';
import { WorkspaceConfigService } from '../common/workspaceConfigService';
import { testing } from './mocks/vscode';

describe('WorkspaceConfigService.nsPath', () => {
  afterEach(() => {
    testing.configuration = {};
  });

  it('defaults to ns', () => {
    expect(new WorkspaceConfigService().nsPath).toBe('ns');
  });

  it('uses nsPath when set', () => {
    testing.configuration = { nsPath: '/opt/ns', tnsPath: '/opt/tns' };
    expect(new WorkspaceConfigService().nsPath).toBe('/opt/ns');
  });

  it('falls back to the deprecated tnsPath and warns once', () => {
    testing.configuration = { tnsPath: '/opt/tns' };
    const logger = { log: vi.fn() };
    const service = new WorkspaceConfigService(logger);

    expect(service.nsPath).toBe('/opt/tns');
    expect(service.nsPath).toBe('/opt/tns');
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('nativescript.nsPath'), LogLevel.Warn);
  });

  it('ignores an empty tnsPath', () => {
    testing.configuration = { tnsPath: '' };
    expect(new WorkspaceConfigService().nsPath).toBe('ns');
  });
});
