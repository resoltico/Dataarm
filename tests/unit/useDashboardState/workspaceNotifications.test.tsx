import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import {
  makeDocument,
  makeNotificationCenter,
  makeTarget,
  makeWorkspaceSnapshot,
} from '../fixtures';
import {
  configureApi,
  makeDraftSession,
  makeTemplate,
  targetToml,
  waitForLoadedState,
} from './harness';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  clearNotificationFeed: vi.fn(),
  createWorkspace: vi.fn(),
  deleteTarget: vi.fn(),
  getTargetTemplate: vi.fn(),
  openTargetPath: vi.fn(),
  openWorkspacePath: vi.fn(),
  openWorkspace: vi.fn(),
  previewTarget: vi.fn(),
  readTarget: vi.fn(),
  refreshWorkspace: vi.fn(),
  runTarget: vi.fn(),
  runWorkspace: vi.fn(),
  saveTarget: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

vi.mock('../../../src/lib/api', () => api);

describe('useDashboardState workspace and notification flows', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    configureApi(api);
  });

  it('switches workspaces, manages notifications, and handles path actions', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    const emptyWorkspace = makeWorkspaceSnapshot({ targets: [] });
    const reopenedWorkspace = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'zeta',
          targetId: 'zeta',
          displayName: 'Zeta',
          statusKind: 'ready',
        }),
      ],
    });

    api.readTarget.mockImplementation((directoryName: string) =>
      Promise.resolve(
        makeDocument({
          directoryName,
          targetId: directoryName,
          displayName: directoryName.toUpperCase(),
          rawToml: targetToml(directoryName, directoryName.toUpperCase()),
          canonicalToml: targetToml(directoryName, directoryName.toUpperCase()),
          guidedSession: makeDraftSession(
            'file',
            directoryName,
            directoryName.toUpperCase(),
            '/tmp/dataarm/demo.html',
          ),
        }),
      ),
    );
    api.openWorkspace.mockResolvedValueOnce(reopenedWorkspace);
    api.openWorkspace.mockResolvedValueOnce(emptyWorkspace);
    api.openWorkspace.mockRejectedValueOnce(new Error('Workspace open exploded'));
    api.createWorkspace.mockRejectedValueOnce(new Error('Workspace create exploded'));
    api.createWorkspace.mockResolvedValueOnce(emptyWorkspace);
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        targets: reopenedWorkspace.targets,
        notificationCenter: makeNotificationCenter({
          settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
          permissionState: 'prompt',
        }),
      }),
    );
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        targets: reopenedWorkspace.targets,
        notificationCenter: makeNotificationCenter({
          settings: { notifyWhen: 'off', delivery: 'in_app' },
          permissionState: 'granted',
        }),
      }),
    );
    api.updateNotificationSettings.mockRejectedValueOnce(new Error('Notification update exploded'));
    api.clearNotificationFeed.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        targets: reopenedWorkspace.targets,
        notificationCenter: makeNotificationCenter({
          items: [],
        }),
      }),
    );
    api.clearNotificationFeed.mockRejectedValueOnce(new Error('Clear exploded'));
    api.openWorkspacePath.mockRejectedValueOnce(new Error('Workspace path exploded'));
    api.openTargetPath.mockRejectedValueOnce(new Error('Target path exploded'));

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDraftField('displayName', 'Alpha dirty open');
    });
    confirm.mockReturnValue(false);
    await act(async () => {
      await result.current.handleOpenWorkspaceFromInput();
    });
    expect(api.openWorkspace).not.toHaveBeenCalled();

    act(() => {
      result.current.handleResetDraft();
    });
    confirm.mockReturnValue(true);
    act(() => {
      result.current.setWorkspaceInput('/tmp/dataarm/reopened');
    });
    await act(async () => {
      await result.current.handleOpenWorkspaceFromInput();
    });

    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('zeta');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Workspace loaded.',
      });
    });

    act(() => {
      result.current.setWorkspaceInput('   ');
    });
    await act(async () => {
      await result.current.handleOpenWorkspaceFromInput();
    });
    expect(api.openWorkspace).toHaveBeenCalledWith(undefined);
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBeNull();
      expect(result.current.document.data).toBeNull();
    });

    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/failure');
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Workspace open exploded',
    });

    api.openWorkspace.mockResolvedValueOnce(reopenedWorkspace);
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/reopened-before-create');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('zeta');
    });

    act(() => {
      result.current.setDraftField('displayName', 'Zeta dirty create');
    });

    confirm.mockReturnValue(false);
    act(() => {
      result.current.setWorkspaceInput('/tmp/dataarm/new-workspace');
    });
    await act(async () => {
      await result.current.handleCreateWorkspaceFromInput();
    });
    expect(api.createWorkspace).not.toHaveBeenCalledWith('/tmp/dataarm/new-workspace');

    confirm.mockReturnValue(true);
    act(() => {
      result.current.setWorkspaceInput('   ');
    });
    await act(async () => {
      await result.current.handleCreateWorkspaceFromInput();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Enter a workspace path first.',
    });

    act(() => {
      result.current.setWorkspaceInput('/tmp/dataarm/create-failure');
    });
    await act(async () => {
      await result.current.handleCreateWorkspaceFromInput();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Workspace create exploded',
    });

    act(() => {
      result.current.setWorkspaceInput('/tmp/dataarm/create-success');
    });
    await act(async () => {
      await result.current.handleCreateWorkspaceFromInput();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Workspace created.',
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace: emptyWorkspace,
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Workspace batch run finished.',
    });

    api.refreshWorkspace.mockResolvedValueOnce(emptyWorkspace);
    api.runWorkspace.mockRejectedValueOnce(new Error('Empty workspace run exploded'));
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Empty workspace run exploded',
    });

    api.clearNotificationFeed.mockReset();
    api.clearNotificationFeed.mockResolvedValueOnce(emptyWorkspace);
    await act(async () => {
      await result.current.handleClearNotificationFeed();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'info',
      message: 'Notification history cleared.',
    });

    api.getTargetTemplate.mockResolvedValueOnce(
      makeTemplate(
        'http',
        'empty_workspace_http',
        'Empty workspace http',
        'https://example.com/empty',
      ),
    );
    expect(result.current.document.data).toBeNull();
    expect(result.current.selectedDirectoryName).toBeNull();
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    await waitFor(() => {
      expect(api.getTargetTemplate).toHaveBeenCalledWith('http');
      expect(result.current.editorMode).toBe('http');
      expect(result.current.draftToml).toContain('empty_workspace_http');
    });

    await act(async () => {
      await result.current.handleUpdateNotificationSettings({
        notifyWhen: 'changes_and_errors',
        delivery: 'both',
      });
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'System delivery is not ready on this runtime.',
    });

    await act(async () => {
      await result.current.handleUpdateNotificationSettings({
        notifyWhen: 'off',
        delivery: 'in_app',
      });
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Notification settings updated.',
    });

    await act(async () => {
      await result.current.handleUpdateNotificationSettings({
        notifyWhen: 'errors_only',
        delivery: 'system',
      });
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Notification update exploded',
    });

    api.clearNotificationFeed.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        targets: reopenedWorkspace.targets,
        notificationCenter: makeNotificationCenter({
          items: [],
        }),
      }),
    );
    api.clearNotificationFeed.mockRejectedValueOnce(new Error('Clear exploded'));
    await act(async () => {
      await result.current.handleClearNotificationFeed();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'info',
      message: 'Notification history cleared.',
    });

    await act(async () => {
      await result.current.handleClearNotificationFeed();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Clear exploded',
    });

    await act(async () => {
      await result.current.handleOpenWorkspacePath();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Workspace path exploded',
    });

    api.openWorkspacePath.mockClear();
    api.openTargetPath.mockClear();
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    await act(async () => {
      await result.current.handleOpenSelectedTargetPath();
    });
    expect(api.openTargetPath).not.toHaveBeenCalled();

    api.openWorkspace.mockResolvedValueOnce(reopenedWorkspace);
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/reopened-again');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('zeta');
    });

    await act(async () => {
      await result.current.handleOpenSelectedTargetPath();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Target path exploded',
    });
  });
});
