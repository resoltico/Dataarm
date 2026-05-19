import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { errorMessage, useDashboardState } from '../../../src/hooks/useDashboardState';
import type {
  BatchRunResult,
  DesktopBootstrap,
  NotificationSettings,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetRunResult,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../../../src/types';
import {
  configureApi,
  deferred,
  makeBootstrap,
  makeDocumentMap,
  makeDraftSession,
  makePreview,
  makeTemplate,
  makeWorkspace,
  waitForLoadedState,
} from './harness';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn<() => Promise<DesktopBootstrap>>(),
  clearNotificationFeed: vi.fn<() => Promise<WorkspaceSnapshot>>(),
  createWorkspace: vi.fn<(workspacePath: string) => Promise<WorkspaceSnapshot>>(),
  deleteTarget: vi.fn<(directoryName: string) => Promise<WorkspaceSnapshot>>(),
  getTargetTemplate: vi.fn<(kind: TargetTemplateKind) => Promise<TargetTemplate>>(),
  inspectSource: vi.fn(),
  openTargetPath: vi.fn<(directoryName: string) => Promise<void>>(),
  openWorkspacePath: vi.fn<() => Promise<void>>(),
  openWorkspace: vi.fn<(workspacePath?: string) => Promise<WorkspaceSnapshot>>(),
  previewTarget: vi.fn<(request: TargetPreviewRequest) => Promise<TargetPreview>>(),
  readTarget: vi.fn<(directoryName: string) => Promise<TargetDocumentRecord>>(),
  refreshWorkspace: vi.fn<() => Promise<WorkspaceSnapshot>>(),
  runTarget: vi.fn<(directoryName: string) => Promise<TargetRunResult>>(),
  runWorkspace: vi.fn<() => Promise<BatchRunResult>>(),
  saveTarget:
    vi.fn<
      (request: {
        previousDirectoryName?: string | null;
        draftSession?: unknown;
        rawToml?: string | null;
      }) => Promise<TargetMutationResult>
    >(),
  updateNotificationSettings:
    vi.fn<(settings: NotificationSettings) => Promise<WorkspaceSnapshot>>(),
}));

vi.mock('../../../src/lib/api', () => api);

