import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, browserWorkbenchClient } = vi.hoisted(() => ({
  invoke: vi.fn(),
  browserWorkbenchClient: {
    bootstrapWorkbench: vi.fn(),
    openWorkspaceWorkbench: vi.fn(),
    refreshWorkspaceWorkbench: vi.fn(),
    createWorkspaceWorkbench: vi.fn(),
    readTargetWorkbench: vi.fn(),
    getTargetTemplateWorkbench: vi.fn(),
    previewTargetWorkbench: vi.fn(),
    saveTargetWorkbench: vi.fn(),
    updateNotificationSettingsWorkbench: vi.fn(),
    clearNotificationFeedWorkbench: vi.fn(),
    deleteTargetWorkbench: vi.fn(),
    runTargetWorkbench: vi.fn(),
    runWorkspaceWorkbench: vi.fn(),
    openWorkspacePathWorkbench: vi.fn(),
    openTargetPathWorkbench: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('../../src/lib/browserWorkbenchClient', () => browserWorkbenchClient);

import * as api from '../../src/lib/api';

describe('desktop api bridge', () => {
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWindow = window;
    delete (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
    vi.unstubAllEnvs();
  });

  it('routes every command to the browser workbench backend when tauri internals are absent', async () => {
    const targetTemplate = {
      kind: 'http',
      draftSession: {
        draft: {
          kind: 'http',
          targetId: 'http',
          displayName: 'HTTP',
          enabled: true,
          sourceLocator: 'https://example.com',
          fetchMethod: 'GET',
          fetchTimeoutMs: 15000,
          fetchMaxBytes: 2000000,
          fetchUserAgent: 'dataarm/template',
          fetchFollowRedirects: true,
          fetchAccept: 'text/html,application/xhtml+xml',
          selectionKind: 'css_selector',
          selectionMatch: 'single',
          selectionIndex: null,
          selectionSelector: 'main',
          selectionStart: null,
          selectionEnd: null,
          selectionDelimiterMode: null,
          selectionIncludeStart: null,
          selectionIncludeEnd: null,
          selectionRegexFlags: [],
          compareBasis: 'text',
          compareWhitespace: 'normalize',
          compareRewriteUrls: false,
          compareCanonicalizers: [],
          storageHistoryLimit: 20,
        },
        contractSeedToml: 'schema_name = "ffhn.target"\n',
      },
      canonicalToml: 'target_id = "http"\n',
    };
    browserWorkbenchClient.bootstrapWorkbench.mockResolvedValue('bootstrap');
    browserWorkbenchClient.openWorkspaceWorkbench.mockResolvedValue('open-workspace');
    browserWorkbenchClient.refreshWorkspaceWorkbench.mockResolvedValue('refresh-workspace');
    browserWorkbenchClient.createWorkspaceWorkbench.mockResolvedValue('create-workspace');
    browserWorkbenchClient.readTargetWorkbench.mockResolvedValue('read-target');
    browserWorkbenchClient.getTargetTemplateWorkbench.mockResolvedValue(targetTemplate);
    browserWorkbenchClient.previewTargetWorkbench.mockResolvedValue('preview-target');
    browserWorkbenchClient.saveTargetWorkbench.mockResolvedValue('save-target');
    browserWorkbenchClient.updateNotificationSettingsWorkbench.mockResolvedValue(
      'update-notifications',
    );
    browserWorkbenchClient.clearNotificationFeedWorkbench.mockResolvedValue('clear-feed');
    browserWorkbenchClient.deleteTargetWorkbench.mockResolvedValue('delete-target');
    browserWorkbenchClient.runTargetWorkbench.mockResolvedValue('run-target');
    browserWorkbenchClient.runWorkspaceWorkbench.mockResolvedValue('run-workspace');
    browserWorkbenchClient.openWorkspacePathWorkbench.mockResolvedValue(undefined);
    browserWorkbenchClient.openTargetPathWorkbench.mockResolvedValue(undefined);

    await expect(api.bootstrap()).resolves.toBe('bootstrap');
    await expect(api.openWorkspace('/tmp/demo')).resolves.toBe('open-workspace');
    await expect(api.refreshWorkspace()).resolves.toBe('refresh-workspace');
    await expect(api.createWorkspace('/tmp/new')).resolves.toBe('create-workspace');
    await expect(api.readTarget('demo')).resolves.toBe('read-target');
    await expect(api.getTargetTemplate('http')).resolves.toBe(targetTemplate);
    await expect(api.previewTarget({ rawToml: 'raw' })).resolves.toBe('preview-target');
    await expect(api.saveTarget({ rawToml: 'raw' })).resolves.toBe('save-target');
    await expect(
      api.updateNotificationSettings({ notifyWhen: 'off', delivery: 'both' }),
    ).resolves.toBe('update-notifications');
    await expect(api.clearNotificationFeed()).resolves.toBe('clear-feed');
    await expect(api.deleteTarget('demo')).resolves.toBe('delete-target');
    await expect(api.runTarget('demo')).resolves.toBe('run-target');
    await expect(api.runWorkspace(4)).resolves.toBe('run-workspace');
    await expect(api.openWorkspacePath()).resolves.toBeUndefined();
    await expect(api.openTargetPath('demo')).resolves.toBeUndefined();

    expect(browserWorkbenchClient.openWorkspaceWorkbench).toHaveBeenCalledWith('/tmp/demo');
    expect(browserWorkbenchClient.createWorkspaceWorkbench).toHaveBeenCalledWith('/tmp/new');
    expect(browserWorkbenchClient.getTargetTemplateWorkbench).toHaveBeenCalledWith('http');
    expect(browserWorkbenchClient.previewTargetWorkbench).toHaveBeenCalledWith({ rawToml: 'raw' });
    expect(browserWorkbenchClient.saveTargetWorkbench).toHaveBeenCalledWith({ rawToml: 'raw' });
    expect(browserWorkbenchClient.updateNotificationSettingsWorkbench).toHaveBeenCalledWith({
      notifyWhen: 'off',
      delivery: 'both',
    });
    expect(browserWorkbenchClient.deleteTargetWorkbench).toHaveBeenCalledWith('demo');
    expect(browserWorkbenchClient.runTargetWorkbench).toHaveBeenCalledWith('demo');
    expect(browserWorkbenchClient.runWorkspaceWorkbench).toHaveBeenCalledWith(4);
    expect(browserWorkbenchClient.openTargetPathWorkbench).toHaveBeenCalledWith('demo');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('routes every command to tauri when internals are present', async () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue('tauri-result');

    await api.bootstrap();
    await api.openWorkspace('/tmp/demo');
    await api.refreshWorkspace();
    await api.createWorkspace('/tmp/new');
    await api.readTarget('demo');
    await api.getTargetTemplate('file');
    await api.previewTarget({ rawToml: 'raw' });
    await api.saveTarget({ previousDirectoryName: 'old', rawToml: 'raw' });
    await api.updateNotificationSettings({ notifyWhen: 'errors_only', delivery: 'system' });
    await api.clearNotificationFeed();
    await api.deleteTarget('demo');
    await api.runTarget('demo');
    await api.runWorkspace(8);
    await api.openWorkspacePath();
    await api.openTargetPath('demo');

    expect(invoke).toHaveBeenNthCalledWith(1, 'bootstrap');
    expect(invoke).toHaveBeenNthCalledWith(2, 'open_workspace', { workspacePath: '/tmp/demo' });
    expect(invoke).toHaveBeenNthCalledWith(3, 'refresh_workspace');
    expect(invoke).toHaveBeenNthCalledWith(4, 'create_workspace', { workspacePath: '/tmp/new' });
    expect(invoke).toHaveBeenNthCalledWith(5, 'read_target', { directoryName: 'demo' });
    expect(invoke).toHaveBeenNthCalledWith(6, 'get_target_template', { kind: 'file' });
    expect(invoke).toHaveBeenNthCalledWith(7, 'preview_target', { request: { rawToml: 'raw' } });
    expect(invoke).toHaveBeenNthCalledWith(8, 'save_target', {
      request: { previousDirectoryName: 'old', rawToml: 'raw' },
    });
    expect(invoke).toHaveBeenNthCalledWith(9, 'update_notification_settings', {
      settings: { notifyWhen: 'errors_only', delivery: 'system' },
    });
    expect(invoke).toHaveBeenNthCalledWith(10, 'clear_notification_feed');
    expect(invoke).toHaveBeenNthCalledWith(11, 'delete_target', { directoryName: 'demo' });
    expect(invoke).toHaveBeenNthCalledWith(12, 'run_target', { directoryName: 'demo' });
    expect(invoke).toHaveBeenNthCalledWith(13, 'run_workspace', { maxConcurrency: 8 });
    expect(invoke).toHaveBeenNthCalledWith(14, 'open_workspace_path');
    expect(invoke).toHaveBeenNthCalledWith(15, 'open_target_path', { directoryName: 'demo' });
  });

  it('treats non-browser runtimes as tauri hosts instead of using the browser workbench backend', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });
    invoke.mockResolvedValue('non-browser-result');

    await expect(api.bootstrap()).resolves.toBe('non-browser-result');
    await expect(api.openWorkspace('/tmp/demo')).resolves.toBe('non-browser-result');

    expect(invoke).toHaveBeenNthCalledWith(1, 'bootstrap');
    expect(invoke).toHaveBeenNthCalledWith(2, 'open_workspace', { workspacePath: '/tmp/demo' });
    expect(browserWorkbenchClient.bootstrapWorkbench).not.toHaveBeenCalled();
    expect(browserWorkbenchClient.openWorkspaceWorkbench).not.toHaveBeenCalled();
  });

  it('fails fast when a generic browser runtime omits the maintained backend contract', async () => {
    vi.stubEnv('VITE_DATAARM_BROWSER_BACKEND', 'wrong_backend');

    await expect(api.bootstrap()).rejects.toThrow(
      'Browser runtime requires VITE_DATAARM_BROWSER_BACKEND=browser_workbench.',
    );

    expect(browserWorkbenchClient.bootstrapWorkbench).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});
