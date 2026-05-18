import {
  deleteTarget,
  getTargetTemplate,
  previewTarget,
  readTarget,
  refreshWorkspace,
  runTarget,
  runWorkspace,
  saveTarget,
} from '../lib/api';
import type {
  ActionFeedback,
  AsyncState,
  BatchRunResult,
  TargetDocumentRecord,
  TargetDraftSession,
  TargetPreview,
  TargetRunResult,
  TargetSummary,
  TargetTemplateKind,
  WorkspaceSnapshot,
  WorkspaceSummary,
} from '../types';
import {
  createFeedback,
  errorMessage,
  initialState,
  notificationFeedback,
  readRunOutcome,
} from './dashboardState.helpers';
import type { WorkspaceHydrationMode } from './dashboardState.workspace';

type Tone = ActionFeedback['tone'];
export type TargetDocumentLoadMode = 'replace_view' | 'refresh_view';

type EditorContext = {
  beginWorkspaceUpdate: () => number;
  isCurrentWorkspaceUpdate: (updateId: number) => boolean;
  beginDocumentLoad: () => number;
  isCurrentDocumentLoad: (loadId: number) => boolean;
  cancelDocumentLoad: () => void;
  setDocument: (state: AsyncState<TargetDocumentRecord>) => void;
  setDraftSession: (session: TargetDraftSession | null) => void;
  setDraftToml: (toml: string) => void;
  setDirty: (dirty: boolean) => void;
  setEditorMode: (mode: 'existing' | TargetTemplateKind) => void;
  setDetailTab: (tab: 'changes' | 'config' | 'artifacts') => void;
  setArtifactTab: (tab: 'preview' | 'run' | 'state' | 'batch') => void;
  clearInspector: () => void;
  primeEditorBaseline: (session: TargetDraftSession | null, toml: string) => void;
  applyEditorState: (
    session: TargetDraftSession | null,
    toml: string,
    options?: { clearInspector?: boolean },
  ) => void;
  setPreview: (state: AsyncState<TargetPreview>) => void;
  setLastRun: (state: AsyncState<TargetRunResult>) => void;
  setLastBatch: (state: AsyncState<BatchRunResult>) => void;
  setSaving: (saving: boolean) => void;
  setRunningTarget: (running: boolean) => void;
  setRunningWorkspace: (running: boolean) => void;
  setActionFeedback: (feedback: ActionFeedback | null) => void;
  setFeedback: (tone: Tone, message: string) => void;
  hydrateWorkspaceSnapshot: (
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
    hydrationMode: WorkspaceHydrationMode,
  ) => Promise<void>;
  draftSession: TargetDraftSession | null;
  draftToml: string;
  workspaceSummary: WorkspaceSummary | null;
  selectedDirectoryName: string | null;
  selectedTarget: TargetSummary | null;
  hasUnsavedWork: boolean;
  loadingTarget: boolean;
};

export async function loadTargetDocumentIntoState(
  context: EditorContext,
  directoryName: string,
  loadMode: TargetDocumentLoadMode = 'replace_view',
) {
  const replacingView = loadMode === 'replace_view';
  const loadId = context.beginDocumentLoad();
  context.setDocument(initialState());
  context.setDraftSession(null);
  context.setDraftToml('');
  context.setDirty(false);
  context.setEditorMode('existing');
  if (replacingView) {
    context.setDetailTab('changes');
    context.setArtifactTab('preview');
    context.clearInspector();
  }

  try {
    const record = await readTarget(directoryName);
    if (!context.isCurrentDocumentLoad(loadId)) {
      return;
    }
    context.setDocument({ loading: false, error: null, data: record });
    context.primeEditorBaseline(record.guidedSession, record.canonicalToml ?? record.rawToml);
    context.setEditorMode('existing');
  } catch (error) {
    if (!context.isCurrentDocumentLoad(loadId)) {
      return;
    }
    const message = errorMessage(error);
    context.setDocument({ loading: false, error: message, data: null });
    context.setFeedback('error', message);
  }
}

export async function loadNewTargetTemplateIntoState(
  context: EditorContext & { setSelectedDirectoryName: (directoryName: string | null) => void },
  kind: TargetTemplateKind,
) {
  const loadId = context.beginDocumentLoad();
  context.setSelectedDirectoryName(null);
  context.setEditorMode(kind);
  context.setDocument(initialState());
  context.setDraftSession(null);
  context.setDraftToml('');
  context.setDirty(false);
  context.setDetailTab('config');
  context.setArtifactTab('preview');
  context.clearInspector();

  try {
    const template = await getTargetTemplate(kind);
    if (!context.isCurrentDocumentLoad(loadId)) {
      return;
    }
    context.setDocument({ loading: false, error: null, data: null });
    context.primeEditorBaseline(template.draftSession, template.canonicalToml);
    context.setEditorMode(kind);
    context.setActionFeedback(createFeedback('info', `Loaded the ${kind} target template.`));
  } catch (error) {
    if (!context.isCurrentDocumentLoad(loadId)) {
      return;
    }
    const message = errorMessage(error);
    context.setDocument({ loading: false, error: message, data: null });
    context.setFeedback('error', message);
  }
}

