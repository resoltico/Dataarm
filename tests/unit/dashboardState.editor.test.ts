import type {
  TargetDocumentRecord,
  TargetPreview,
  TargetRunResult,
  TargetTemplate,
} from '../../src/types';
import {
  deleteSelectedTargetFromState,
  loadNewTargetTemplateIntoState,
  loadTargetDocumentIntoState,
  previewTargetIntoState,
  runSelectedTargetFromState,
  runWorkspaceFromState,
  saveTargetIntoState,
} from '../../src/hooks/dashboardState.editor';
import {
  makeDocument,
  makeNotificationRecord,
  makeTarget,
  makeWorkspaceSnapshot,
} from './fixtures';

const api = vi.hoisted(() => ({
  deleteTarget: vi.fn(),
  getTargetTemplate: vi.fn(),
  previewTarget: vi.fn(),
  readTarget: vi.fn(),
  refreshWorkspace: vi.fn(),
  runTarget: vi.fn(),
  runWorkspace: vi.fn(),
  saveTarget: vi.fn(),
}));

vi.mock('../../src/lib/api', () => api);

function makeEditorContext(
  overrides: Partial<{
    beginWorkspaceUpdate: () => number;
    isCurrentWorkspaceUpdate: (updateId: number) => boolean;
    beginDocumentLoad: () => number;
    isCurrentDocumentLoad: (loadId: number) => boolean;
    cancelDocumentLoad: () => void;
    setDocument: (state: unknown) => void;
    setDraftSession: (session: unknown) => void;
    setDraftToml: (toml: string) => void;
    setDirty: (dirty: boolean) => void;
    setEditorMode: (mode: string) => void;
    setDetailTab: (tab: string) => void;
    setArtifactTab: (tab: string) => void;
    clearInspector: () => void;
    primeEditorBaseline: (session: unknown, toml: string) => void;
    applyEditorState: (session: unknown, toml: string, options?: unknown) => void;
    setPreview: (state: unknown) => void;
    setLastRun: (state: unknown) => void;
    setLastBatch: (state: unknown) => void;
    setSaving: (saving: boolean) => void;
    setRunningTarget: (running: boolean) => void;
    setRunningWorkspace: (running: boolean) => void;
    setActionFeedback: (feedback: unknown) => void;
    setFeedback: (tone: string, message: string) => void;
    hydrateWorkspaceSnapshot: (
      snapshot: unknown,
      preferred: string | null,
      hydrationMode: string,
    ) => Promise<void>;
    draftSession: TargetDocumentRecord['guidedSession'];
    draftToml: string;
    workspaceSummary: ReturnType<typeof makeWorkspaceSnapshot>['summary'] | null;
    selectedDirectoryName: string | null;
    selectedTarget: ReturnType<typeof makeTarget> | null;
    hasUnsavedWork: boolean;
    loadingTarget: boolean;
    setSelectedDirectoryName: (directoryName: string | null) => void;
  }> = {},
) {
  const document = makeDocument();
  return {
    beginWorkspaceUpdate: vi.fn(() => 1),
    isCurrentWorkspaceUpdate: vi.fn(() => true),
    beginDocumentLoad: vi.fn(() => 1),
    isCurrentDocumentLoad: vi.fn(() => true),
    cancelDocumentLoad: vi.fn(),
    setDocument: vi.fn(),
    setDraftSession: vi.fn(),
    setDraftToml: vi.fn(),
    setDirty: vi.fn(),
    setEditorMode: vi.fn(),
    setDetailTab: vi.fn(),
    setArtifactTab: vi.fn(),
    clearInspector: vi.fn(),
    primeEditorBaseline: vi.fn(),
    applyEditorState: vi.fn(),
    setPreview: vi.fn(),
    setLastRun: vi.fn(),
    setLastBatch: vi.fn(),
    setSaving: vi.fn(),
    setRunningTarget: vi.fn(),
    setRunningWorkspace: vi.fn(),
    setActionFeedback: vi.fn(),
    setFeedback: vi.fn(),
    hydrateWorkspaceSnapshot: vi.fn(async () => {}),
    draftSession: document.guidedSession,
    draftToml: document.rawToml,
    workspaceSummary: makeWorkspaceSnapshot().summary,
    selectedDirectoryName: 'demo_status_board',
    selectedTarget: makeTarget(),
    hasUnsavedWork: false,
    loadingTarget: false,
    setSelectedDirectoryName: vi.fn(),
    ...overrides,
  };
}

