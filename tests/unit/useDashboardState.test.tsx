import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { errorMessage, useDashboardState } from '../../src/hooks/useDashboardState';
import type {
  BatchRunResult,
  DesktopBootstrap,
  NotificationSettings,
  TargetDraftSession,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetRunResult,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../../src/types';
import {
  makeDocument,
  makeNotificationCenter,
  makeNotificationRecord,
  makeTarget,
  makeWorkspaceSnapshot,
} from './fixtures';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn<() => Promise<DesktopBootstrap>>(),
  clearNotificationFeed: vi.fn<() => Promise<WorkspaceSnapshot>>(),
  createWorkspace: vi.fn<(workspacePath: string) => Promise<WorkspaceSnapshot>>(),
  deleteTarget: vi.fn<(directoryName: string) => Promise<WorkspaceSnapshot>>(),
  getTargetTemplate: vi.fn<(kind: TargetTemplateKind) => Promise<TargetTemplate>>(),
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
        draftSession?: TargetDraftSession | null;
        rawToml?: string | null;
      }) => Promise<TargetMutationResult>
    >(),
  updateNotificationSettings:
    vi.fn<(settings: NotificationSettings) => Promise<WorkspaceSnapshot>>(),
}));

vi.mock('../../src/lib/api', () => api);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

function targetToml(
  targetId: string,
  displayName: string,
  extras = '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/demo.html"\n',
) {
  return `schema_name = "ffhn.target"\ntarget_id = "${targetId}"\ndisplay_name = "${displayName}"\n${extras}`;
}

function makeDraftSession(
  kind: TargetTemplateKind,
  targetId: string,
  displayName: string,
  sourceLocator: string,
): TargetDraftSession {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }
  const base = document.guidedSession;
  return {
    contractSeed: {},
    draft: {
      ...base.draft,
      kind,
      targetId,
      displayName,
      sourceLocator,
      fetchMethod: kind === 'http' ? 'GET' : null,
      fetchTimeoutMs: kind === 'http' ? 15000 : null,
      fetchUserAgent: kind === 'http' ? 'dataarm/template' : null,
      fetchFollowRedirects: kind === 'http' ? true : null,
      fetchAccept: kind === 'http' ? 'text/html,application/xhtml+xml' : null,
    },
  };
}

function makeTemplate(
  kind: TargetTemplateKind,
  targetId: string,
  displayName: string,
  sourceLocator: string,
): TargetTemplate {
  return {
    kind,
    draftSession: makeDraftSession(kind, targetId, displayName, sourceLocator),
    canonicalToml: targetToml(
      targetId,
      displayName,
      kind === 'http'
        ? `[target]\nkind = "http"\nsource_url = "${sourceLocator}"\n`
        : `[target]\nkind = "file"\nfile_path = "${sourceLocator}"\n`,
    ),
  };
}

function makePreview(
  targetId: string,
  displayName: string,
  draftSession: TargetDraftSession,
): TargetPreview {
  return {
    targetId,
    displayName,
    canonicalToml: `${targetToml(targetId, displayName).trim()}\n`,
    draftSession,
    statusReport: { schema_name: 'ffhn.status_report' },
    dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'initialized' } },
    previewSnapshot: null,
    previewArtifactIssues: [],
  };
}

