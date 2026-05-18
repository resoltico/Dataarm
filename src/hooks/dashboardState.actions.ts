import { openTargetPath } from '../lib/api';
import type {
  NotificationSettings,
  TargetDraft,
  TargetDraftCanonicalizer,
  TargetSummary,
  TargetTemplateKind,
  WorkspaceSnapshot,
  WorkspaceSummary,
} from '../types';
import {
  errorMessage,
  normalizeDraftForKind,
  normalizeDraftForSelectionKind,
} from './dashboardState.helpers';
import {
  deleteSelectedTargetFromState,
  loadNewTargetTemplateIntoState,
  loadTargetDocumentIntoState,
  previewTargetIntoState,
  runSelectedTargetFromState,
  runWorkspaceFromState,
  saveTargetIntoState,
} from './dashboardState.editor';
import {
  clearNotificationFeedIntoState,
  createWorkspaceFromInputIntoState,
  openWorkspacePathIntoState,
  openWorkspaceRequestIntoState,
  updateNotificationSettingsIntoState,
} from './dashboardState.workspace';
import type { WorkspaceHydrationMode } from './dashboardState.workspace';

type EditorContext = Parameters<typeof loadTargetDocumentIntoState>[0];
type NewTargetContext = Parameters<typeof loadNewTargetTemplateIntoState>[0];
type WorkspaceLifecycleContext = Parameters<typeof openWorkspaceRequestIntoState>[0];
type NotificationContext = Parameters<typeof updateNotificationSettingsIntoState>[0];

