import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import type { TargetDocumentRecord, WorkspaceSnapshot } from '../../../src/types';
import { makeDocument } from '../fixtures';
import {
  configureApi,
  deferred,
  makeDraftSession,
  makeWorkspace,
  targetToml,
  waitForLoadedState,
} from './harness';

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

describe('useDashboardState transition guards', () => {
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

  it('blocks actions while workspace and document transitions are in flight', async () => {
    const openWorkspaceLoad = deferred<WorkspaceSnapshot>();
    const readTargetLoad = deferred<TargetDocumentRecord>();

    api.openWorkspace.mockReturnValueOnce(openWorkspaceLoad.promise);
    api.readTarget.mockImplementation(async (directoryName: string) => {
      if (directoryName === 'bravo') {
        return readTargetLoad.promise;
      }
      return makeDocument({
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
      });
    });

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      void result.current.handleOpenRecentWorkspace('/tmp/dataarm/pending-workspace');
    });
    await act(async () => {
      await result.current.handleSelectTarget('bravo');
      await result.current.handleStartNewTarget('file');
    });
    expect(api.getTargetTemplate).not.toHaveBeenCalled();
    expect(result.current.selectedDirectoryName).toBe('alpha');

    openWorkspaceLoad.resolve(makeWorkspace());
    await waitFor(() => {
      expect(result.current.openingWorkspace).toBe(false);
    });

    const previewCalls = api.previewTarget.mock.calls.length;
    const saveCalls = api.saveTarget.mock.calls.length;
    const deleteCalls = api.deleteTarget.mock.calls.length;
    const runCalls = api.runTarget.mock.calls.length;
    const runWorkspaceCalls = api.runWorkspace.mock.calls.length;
    const openPathCalls = api.openTargetPath.mock.calls.length;

    act(() => {
      void result.current.handleSelectTarget('bravo');
    });
    await waitFor(() => {
      expect(result.current.loadingTarget).toBe(true);
    });

    await act(async () => {
      await result.current.handlePreview();
      await result.current.handleSave();
      await result.current.handleDeleteSelectedTarget();
      await result.current.handleRunSelectedTarget();
      await result.current.handleRunWorkspace();
      await result.current.handleOpenSelectedTargetPath();
      result.current.handleResetDraft();
    });

    expect(api.previewTarget.mock.calls.length).toBe(previewCalls);
    expect(api.saveTarget.mock.calls.length).toBe(saveCalls);
    expect(api.deleteTarget.mock.calls.length).toBe(deleteCalls);
    expect(api.runTarget.mock.calls.length).toBe(runCalls);
    expect(api.runWorkspace.mock.calls.length).toBe(runWorkspaceCalls);
    expect(api.openTargetPath.mock.calls.length).toBe(openPathCalls);

    readTargetLoad.resolve(
      makeDocument({
        directoryName: 'bravo',
        targetId: 'bravo',
        displayName: 'Bravo',
        rawToml: targetToml('bravo', 'Bravo'),
        canonicalToml: null,
      }),
    );
    await waitFor(() => {
      expect(result.current.loadingTarget).toBe(false);
      expect(result.current.selectedDirectoryName).toBe('bravo');
    });
  });
});