function makeWorkspace(
  targets = [
    makeTarget({
      directoryName: 'alpha',
      targetId: 'alpha',
      displayName: 'Alpha',
      lastRunOutcome: 'unchanged',
      statusKind: 'ready',
    }),
    makeTarget({
      directoryName: 'bravo',
      targetId: 'bravo',
      displayName: 'Bravo',
      lastRunOutcome: 'changed',
      statusKind: 'changed',
    }),
    makeTarget({
      directoryName: 'charlie',
      targetId: 'charlie',
      displayName: 'Charlie',
      lastRunOutcome: null,
      statusKind: 'pending',
    }),
    makeTarget({
      directoryName: 'delta',
      targetId: 'delta',
      displayName: 'Delta',
      lastRunOutcome: null,
      statusKind: 'failed_transient',
      errorMessage: 'Target unavailable',
    }),
  ],
  notificationCenter = makeNotificationCenter(),
): WorkspaceSnapshot {
  return makeWorkspaceSnapshot({
    summary: {
      workspaceName: 'demo-watch-root',
      workspacePath: '/tmp/dataarm/demo-watch-root',
      workspaceSource: 'demo',
      targetCount: targets.length,
      runnableTargetCount: targets.filter((target) => target.runnableTargetId != null).length,
      issueCount: targets.filter((target) => target.errorMessage != null).length,
      lastRunCount: targets.filter((target) => target.lastRunAt != null).length,
    },
    notificationCenter,
    targets,
  });
}

function makeBootstrap(workspace: WorkspaceSnapshot): DesktopBootstrap {
  return {
    app: {
      appName: 'Dataarm',
      appVersion: '0.1.0',
      runtimeContract: 'embedded-ffhn-core',
    },
    workspace,
  };
}

function makeDocumentMap() {
  return new Map<string, TargetDocumentRecord>([
    [
      'alpha',
      makeDocument({
        directoryName: 'alpha',
        targetId: 'alpha',
        displayName: 'Alpha',
        rawToml: targetToml('alpha', 'Alpha'),
        canonicalToml: targetToml('alpha', 'Alpha'),
        guidedSession: makeDraftSession('file', 'alpha', 'Alpha', '/tmp/dataarm/demo.html'),
      }),
    ],
    [
      'bravo',
      makeDocument({
        directoryName: 'bravo',
        targetId: 'bravo',
        displayName: 'Bravo',
        rawToml: targetToml('bravo', 'Bravo'),
        canonicalToml: targetToml('bravo', 'Bravo'),
        guidedSession: makeDraftSession('file', 'bravo', 'Bravo', '/tmp/dataarm/demo.html'),
      }),
    ],
    [
      'charlie',
      makeDocument({
        directoryName: 'charlie',
        targetId: 'charlie',
        displayName: 'Charlie',
        rawToml: targetToml('charlie', 'Charlie'),
        canonicalToml: targetToml('charlie', 'Charlie'),
        guidedSession: makeDraftSession('file', 'charlie', 'Charlie', '/tmp/dataarm/demo.html'),
      }),
    ],
  ]);
}

function configureApi(workspace = makeWorkspace()) {
  const documents = makeDocumentMap();
  const defaultBootstrap = makeBootstrap(workspace);

  api.bootstrap.mockResolvedValue(defaultBootstrap);
  api.readTarget.mockImplementation((directoryName) => {
    const document = documents.get(directoryName);
    if (!document) {
      throw new Error(`Unknown mock target ${directoryName}`);
    }
    return Promise.resolve(document);
  });
  api.getTargetTemplate.mockImplementation((kind) =>
    Promise.resolve(
      kind === 'http'
        ? makeTemplate('http', 'website_watch', 'Website watch', 'https://example.com')
        : makeTemplate('file', 'file_watch', 'File watch', '/tmp/dataarm/demo.html'),
    ),
  );
  api.previewTarget.mockResolvedValue(
    makePreview(
      'website_watch',
      'Website watch',
      makeDraftSession('http', 'website_watch', 'Website watch', 'https://example.com'),
    ),
  );
  api.saveTarget.mockResolvedValue({
    directoryName: 'saved-target',
    workspace: makeWorkspace([
      makeTarget({
        directoryName: 'saved-target',
        targetId: 'saved-target',
        displayName: 'Saved target',
        lastRunOutcome: null,
        statusKind: 'pending',
      }),
    ]),
  });
  api.deleteTarget.mockResolvedValue(makeWorkspace([]));
  api.runTarget.mockResolvedValue({
    workspace,
    directoryName: 'alpha',
    statusReport: { schema_name: 'ffhn.status_report' },
    runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'changed' } },
    notification: null,
  });
  api.runWorkspace.mockResolvedValue({
    workspace,
    batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
    skippedDirectories: [],
    notification: null,
  });
  api.openWorkspacePath.mockResolvedValue(undefined);
  api.openTargetPath.mockResolvedValue(undefined);
  api.openWorkspace.mockResolvedValue(workspace);
  api.createWorkspace.mockResolvedValue(makeWorkspace([]));
  api.updateNotificationSettings.mockResolvedValue(
    makeWorkspace(workspace.targets, makeNotificationCenter()),
  );
  api.clearNotificationFeed.mockResolvedValue(
    makeWorkspace(workspace.targets, makeNotificationCenter({ items: [] })),
  );

  return { documents, workspace };
}