export type DashboardActionsContext = {
  workspaceLoading: boolean;
  openingWorkspace: boolean;
  loadingTarget: boolean;
  selectedDirectoryName: string | null;
  selectedTarget: TargetSummary | null;
  workspaceSummary: WorkspaceSummary | null;
  workspaceInput: string;
  hasUnsavedWork: boolean;
  editorContext: EditorContext;
  newTargetContext: NewTargetContext;
  workspaceLifecycleContext: WorkspaceLifecycleContext;
  beginWorkspaceUpdate: () => number;
  isCurrentWorkspaceUpdate: (updateId: number) => boolean;
  hydrateWorkspaceSnapshot: (
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
    hydrationMode: WorkspaceHydrationMode,
  ) => Promise<void>;
  setFeedback: (tone: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setDirty: (dirty: boolean) => void;
  applyEditorState: (
    nextSession: EditorContext['draftSession'],
    nextToml: string,
    options?: { clearInspector?: boolean },
  ) => void;
  cloneBaselineSession: () => EditorContext['draftSession'];
  editorBaselineToml: string;
  updateGuidedDraft: (updater: (draft: TargetDraft) => TargetDraft) => void;
  addCanonicalizerToDraft: () => void;
  updateCanonicalizerInDraft: (
    index: number,
    updater: (canonicalizer: TargetDraftCanonicalizer) => TargetDraftCanonicalizer,
  ) => void;
  removeCanonicalizerFromDraft: (index: number) => void;
};

export async function selectTargetAction(context: DashboardActionsContext, directoryName: string) {
  if (context.workspaceLoading || context.openingWorkspace) {
    return;
  }
  if (directoryName === context.selectedDirectoryName && !context.loadingTarget) {
    return;
  }
  if (!context.workspaceLifecycleContext.confirmDiscardDraft()) {
    return;
  }

  context.workspaceLifecycleContext.setSelectedDirectoryName(directoryName);
  await loadTargetDocumentIntoState(context.editorContext, directoryName);
}

export async function startNewTargetAction(
  context: DashboardActionsContext,
  kind: TargetTemplateKind,
) {
  if (context.workspaceLoading || context.openingWorkspace) {
    return;
  }
  if (!context.workspaceLifecycleContext.confirmDiscardDraft()) {
    return;
  }

  await loadNewTargetTemplateIntoState(context.newTargetContext, kind);
}

export async function previewTargetAction(context: DashboardActionsContext) {
  await previewTargetIntoState(context.editorContext);
}

export async function saveTargetAction(context: DashboardActionsContext) {
  await saveTargetIntoState(context.editorContext);
}

export async function deleteSelectedTargetAction(context: DashboardActionsContext) {
  await deleteSelectedTargetFromState(context.editorContext);
}

export async function runSelectedTargetAction(context: DashboardActionsContext) {
  await runSelectedTargetFromState(context.editorContext);
}

export async function runWorkspaceAction(context: DashboardActionsContext) {
  await runWorkspaceFromState(context.editorContext);
}

export async function openWorkspacePathAction(context: DashboardActionsContext) {
  if (!context.workspaceSummary) {
    return;
  }

  await openWorkspacePathIntoState(context.setFeedback);
}

export async function openSelectedTargetPathAction(context: DashboardActionsContext) {
  if (context.loadingTarget || !context.selectedTarget) {
    return;
  }

  try {
    await openTargetPath(context.selectedTarget.directoryName);
  } catch (error) {
    context.setFeedback('error', errorMessage(error));
  }
}

export async function openWorkspaceFromInputAction(context: DashboardActionsContext) {
  const path = context.workspaceInput.trim();
  await openWorkspaceRequestIntoState(
    context.workspaceLifecycleContext,
    path.length > 0 ? path : undefined,
  );
}

export async function openRecentWorkspaceAction(context: DashboardActionsContext, path: string) {
  await openWorkspaceRequestIntoState(context.workspaceLifecycleContext, path);
}

export async function createWorkspaceFromInputAction(context: DashboardActionsContext) {
  await createWorkspaceFromInputIntoState({
    ...context.workspaceLifecycleContext,
    workspaceInput: context.workspaceInput,
  });
}

export async function updateNotificationSettingsAction(
  context: DashboardActionsContext,
  settings: NotificationSettings,
) {
  const notificationContext: NotificationContext = {
    beginWorkspaceUpdate: context.beginWorkspaceUpdate,
    isCurrentWorkspaceUpdate: context.isCurrentWorkspaceUpdate,
    hydrateWorkspaceSnapshot: context.hydrateWorkspaceSnapshot,
    selectedTargetDirectoryName: context.selectedTarget?.directoryName ?? null,
    setFeedback: context.setFeedback,
  };

  await updateNotificationSettingsIntoState(notificationContext, settings);
}

export async function clearNotificationFeedAction(context: DashboardActionsContext) {
  const notificationContext: NotificationContext = {
    beginWorkspaceUpdate: context.beginWorkspaceUpdate,
    isCurrentWorkspaceUpdate: context.isCurrentWorkspaceUpdate,
    hydrateWorkspaceSnapshot: context.hydrateWorkspaceSnapshot,
    selectedTargetDirectoryName: context.selectedTarget?.directoryName ?? null,
    setFeedback: context.setFeedback,
  };

  await clearNotificationFeedIntoState(notificationContext);
}

export function resetDraftAction(context: DashboardActionsContext) {
  if (context.loadingTarget) {
    return;
  }
  context.applyEditorState(context.cloneBaselineSession(), context.editorBaselineToml);
  context.setDirty(false);
}

export function setDraftKindAction(context: DashboardActionsContext, kind: TargetTemplateKind) {
  context.updateGuidedDraft((draft) => normalizeDraftForKind(draft, kind));
}

export function setSelectionKindAction(
  context: DashboardActionsContext,
  kind: TargetDraft['selectionKind'],
) {
  context.updateGuidedDraft((draft) => normalizeDraftForSelectionKind(draft, kind));
}

export function setSelectionMatchAction(
  context: DashboardActionsContext,
  match: TargetDraft['selectionMatch'],
) {
  context.updateGuidedDraft((draft) => ({
    ...draft,
    selectionMatch: match,
    selectionIndex: match === 'nth' ? (draft.selectionIndex ?? 1) : null,
  }));
}
