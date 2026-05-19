import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import { makeDocument, makeTarget, makeWorkspaceSnapshot } from '../fixtures';
import { configureApi, makeDraftSession, targetToml, waitForLoadedState } from './harness';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  clearNotificationFeed: vi.fn(),
  createWorkspace: vi.fn(),
  deleteTarget: vi.fn(),
  getTargetTemplate: vi.fn(),
  inspectSource: vi.fn(),
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

describe('useDashboardState target persistence', () => {
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

  it('saves and deletes targets and clears editor state for empty workspaces', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    const savedWorkspace = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'saved-target',
          targetId: 'saved-target',
          displayName: 'Saved target',
          statusKind: 'pending',
          lastRunOutcome: null,
        }),
      ],
    });

    api.saveTarget.mockResolvedValueOnce({
      directoryName: 'saved-target',
      workspace: savedWorkspace,
    });
    api.readTarget.mockImplementation((directoryName: string) => {
      if (directoryName === 'saved-target') {
        return Promise.resolve(
          makeDocument({
            directoryName: 'saved-target',
            targetId: 'saved-target',
            displayName: 'Saved target',
            rawToml: targetToml('saved_target', 'Saved target'),
            canonicalToml: targetToml('saved_target', 'Saved target'),
            guidedSession: makeDraftSession(
              'file',
              'saved_target',
              'Saved target',
              '/tmp/dataarm/demo.html',
            ),
          }),
        );
      }
      return Promise.resolve(
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
      );
    });

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDraftField('targetId', 'saved-target');
      result.current.setDraftField('displayName', 'Saved target');
    });
    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('saved-target');
      expect(result.current.document.data?.displayName).toBe('Saved target');
      expect(result.current.dirty).toBe(false);
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Watch saved. History was reset so the next check starts clean.',
      });
    });

    api.deleteTarget.mockResolvedValueOnce(makeWorkspaceSnapshot({ targets: [] }));
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });

    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBeNull();
      expect(result.current.document.data).toBeNull();
      expect(result.current.editorMode).toBe('http');
      expect(result.current.draftSession?.draft.targetId).toBe('website_watch');
      expect(result.current.draftToml).toContain('target_id = "website_watch"');
      expect(result.current.preview.data).toBeNull();
      expect(result.current.lastRun.data).toBeNull();
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Target deleted.',
      });
    });

    api.openWorkspace.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        targets: [
          makeTarget({
            directoryName: 'nameless',
            targetId: 'nameless',
            displayName: null,
          }),
        ],
      }),
    );
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/nameless');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('nameless');
    });

    api.deleteTarget.mockResolvedValueOnce(makeWorkspaceSnapshot({ targets: [] }));
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });
    expect(confirm).toHaveBeenLastCalledWith('Delete nameless?');
  });
});