async function waitForLoadedState(result: { current: ReturnType<typeof useDashboardState> }) {
  await waitFor(() => {
    expect(result.current).not.toBeNull();
    expect(result.current.workspace.loading).toBe(false);
    expect(result.current.selectedDirectoryName).not.toBeNull();
    expect(result.current.document.loading).toBe(false);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useDashboardState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    configureApi();
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

    configureApi();
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
        message: 'Loaded the http target template.',
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
        message: 'Loaded the http target template.',
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
    expect(confirm).toHaveBeenCalledWith('Discard the unsaved target changes?');
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
        message: 'Loaded the file target template.',
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
        message: 'Preview refreshed from canonical FFHN runtime artifacts.',
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
    expect(confirm).toHaveBeenLastCalledWith('Discard the unsaved target draft?');
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
      message: 'Open a workspace before saving targets.',
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

    configureApi();
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
        message: 'Preview refreshed from canonical FFHN runtime artifacts.',
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

  it('saves and deletes targets and clears editor state for empty workspaces', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    const savedWorkspace = makeWorkspace([
      makeTarget({
        directoryName: 'saved-target',
        targetId: 'saved-target',
        displayName: 'Saved target',
        statusKind: 'pending',
        lastRunOutcome: null,
      }),
    ]);

    api.saveTarget.mockResolvedValueOnce({
      directoryName: 'saved-target',
      workspace: savedWorkspace,
    });
    api.readTarget.mockImplementation((directoryName) => {
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
        message: 'Target saved. Baseline artifacts were reset for a clean next run.',
      });
    });

    api.deleteTarget.mockResolvedValueOnce(makeWorkspace([]));
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });

    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBeNull();
      expect(result.current.document.data).toBeNull();
      expect(result.current.draftToml).toBe('');
      expect(result.current.preview.data).toBeNull();
      expect(result.current.lastRun.data).toBeNull();
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'success',
        message: 'Target deleted.',
      });
    });

    api.openWorkspace.mockResolvedValueOnce(
      makeWorkspace([
        makeTarget({
          directoryName: 'nameless',
          targetId: 'nameless',
          displayName: null,
        }),
      ]),
    );
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/nameless');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('nameless');
    });

    api.deleteTarget.mockResolvedValueOnce(makeWorkspace([]));
    await act(async () => {
      await result.current.handleDeleteSelectedTarget();
    });
    expect(confirm).toHaveBeenLastCalledWith('Delete nameless?');
  });

  it('blocks actions while workspace and document transitions are in flight', async () => {
    const openWorkspaceLoad = deferred<WorkspaceSnapshot>();
    const readTargetLoad = deferred<TargetDocumentRecord>();

    api.openWorkspace.mockReturnValueOnce(openWorkspaceLoad.promise);
    api.readTarget.mockImplementation(async (directoryName) => {
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

  it('runs targets and workspaces across notification, feedback, and recovery branches', async () => {
    const workspace = makeWorkspace();
    const refreshWorkspace = makeWorkspace([
      makeTarget({
        directoryName: 'alpha',
        targetId: 'alpha',
        displayName: 'Alpha',
        statusKind: 'ready',
        lastRunOutcome: 'changed',
      }),
    ]);

    api.refreshWorkspace.mockResolvedValue(refreshWorkspace);
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDraftField('displayName', 'Alpha dirty');
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Save or reset the draft before running the saved target.',
    });

    act(() => {
      result.current.handleResetDraft();
    });
    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'changed' } },
      notification: makeNotificationRecord({
        title: 'Target change detected.',
        deliveredChannels: ['in_app'],
      }),
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Target change detected.',
    });

    act(() => {
      result.current.setActionFeedback(null);
    });
    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'changed' } },
      notification: {
        ...makeNotificationRecord(),
        deliveredChannels: ['system'],
      },
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Run finished with outcome changed.',
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: null,
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Run finished.',
    });

    api.runTarget.mockReset();
    api.runTarget.mockRejectedValueOnce(new Error('Run exploded'));
    api.refreshWorkspace.mockRejectedValueOnce(new Error('Refresh exploded'));
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    await waitFor(() => {
      expect(result.current.lastRun.error).toBe('Run exploded');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Run exploded',
      });
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'changed' } },
      notification: null,
    });
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
      await result.current.handleDeleteSelectedTarget();
      await result.current.handleOpenSelectedTargetPath();
    });
    expect(api.deleteTarget).toHaveBeenCalledTimes(0);

    api.openWorkspace.mockResolvedValueOnce(workspace);
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/back-to-workspace');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });

    api.runTarget.mockReset();
    api.runTarget.mockRejectedValueOnce(new Error('Recovered run failure'));
    api.refreshWorkspace.mockResolvedValueOnce(refreshWorkspace);
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    await waitFor(() => {
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Recovered run failure',
      });
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });

    act(() => {
      result.current.setDraftField('displayName', 'Alpha workspace dirty');
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Save or reset the draft before running the workspace.',
    });

    act(() => {
      result.current.handleResetDraft();
    });
    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace,
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: makeNotificationRecord({
        scopeKind: 'workspace_run',
        title: 'Workspace changed targets.',
        targetDisplayName: null,
        deliveredChannels: ['in_app'],
      }),
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Workspace changed targets.',
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace,
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

    api.refreshWorkspace.mockRejectedValueOnce(new Error('Refresh exploded'));
    api.runWorkspace.mockRejectedValueOnce(new Error('Workspace run exploded'));
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.lastBatch.error).toBe('Workspace run exploded');
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Workspace run exploded',
    });

    api.runWorkspace.mockRejectedValueOnce(new Error('Workspace recovered failure'));
    api.refreshWorkspace.mockResolvedValueOnce(refreshWorkspace);
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    await waitFor(() => {
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Workspace recovered failure',
      });
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });
  });

  it('switches workspaces, manages notification settings, and handles path actions', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    const emptyWorkspace = makeWorkspace([]);
    const reopenedWorkspace = makeWorkspace([
      makeTarget({
        directoryName: 'zeta',
        targetId: 'zeta',
        displayName: 'Zeta',
        statusKind: 'ready',
      }),
    ]);

    api.readTarget.mockImplementation((directoryName) =>
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
      makeWorkspace(
        reopenedWorkspace.targets,
        makeNotificationCenter({
          settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
          permissionState: 'prompt',
        }),
      ),
    );
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspace(
        reopenedWorkspace.targets,
        makeNotificationCenter({
          settings: { notifyWhen: 'off', delivery: 'in_app' },
          permissionState: 'granted',
        }),
      ),
    );
    api.updateNotificationSettings.mockRejectedValueOnce(new Error('Notification update exploded'));
    api.clearNotificationFeed.mockResolvedValueOnce(
      makeWorkspace(
        reopenedWorkspace.targets,
        makeNotificationCenter({
          items: [],
        }),
      ),
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
      makeWorkspace(
        reopenedWorkspace.targets,
        makeNotificationCenter({
          items: [],
        }),
      ),
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
