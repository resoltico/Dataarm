import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, mockDesktop } = vi.hoisted(() => ({
  invoke: vi.fn(),
  mockDesktop: {
    bootstrapMock: vi.fn(),
    openWorkspaceMock: vi.fn(),
    refreshWorkspaceMock: vi.fn(),
    createWorkspaceMock: vi.fn(),
    readTargetMock: vi.fn(),
    getTargetTemplateMock: vi.fn(),
    previewTargetMock: vi.fn(),
    saveTargetMock: vi.fn(),
    updateNotificationSettingsMock: vi.fn(),
    clearNotificationFeedMock: vi.fn(),
    deleteTargetMock: vi.fn(),
    runTargetMock: vi.fn(),
    runWorkspaceMock: vi.fn(),
    openWorkspacePathMock: vi.fn(),
    openTargetPathMock: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('../../src/lib/mockDesktop', () => mockDesktop);

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
  });

  it('routes every command to the mock backend when tauri internals are absent', async () => {
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
        contractSeed: {},
      },
      canonicalToml: 'target_id = "http"\n',
    };
    mockDesktop.bootstrapMock.mockResolvedValue('bootstrap');
    mockDesktop.openWorkspaceMock.mockResolvedValue('open-workspace');
    mockDesktop.refreshWorkspaceMock.mockResolvedValue('refresh-workspace');
    mockDesktop.createWorkspaceMock.mockResolvedValue('create-workspace');
    mockDesktop.readTargetMock.mockResolvedValue('read-target');
    mockDesktop.getTargetTemplateMock.mockResolvedValue(targetTemplate);
    mockDesktop.previewTargetMock.mockResolvedValue('preview-target');
    mockDesktop.saveTargetMock.mockResolvedValue('save-target');
    mockDesktop.updateNotificationSettingsMock.mockResolvedValue('update-notifications');
    mockDesktop.clearNotificationFeedMock.mockResolvedValue('clear-feed');
    mockDesktop.deleteTargetMock.mockResolvedValue('delete-target');
    mockDesktop.runTargetMock.mockResolvedValue('run-target');
    mockDesktop.runWorkspaceMock.mockResolvedValue('run-workspace');
    mockDesktop.openWorkspacePathMock.mockResolvedValue(undefined);
    mockDesktop.openTargetPathMock.mockResolvedValue(undefined);

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

    expect(mockDesktop.openWorkspaceMock).toHaveBeenCalledWith('/tmp/demo');
    expect(mockDesktop.createWorkspaceMock).toHaveBeenCalledWith('/tmp/new');
    expect(mockDesktop.getTargetTemplateMock).toHaveBeenCalledWith('http');
    expect(mockDesktop.previewTargetMock).toHaveBeenCalledWith({ rawToml: 'raw' });
    expect(mockDesktop.saveTargetMock).toHaveBeenCalledWith({ rawToml: 'raw' });
    expect(mockDesktop.updateNotificationSettingsMock).toHaveBeenCalledWith({
      notifyWhen: 'off',
      delivery: 'both',
    });
    expect(mockDesktop.deleteTargetMock).toHaveBeenCalledWith('demo');
    expect(mockDesktop.runTargetMock).toHaveBeenCalledWith('demo');
    expect(mockDesktop.openTargetPathMock).toHaveBeenCalledWith('demo');
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

  it('treats non-browser runtimes as tauri hosts instead of using the mock backend', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });
    invoke.mockResolvedValue('non-browser-result');

    await expect(api.bootstrap()).resolves.toBe('non-browser-result');
    await expect(api.openWorkspace('/tmp/demo')).resolves.toBe('non-browser-result');

    expect(invoke).toHaveBeenNthCalledWith(1, 'bootstrap');
    expect(invoke).toHaveBeenNthCalledWith(2, 'open_workspace', { workspacePath: '/tmp/demo' });
    expect(mockDesktop.bootstrapMock).not.toHaveBeenCalled();
    expect(mockDesktop.openWorkspaceMock).not.toHaveBeenCalled();
  });
});