describe('useDashboardState lifecycle', () => {
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

  it('bootstraps the workspace, computes stats, and ignores stale target loads', async () => {
    const documents = makeDocumentMap();
    const bravoLoad = deferred<TargetDocumentRecord>();

    api.readTarget.mockImplementation(async (directoryName) => {
      if (directoryName === 'bravo') {
        return bravoLoad.promise;
      }
      const document = documents.get(directoryName);
      if (!document) {
        throw new Error(`Unknown mock target ${directoryName}`);
      }
      return document;
    });

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    expect(result.current.selectedDirectoryName).toBe('alpha');
    expect(result.current.document.data?.displayName).toBe('Alpha');
    expect(result.current.stats).toEqual({
      total: 4,
      runnable: 4,
      ready: 1,
      changed: 1,
      firstRun: 1,
      attention: 1,
    });

    await act(async () => {
      await result.current.handleSelectTarget('alpha');
    });
    expect(api.readTarget).toHaveBeenCalledTimes(1);

    act(() => {
      void result.current.handleSelectTarget('bravo');
    });
    await act(async () => {
      await result.current.handleSelectTarget('charlie');
    });

    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('charlie');
      expect(result.current.document.data?.displayName).toBe('Charlie');
    });

    bravoLoad.reject(new Error('Stale bravo load'));
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('charlie');
      expect(result.current.document.data?.displayName).toBe('Charlie');
    });
  });

  it('ignores bootstrap and template results when they become stale or inactive', async () => {
    const bootstrapLoad = deferred<DesktopBootstrap>();
    api.bootstrap.mockReturnValueOnce(bootstrapLoad.promise);

    const loadingHook = renderHook(() => useDashboardState());
    await waitFor(() => {
      expect(loadingHook.result.current).not.toBeNull();
    });

    await act(async () => {
      await loadingHook.result.current.handleSelectTarget('alpha');
      await loadingHook.result.current.handleStartNewTarget('http');
    });
    expect(api.readTarget).not.toHaveBeenCalled();
    expect(api.getTargetTemplate).not.toHaveBeenCalled();

    loadingHook.unmount();
    bootstrapLoad.resolve(makeBootstrap(makeWorkspace()));
    await Promise.resolve();
    expect(api.readTarget).not.toHaveBeenCalled();

    const bootstrapFailure = deferred<DesktopBootstrap>();
    api.bootstrap.mockReturnValueOnce(bootstrapFailure.promise);
    const unmountedFailure = renderHook(() => useDashboardState());
    await waitFor(() => {
      expect(unmountedFailure.result.current).not.toBeNull();
    });
    unmountedFailure.unmount();
    bootstrapFailure.reject(new Error('Unmounted bootstrap failure'));
    await Promise.resolve();

    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    configureApi(api);
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    const staleTemplateLoad = deferred<TargetTemplate>();
    api.getTargetTemplate.mockReset();
    api.getTargetTemplate.mockImplementationOnce(() => staleTemplateLoad.promise);
    api.getTargetTemplate.mockResolvedValueOnce(
      makeTemplate('http', 'replacement_http', 'Replacement HTTP', 'https://example.com'),
    );

    act(() => {
      void result.current.handleStartNewTarget('file');
    });
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });

    staleTemplateLoad.resolve(
      makeTemplate('file', 'stale_file', 'Stale file', '/tmp/dataarm/stale-file.html'),
    );
    await waitFor(() => {
      expect(result.current.editorMode).toBe('http');
      expect(result.current.draftToml).toContain('replacement_http');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'info',
        message: 'Started a new website watch draft.',
      });
    });

    api.getTargetTemplate.mockReset();
    api.getTargetTemplate.mockRejectedValueOnce(new Error('Current template failure'));
    await act(async () => {
      await result.current.handleStartNewTarget('file');
    });
    await waitFor(() => {
      expect(result.current.document.error).toBe('Current template failure');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Current template failure',
      });
    });

    const staleRejectedTemplate = deferred<TargetTemplate>();
    api.getTargetTemplate.mockReset();
    api.getTargetTemplate.mockImplementationOnce(() => staleRejectedTemplate.promise);
    api.getTargetTemplate.mockResolvedValueOnce(
      makeTemplate('http', 'replacement_again', 'Replacement again', 'https://example.com/again'),
    );

    act(() => {
      void result.current.handleStartNewTarget('file');
    });
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    staleRejectedTemplate.reject(new Error('Late stale template failure'));
    await waitFor(() => {
      expect(result.current.editorMode).toBe('http');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'info',
        message: 'Started a new website watch draft.',
      });
    });
  });

  it('protects unsaved work and manages template preview and reset flows', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDraftField('displayName', 'Alpha changed');
    });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    expect(confirm).toHaveBeenCalledWith('Discard the unsaved watch changes?');
    expect(api.getTargetTemplate).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await act(async () => {
      await result.current.handleStartNewTarget('file');
    });

    await waitFor(() => {
      expect(result.current.isDraftContext).toBe(true);
      expect(result.current.editorMode).toBe('file');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'info',
        message: 'Started a new local file watch draft.',
      });
    });

    act(() => {
      result.current.setDraftField('targetId', 'draft_file');
      result.current.setDraftField('displayName', 'Draft file');
      result.current.setDraftField('sourceLocator', '/tmp/dataarm/draft-file.html');
    });
    api.previewTarget.mockResolvedValueOnce(
      makePreview(
        'draft_file',
        'Draft file',
        makeDraftSession('file', 'draft_file', 'Draft file', '/tmp/dataarm/draft-file.html'),
      ),
    );
    await act(async () => {
      await result.current.handlePreview();
    });

    await waitFor(() => {
      expect(result.current.preview.data?.displayName).toBe('Draft file');
      expect(result.current.detailTab).toBe('changes');
      expect(result.current.artifactTab).toBe('preview');
      expect(result.current.dirty).toBe(true);
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Section check passed. You can save this watch now.',
      });
    });

    act(() => {
      result.current.setDraftField('displayName', 'Draft file renamed');
      result.current.handleResetDraft();
    });

    await waitFor(() => {
      expect(api.getTargetTemplate).toHaveBeenCalledWith('file');
      expect(result.current.dirty).toBe(false);
      expect(result.current.editorMode).toBe('file');
      expect(result.current.guidedDraft?.displayName).toBe('File watch');
    });

    act(() => {
      result.current.setDraftField('displayName', 'Unsaved file draft');
    });
    confirm.mockReturnValue(false);
    await act(async () => {
      await result.current.handleSelectTarget('alpha');
    });
    expect(confirm).toHaveBeenLastCalledWith('Discard the unsaved watch draft?');
  });

  it('surfaces bootstrap, document, preview, save, and delete failures', async () => {
    expect(errorMessage(new Error('Boom'))).toBe('Boom');
    expect(errorMessage('boom')).toBe('boom');

    api.bootstrap.mockRejectedValueOnce('Bootstrap exploded');
    const failedBootstrap = renderHook(() => useDashboardState());

    await waitFor(() => {
      expect(failedBootstrap.result.current).not.toBeNull();
      expect(failedBootstrap.result.current.workspace.error).toBe('Bootstrap exploded');
      expect(failedBootstrap.result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Bootstrap exploded',
      });
    });

    await act(async () => {
      await failedBootstrap.result.current.handleSave();
    });
    expect(failedBootstrap.result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Open a library before saving watches.',
    });
    await act(async () => {
      await failedBootstrap.result.current.handleOpenWorkspacePath();
      await failedBootstrap.result.current.handleRunWorkspace();
    });
    expect(api.openWorkspacePath).not.toHaveBeenCalled();
    expect(api.runWorkspace).not.toHaveBeenCalled();

    failedBootstrap.unmount();

    api.readTarget.mockRejectedValueOnce(new Error('Target load exploded'));
    const failedRead = renderHook(() => useDashboardState());

    await waitFor(() => {
      expect(failedRead.result.current.document.error).toBe('Target load exploded');
      expect(failedRead.result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Target load exploded',
      });
    });

    failedRead.unmount();

    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    configureApi(api);
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    api.previewTarget.mockRejectedValueOnce(new Error('Preview exploded'));
    await act(async () => {
      await result.current.handlePreview();
    });

    await waitFor(() => {
      expect(result.current.preview.error).toBe('Preview exploded');
      expect(result.current.detailTab).toBe('changes');
      expect(result.current.artifactTab).toBe('preview');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Preview exploded',
      });
    });

    api.previewTarget.mockResolvedValueOnce(
      makePreview(
        'alpha',
        'Alpha',
        makeDraftSession('file', 'alpha', 'Alpha', '/tmp/dataarm/demo.html'),
      ),
    );
    await act(async () => {
      await result.current.handlePreview();
    });
    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
      expect(result.current.detailTab).toBe('changes');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Section check passed. You can save this watch now.',
      });
    });

    api.saveTarget.mockRejectedValueOnce(new Error('Save exploded'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Save exploded',
    });
    expect(result.current.saving).toBe(false);

    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });
    expect(api.deleteTarget).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    api.deleteTarget.mockRejectedValueOnce(new Error('Delete exploded'));
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Delete exploded',
    });

    api.readTarget.mockRejectedValueOnce(new Error('Missing directory'));
    await act(async () => {
      await result.current.handleSelectTarget('missing-directory');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('missing-directory');
      expect(result.current.selectedTarget).toBeNull();
      expect(result.current.isDraftContext).toBe(false);
      expect(result.current.document.error).toBe('Missing directory');
    });
  });
});
