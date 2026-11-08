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

describe('WorkspaceConfigService.configuredNsPath', () => {
  afterEach(() => {
    testing.configuration = {};
  });

  it('is undefined when nothing is set', () => {
    expect(new WorkspaceConfigService().configuredNsPath).toBeUndefined();
  });

  it('returns an explicit nsPath', () => {
    testing.configuration = { nsPath: 'npx ns', tnsPath: '/opt/tns' };
    expect(new WorkspaceConfigService().configuredNsPath).toBe('npx ns');
  });

  it('treats an explicitly empty nsPath as unset, without falling back to tnsPath', () => {
    testing.configuration = { nsPath: '', tnsPath: '/opt/tns' };
    expect(new WorkspaceConfigService().configuredNsPath).toBeUndefined();
  });

  it('falls back to a non-empty tnsPath and warns once', () => {
    testing.configuration = { tnsPath: '/opt/tns' };
    const logger = { log: vi.fn() };
    const service = new WorkspaceConfigService(logger);

    expect(service.configuredNsPath).toBe('/opt/tns');
    expect(service.configuredNsPath).toBe('/opt/tns');
    expect(logger.log).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('deprecated'), LogLevel.Warn);
  });

  it('ignores an empty tnsPath', () => {
    testing.configuration = { tnsPath: '' };
    expect(new WorkspaceConfigService().configuredNsPath).toBeUndefined();
  });
});