export async function previewTargetIntoState(context: EditorContext) {
  if (context.loadingTarget) {
    return;
  }

  if (context.draftSession == null && !context.draftToml.trim()) {
    context.setFeedback('warning', 'The target document is empty.');
    return;
  }

  context.setPreview(initialState());

  try {
    const nextPreview = await previewTarget(
      context.draftSession
        ? { draftSession: context.draftSession }
        : { rawToml: context.draftToml },
    );
    context.setPreview({ loading: false, error: null, data: nextPreview });
    context.applyEditorState(nextPreview.draftSession, nextPreview.canonicalToml, {
      clearInspector: false,
    });
    context.setArtifactTab('preview');
    context.setDetailTab('changes');
    context.setFeedback('success', 'Preview refreshed from canonical FFHN runtime artifacts.');
  } catch (error) {
    const message = errorMessage(error);
    context.setPreview({ loading: false, error: message, data: null });
    context.setArtifactTab('preview');
    context.setDetailTab('changes');
    context.setFeedback('error', message);
  }
}

export async function saveTargetIntoState(context: EditorContext) {
  if (context.loadingTarget) {
    return;
  }
  if (!context.workspaceSummary) {
    context.setFeedback('error', 'Open a workspace before saving targets.');
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  context.setSaving(true);

  try {
    const result = await saveTarget(
      context.draftSession
        ? {
            previousDirectoryName: context.selectedDirectoryName,
            draftSession: context.draftSession,
          }
        : {
            previousDirectoryName: context.selectedDirectoryName,
            rawToml: context.draftToml,
          },
    );
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await context.hydrateWorkspaceSnapshot(result.workspace, result.directoryName, 'preserve_view');
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setDirty(false);
    context.setFeedback(
      'success',
      'Target saved. Baseline artifacts were reset for a clean next run.',
    );
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('error', errorMessage(error));
  } finally {
    context.setSaving(false);
  }
}

export async function deleteSelectedTargetFromState(context: EditorContext) {
  if (context.loadingTarget) {
    return;
  }
  if (!context.workspaceSummary || !context.selectedTarget) {
    return;
  }
  if (
    !window.confirm(
      `Delete ${context.selectedTarget.displayName ?? context.selectedTarget.directoryName}?`,
    )
  ) {
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  try {
    const snapshot = await deleteTarget(context.selectedTarget.directoryName);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await context.hydrateWorkspaceSnapshot(snapshot, context.selectedDirectoryName, 'reset_view');
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('success', 'Target deleted.');
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('error', errorMessage(error));
  }
}

export async function runSelectedTargetFromState(context: EditorContext) {
  if (context.loadingTarget) {
    return;
  }
  if (!context.workspaceSummary || !context.selectedTarget) {
    return;
  }
  if (context.hasUnsavedWork) {
    context.setFeedback('warning', 'Save or reset the draft before running the saved target.');
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  context.setRunningTarget(true);
  context.setLastRun(initialState());

  try {
    const result = await runTarget(context.selectedTarget.directoryName);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setLastRun({ loading: false, error: null, data: result });
    await context.hydrateWorkspaceSnapshot(result.workspace, result.directoryName, 'preserve_view');
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    if (result.notification?.deliveredChannels.includes('in_app')) {
      context.setActionFeedback(notificationFeedback(result.notification));
    } else {
      const outcome = readRunOutcome(result.runReport);
      context.setFeedback(
        outcome === 'changed' ? 'warning' : 'success',
        outcome ? `Run finished with outcome ${outcome}.` : 'Run finished.',
      );
    }
  } catch (error) {
    const message = errorMessage(error);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setLastRun({ loading: false, error: message, data: null });
    try {
      const snapshot = await refreshWorkspace();
      if (!context.isCurrentWorkspaceUpdate(updateId)) {
        return;
      }
      await context.hydrateWorkspaceSnapshot(
        snapshot,
        context.selectedTarget.directoryName,
        'preserve_view',
      );
    } catch {
      // Preserve the original run failure if workspace refresh also fails.
    }
    context.setFeedback('error', message);
  } finally {
    context.setRunningTarget(false);
  }
}

export async function runWorkspaceFromState(context: EditorContext) {
  if (context.loadingTarget) {
    return;
  }
  if (!context.workspaceSummary) {
    return;
  }
  if (context.hasUnsavedWork) {
    context.setFeedback('warning', 'Save or reset the draft before running the workspace.');
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  context.setRunningWorkspace(true);
  context.setLastBatch(initialState());

  try {
    const result = await runWorkspace();
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setLastBatch({ loading: false, error: null, data: result });
    await context.hydrateWorkspaceSnapshot(
      result.workspace,
      context.selectedTarget?.directoryName ?? null,
      'preserve_view',
    );
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    if (result.notification?.deliveredChannels.includes('in_app')) {
      context.setActionFeedback(notificationFeedback(result.notification));
    } else {
      context.setFeedback('success', 'Workspace batch run finished.');
    }
  } catch (error) {
    const message = errorMessage(error);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setLastBatch({ loading: false, error: message, data: null });
    try {
      const snapshot = await refreshWorkspace();
      if (!context.isCurrentWorkspaceUpdate(updateId)) {
        return;
      }
      await context.hydrateWorkspaceSnapshot(
        snapshot,
        context.selectedTarget?.directoryName ?? null,
        'preserve_view',
      );
    } catch {
      // Preserve the original batch-run failure if workspace refresh also fails.
    }
    context.setFeedback('error', message);
  } finally {
    context.setRunningWorkspace(false);
  }
}