function makePreviewResult(): TargetPreview {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected a guided session in the preview fixture.');
  }
  return {
    targetId: 'release_notes',
    displayName: 'Release notes',
    canonicalToml: 'target_id = "release_notes"\n',
    draftSession: document.guidedSession,
    statusReport: { schema_name: 'ffhn.status_report' },
    dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
    previewSnapshot: document.artifactHistory?.currentSnapshot ?? null,
    previewArtifactIssues: [],
  };
}

function makeRunResult(overrides: Partial<TargetRunResult> = {}): TargetRunResult {
  return {
    workspace: makeWorkspaceSnapshot(),
    directoryName: 'demo_status_board',
    statusReport: { schema_name: 'ffhn.status_report' },
    runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
    notification: null,
    ...overrides,
  };
}

describe('dashboardState.editor', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads saved targets and guided templates while ignoring superseded document work', async () => {
    const record = makeDocument();
    const context = makeEditorContext();
    api.readTarget.mockResolvedValueOnce(record);

    await loadTargetDocumentIntoState(context, 'release_notes');
    expect(api.readTarget).toHaveBeenCalledWith('release_notes');
    expect(context.primeEditorBaseline).toHaveBeenCalledWith(
      record.guidedSession,
      record.canonicalToml,
    );

    const staleLoadContext = makeEditorContext({
      isCurrentDocumentLoad: vi.fn(() => false),
    });
    api.readTarget.mockResolvedValueOnce(record);
    await loadTargetDocumentIntoState(staleLoadContext, 'stale_target');
    expect(staleLoadContext.primeEditorBaseline).not.toHaveBeenCalled();

    const failingLoadContext = makeEditorContext();
    api.readTarget.mockRejectedValueOnce(new Error('Read exploded'));
    await loadTargetDocumentIntoState(failingLoadContext, 'broken');
    expect(failingLoadContext.setFeedback).toHaveBeenCalledWith('error', 'Read exploded');

    const document = makeDocument();
    if (!document.guidedSession) {
      throw new Error('Expected the template fixture to include a guided session.');
    }
    const template: TargetTemplate = {
      kind: 'file',
      draftSession: document.guidedSession,
      canonicalToml: 'target_id = "template"\n',
    };
    const templateContext = makeEditorContext();
    api.getTargetTemplate.mockResolvedValueOnce(template);
    await loadNewTargetTemplateIntoState(templateContext, 'file');
    expect(templateContext.setSelectedDirectoryName).toHaveBeenCalledWith(null);
    expect(templateContext.primeEditorBaseline).toHaveBeenCalledWith(
      template.draftSession,
      template.canonicalToml,
    );

    const staleTemplateContext = makeEditorContext({
      isCurrentDocumentLoad: vi.fn(() => false),
    });
    api.getTargetTemplate.mockResolvedValueOnce(template);
    await loadNewTargetTemplateIntoState(staleTemplateContext, 'http');
    expect(staleTemplateContext.primeEditorBaseline).not.toHaveBeenCalled();

    const failingTemplateContext = makeEditorContext();
    api.getTargetTemplate.mockRejectedValueOnce(new Error('Template exploded'));
    await loadNewTargetTemplateIntoState(failingTemplateContext, 'http');
    expect(failingTemplateContext.setFeedback).toHaveBeenCalledWith('error', 'Template exploded');
  });

  it('previews guided and repair drafts and reports preview failures', async () => {
    const loadingContext = makeEditorContext({ loadingTarget: true });
    await previewTargetIntoState(loadingContext);
    expect(api.previewTarget).not.toHaveBeenCalled();

    const emptyContext = makeEditorContext({
      draftSession: null,
      draftToml: '   ',
    });
    await previewTargetIntoState(emptyContext);
    expect(emptyContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'The target document is empty.',
    );

    const previewResult = makePreviewResult();
    const guidedContext = makeEditorContext();
    api.previewTarget.mockResolvedValueOnce(previewResult);
    await previewTargetIntoState(guidedContext);
    expect(api.previewTarget).toHaveBeenCalledWith({ draftSession: guidedContext.draftSession });
    expect(guidedContext.applyEditorState).toHaveBeenCalledWith(
      previewResult.draftSession,
      previewResult.canonicalToml,
      { clearInspector: false },
    );
    expect(guidedContext.setFeedback).toHaveBeenCalledWith(
      'success',
      'Preview refreshed from canonical FFHN runtime artifacts.',
    );

    const repairContext = makeEditorContext({
      draftSession: null,
      draftToml: 'target_id = "repair"\n',
    });
    api.previewTarget.mockResolvedValueOnce(previewResult);
    await previewTargetIntoState(repairContext);
    expect(api.previewTarget).toHaveBeenCalledWith({ rawToml: 'target_id = "repair"\n' });

    const failingPreviewContext = makeEditorContext();
    api.previewTarget.mockRejectedValueOnce(new Error('Preview exploded'));
    await previewTargetIntoState(failingPreviewContext);
    expect(failingPreviewContext.setPreview).toHaveBeenLastCalledWith({
      loading: false,
      error: 'Preview exploded',
      data: null,
    });
    expect(failingPreviewContext.setFeedback).toHaveBeenCalledWith('error', 'Preview exploded');
  });

  it('saves and deletes targets with clean stale-update handling', async () => {
    const noWorkspaceContext = makeEditorContext({ workspaceSummary: null });
    await saveTargetIntoState(noWorkspaceContext);
    expect(noWorkspaceContext.setFeedback).toHaveBeenCalledWith(
      'error',
      'Open a workspace before saving targets.',
    );

    const saveResult = {
      workspace: makeWorkspaceSnapshot(),
      directoryName: 'release_notes',
    };
    const saveContext = makeEditorContext();
    api.saveTarget.mockResolvedValueOnce(saveResult);
    await saveTargetIntoState(saveContext);
    expect(saveContext.hydrateWorkspaceSnapshot).toHaveBeenCalledWith(
      saveResult.workspace,
      'release_notes',
      'preserve_view',
    );
    expect(saveContext.setDirty).toHaveBeenCalledWith(false);

    const rawTomlContext = makeEditorContext({
      draftSession: null,
      draftToml: 'target_id = "repair"\n',
    });
    api.saveTarget.mockResolvedValueOnce(saveResult);
    await saveTargetIntoState(rawTomlContext);
    expect(api.saveTarget).toHaveBeenCalledWith({
      previousDirectoryName: 'demo_status_board',
      rawToml: 'target_id = "repair"\n',
    });

    const staleSaveContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.saveTarget.mockResolvedValueOnce(saveResult);
    await saveTargetIntoState(staleSaveContext);
    expect(staleSaveContext.hydrateWorkspaceSnapshot).not.toHaveBeenCalled();
    expect(staleSaveContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.saveTarget.mockResolvedValueOnce(saveResult);
    await saveTargetIntoState(staleAfterHydrateContext);
    expect(staleAfterHydrateContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedSaveContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.saveTarget.mockRejectedValueOnce(new Error('Late save failure'));
    await saveTargetIntoState(staleRejectedSaveContext);
    expect(staleRejectedSaveContext.setFeedback).not.toHaveBeenCalled();

    const failingSaveContext = makeEditorContext();
    api.saveTarget.mockRejectedValueOnce(new Error('Save exploded'));
    await saveTargetIntoState(failingSaveContext);
    expect(failingSaveContext.setFeedback).toHaveBeenCalledWith('error', 'Save exploded');

    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const blockedDeleteContext = makeEditorContext();
    await deleteSelectedTargetFromState(blockedDeleteContext);
    expect(api.deleteTarget).not.toHaveBeenCalled();

    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const deleteContext = makeEditorContext();
    api.deleteTarget.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await deleteSelectedTargetFromState(deleteContext);
    expect(deleteContext.setFeedback).toHaveBeenCalledWith('success', 'Target deleted.');

    const staleDeleteSuccessContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.deleteTarget.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await deleteSelectedTargetFromState(staleDeleteSuccessContext);
    expect(staleDeleteSuccessContext.hydrateWorkspaceSnapshot).not.toHaveBeenCalled();
    expect(staleDeleteSuccessContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateDeleteContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.deleteTarget.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await deleteSelectedTargetFromState(staleAfterHydrateDeleteContext);
    expect(staleAfterHydrateDeleteContext.setFeedback).not.toHaveBeenCalled();

    const staleDeleteContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.deleteTarget.mockRejectedValueOnce(new Error('Late delete failure'));
    await deleteSelectedTargetFromState(staleDeleteContext);
    expect(staleDeleteContext.setFeedback).not.toHaveBeenCalled();
  });

  it('runs targets and workspaces across notification, outcome, refresh, and stale branches', async () => {
    const blockedTargetContext = makeEditorContext({ hasUnsavedWork: true });
    await runSelectedTargetFromState(blockedTargetContext);
    expect(blockedTargetContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'Save or reset the draft before running the saved target.',
    );

    const notifiedRunContext = makeEditorContext();
    api.runTarget.mockResolvedValueOnce(
      makeRunResult({
        notification: makeNotificationRecord({
          deliveredChannels: ['in_app'],
        }),
      }),
    );
    await runSelectedTargetFromState(notifiedRunContext);
    expect(notifiedRunContext.setActionFeedback).toHaveBeenCalled();

    const outcomeRunContext = makeEditorContext();
    api.runTarget.mockResolvedValueOnce(
      makeRunResult({
        notification: null,
        runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
      }),
    );
    await runSelectedTargetFromState(outcomeRunContext);
    expect(outcomeRunContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'Run finished with outcome changed.',
    );

    const staleRunContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.runTarget.mockResolvedValueOnce(makeRunResult());
    await runSelectedTargetFromState(staleRunContext);
    expect(staleRunContext.setLastRun).toHaveBeenNthCalledWith(1, {
      loading: true,
      error: null,
      data: null,
    });
    expect(staleRunContext.setLastRun).toHaveBeenCalledTimes(1);

    const staleAfterHydrateRunContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.runTarget.mockResolvedValueOnce(makeRunResult());
    await runSelectedTargetFromState(staleAfterHydrateRunContext);
    expect(staleAfterHydrateRunContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedRunContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.runTarget.mockRejectedValueOnce(new Error('Late run failure'));
    await runSelectedTargetFromState(staleRejectedRunContext);
    expect(staleRejectedRunContext.setFeedback).not.toHaveBeenCalled();

    const failingRunContext = makeEditorContext();
    api.runTarget.mockRejectedValueOnce(new Error('Run exploded'));
    api.refreshWorkspace.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await runSelectedTargetFromState(failingRunContext);
    expect(failingRunContext.setLastRun).toHaveBeenLastCalledWith({
      loading: false,
      error: 'Run exploded',
      data: null,
    });
    expect(failingRunContext.hydrateWorkspaceSnapshot).toHaveBeenCalled();
    expect(failingRunContext.setFeedback).toHaveBeenCalledWith('error', 'Run exploded');

    const staleRefreshRunContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.runTarget.mockRejectedValueOnce(new Error('Run stale'));
    api.refreshWorkspace.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await runSelectedTargetFromState(staleRefreshRunContext);
    expect(staleRefreshRunContext.setFeedback).not.toHaveBeenCalled();

    const batchBlockedContext = makeEditorContext({ hasUnsavedWork: true });
    await runWorkspaceFromState(batchBlockedContext);
    expect(batchBlockedContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'Save or reset the draft before running the workspace.',
    );

    const batchNotifiedContext = makeEditorContext();
    api.runWorkspace.mockResolvedValueOnce({
      workspace: makeWorkspaceSnapshot(),
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: makeNotificationRecord({
        deliveredChannels: ['in_app'],
      }),
    });
    await runWorkspaceFromState(batchNotifiedContext);
    expect(batchNotifiedContext.setActionFeedback).toHaveBeenCalled();

    const batchOutcomeContext = makeEditorContext();
    api.runWorkspace.mockResolvedValueOnce({
      workspace: makeWorkspaceSnapshot(),
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });
    await runWorkspaceFromState(batchOutcomeContext);
    expect(batchOutcomeContext.setFeedback).toHaveBeenCalledWith(
      'success',
      'Workspace batch run finished.',
    );

    const staleAfterHydrateBatchContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.runWorkspace.mockResolvedValueOnce({
      workspace: makeWorkspaceSnapshot(),
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });
    await runWorkspaceFromState(staleAfterHydrateBatchContext);
    expect(staleAfterHydrateBatchContext.setFeedback).not.toHaveBeenCalled();

    const staleBatchContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.runWorkspace.mockResolvedValueOnce({
      workspace: makeWorkspaceSnapshot(),
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });
    await runWorkspaceFromState(staleBatchContext);
    expect(staleBatchContext.setLastBatch).toHaveBeenNthCalledWith(1, {
      loading: true,
      error: null,
      data: null,
    });
    expect(staleBatchContext.setLastBatch).toHaveBeenCalledTimes(1);

    const failingBatchContext = makeEditorContext();
    api.runWorkspace.mockRejectedValueOnce(new Error('Batch exploded'));
    api.refreshWorkspace.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await runWorkspaceFromState(failingBatchContext);
    expect(failingBatchContext.setLastBatch).toHaveBeenLastCalledWith({
      loading: false,
      error: 'Batch exploded',
      data: null,
    });
    expect(failingBatchContext.setFeedback).toHaveBeenCalledWith('error', 'Batch exploded');

    const staleFailingBatchContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.runWorkspace.mockRejectedValueOnce(new Error('Late batch failure'));
    await runWorkspaceFromState(staleFailingBatchContext);
    expect(staleFailingBatchContext.setFeedback).not.toHaveBeenCalled();

    const staleRefreshBatchContext = makeEditorContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.runWorkspace.mockRejectedValueOnce(new Error('Batch stale after refresh'));
    api.refreshWorkspace.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await runWorkspaceFromState(staleRefreshBatchContext);
    expect(staleRefreshBatchContext.setFeedback).not.toHaveBeenCalled();
  });
});
