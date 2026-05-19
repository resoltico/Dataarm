import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type {
  ActionFeedback,
  BatchRunResult,
  NotificationSettings,
  TargetDocumentRecord,
  TargetDraft,
  TargetDraftCanonicalizer,
  TargetDraftSession,
  TargetPreview,
  TargetRunResult,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../types';
import {
  addDraftCanonicalizer,
  cloneDraftSession,
  createFeedback,
  dashboardStats,
  editorSignature,
  initialState,
  removeDraftCanonicalizer,
  updateDraftCanonicalizer,
  updateDraftField,
} from './dashboardState.helpers';
import type { ArtifactTab, DetailTab } from './dashboardState.helpers';
import {
  clearNotificationFeedAction,
  createWorkspaceFromInputAction,
  deleteSelectedTargetAction,
  type DashboardActionsContext,
  openRecentWorkspaceAction,
  openSelectedTargetPathAction,
  openWorkspaceFromInputAction,
  openWorkspacePathAction,
  previewTargetAction,
  resetDraftAction,
  runSelectedTargetAction,
  runWorkspaceAction,
  saveTargetAction,
  selectTargetAction,
  setDraftKindAction,
  setSelectionKindAction,
  setSelectionMatchAction,
  startNewTargetAction,
  updateNotificationSettingsAction,
} from './dashboardState.actions';
import { loadTargetDocumentIntoState, type TargetDocumentLoadMode } from './dashboardState.editor';
import {
  bootstrapWorkspaceIntoState,
  hydrateWorkspaceSnapshotIntoState,
  type WorkspaceHydrationMode,
} from './dashboardState.workspace';

export { errorMessage } from './dashboardState.helpers';

function useAsyncState<T>(loading = true) {
  return useState(() => initialState<T>(loading));
}

export function useDashboardState() {
  const [workspace, setWorkspace] = useAsyncState<WorkspaceSnapshot>();
  const [document, setDocument] = useAsyncState<TargetDocumentRecord>(false);
  const [preview, setPreview] = useAsyncState<TargetPreview>(false);
  const [lastRun, setLastRun] = useAsyncState<TargetRunResult>(false);
  const [lastBatch, setLastBatch] = useAsyncState<BatchRunResult>(false);
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [selectedDirectoryName, setSelectedDirectoryName] = useState<string | null>(null);
  const [draftSession, setDraftSession] = useState<TargetDraftSession | null>(null);
  const [editorBaselineSession, setEditorBaselineSession] = useState<TargetDraftSession | null>(
    null,
  );
  const [draftToml, setDraftToml] = useState('');
  const [editorBaselineToml, setEditorBaselineToml] = useState('');
  const [dirty, setDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<'existing' | TargetTemplateKind>('existing');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningTarget, setRunningTarget] = useState(false);
  const [runningWorkspace, setRunningWorkspace] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('changes');
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>('preview');
  const documentLoadSequence = useRef(0);
  const workspaceUpdateSequence = useRef(0);

  const workspaceTargets = workspace.data?.targets;
  const targets = useMemo(() => workspaceTargets ?? [], [workspaceTargets]);
  const recentWorkspaces = workspace.data?.recentWorkspaces ?? [];
  const notificationCenter = workspace.data?.notificationCenter ?? null;
  const isDraftContext = editorMode !== 'existing' || selectedDirectoryName == null;
  const hasUnsavedWork = editorMode !== 'existing' || dirty;
  const selectedTarget = useMemo(
    () =>
      isDraftContext
        ? null
        : (targets.find((target) => target.directoryName === selectedDirectoryName) ?? null),
    [isDraftContext, selectedDirectoryName, targets],
  );
  const workspaceSummary = workspace.data?.summary ?? null;
  const loadingTarget = document.loading;
  const isBusy =
    loadingTarget ||
    saving ||
    runningTarget ||
    runningWorkspace ||
    preview.loading ||
    openingWorkspace;
  const guidedDraft = draftSession?.draft ?? null;
  const repairMode = draftSession == null;
  const previewSnapshot = preview.data?.previewSnapshot ?? null;
  const previewArtifactIssues = preview.data?.previewArtifactIssues ?? [];

  function beginDocumentLoad() {
    documentLoadSequence.current += 1;
    return documentLoadSequence.current;
  }

  function isCurrentDocumentLoad(loadId: number) {
    return documentLoadSequence.current === loadId;
  }

  function cancelDocumentLoad() {
    documentLoadSequence.current += 1;
  }

  function beginWorkspaceUpdate() {
    workspaceUpdateSequence.current += 1;
    return workspaceUpdateSequence.current;
  }

  function isCurrentWorkspaceUpdate(updateId: number) {
    return workspaceUpdateSequence.current === updateId;
  }

  function setFeedback(tone: ActionFeedback['tone'], message: string) {
    setActionFeedback(createFeedback(tone, message));
  }

  function syncDirty(nextSession: TargetDraftSession | null, nextToml: string) {
    setDirty(
      editorSignature(nextSession, nextToml) !==
        editorSignature(editorBaselineSession, editorBaselineToml),
    );
  }

  function clearInspector() {
    setPreview(initialState(false));
    setLastRun(initialState(false));
  }

  function applyEditorState(
    nextSession: TargetDraftSession | null,
    nextToml: string,
    options?: { clearInspector?: boolean },
  ) {
    setDraftSession(nextSession);
    setDraftToml(nextToml);
    syncDirty(nextSession, nextToml);
    if (options?.clearInspector ?? true) {
      clearInspector();
    }
  }

  function clearEditor() {
    cancelDocumentLoad();
    setDocument(initialState(false));
    setDraftSession(null);
    setEditorBaselineSession(null);
    setDraftToml('');
    setEditorBaselineToml('');
    setDirty(false);
    setEditorMode('existing');
    setDetailTab('changes');
    setArtifactTab('preview');
    clearInspector();
  }

  function primeEditorBaseline(nextSession: TargetDraftSession | null, nextToml: string) {
    setEditorBaselineSession(cloneDraftSession(nextSession));
    setEditorBaselineToml(nextToml);
    setDraftSession(cloneDraftSession(nextSession));
    setDraftToml(nextToml);
    setDirty(false);
  }

  function confirmDiscardDraft() {
    if (!hasUnsavedWork) {
      return true;
    }

    return window.confirm(
      editorMode === 'existing'
        ? 'Discard the unsaved target changes?'
        : 'Discard the unsaved target draft?',
    );
  }

  function updateRepairToml(nextToml: string) {
    setDraftToml(nextToml);
    syncDirty(draftSession, nextToml);
    clearInspector();
  }

  function updateGuidedDraft(updater: (draft: TargetDraft) => TargetDraft) {
    if (!draftSession) {
      return;
    }
    const nextSession = {
      ...draftSession,
      draft: updater(draftSession.draft),
    };
    applyEditorState(nextSession, draftToml);
  }

  function setDraftField<K extends keyof TargetDraft>(field: K, value: TargetDraft[K]) {
    updateGuidedDraft((draft) => updateDraftField(draft, field, value));
  }

  async function loadTargetDocument(directoryName: string, loadMode: TargetDocumentLoadMode) {
    await loadTargetDocumentIntoState(editorContext, directoryName, loadMode);
  }

  async function hydrateWorkspaceSnapshot(
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
    hydrationMode: WorkspaceHydrationMode,
  ) {
    await hydrateWorkspaceSnapshotIntoState(
      workspaceLifecycleContext,
      snapshot,
      preferredDirectoryName,
      hydrationMode,
    );
  }

  async function bootstrapApp(isActive: () => boolean) {
    await bootstrapWorkspaceIntoState(workspaceLifecycleContext, isActive);
  }

  const workspaceLifecycleContext = {
    beginWorkspaceUpdate,
    isCurrentWorkspaceUpdate,
    setWorkspace,
    setWorkspaceInput,
    setSelectedDirectoryName,
    selectedDirectoryName,
    setOpeningWorkspace,
    setFeedback,
    setActionFeedback,
    confirmDiscardDraft,
    clearEditor,
    loadTargetDocument,
  };

  const editorContext = {
    beginWorkspaceUpdate,
    isCurrentWorkspaceUpdate,
    beginDocumentLoad,
    isCurrentDocumentLoad,
    cancelDocumentLoad,
    setDocument,
    setDraftSession,
    setDraftToml,
    setDirty,
    setEditorMode,
    setDetailTab,
    setArtifactTab,
    clearInspector,
    primeEditorBaseline,
    applyEditorState,
    setPreview,
    setLastRun,
    setLastBatch,
    setSaving,
    setRunningTarget,
    setRunningWorkspace,
    setActionFeedback,
    setFeedback,
    hydrateWorkspaceSnapshot,
    draftSession,
    draftToml,
    workspaceSummary,
    selectedDirectoryName,
    selectedTarget,
    hasUnsavedWork,
    loadingTarget,
  };

  const newTargetContext = {
    ...editorContext,
    setSelectedDirectoryName,
  };

  const bootstrapOnMount = useEffectEvent((isActive: () => boolean) => {
    void bootstrapApp(isActive);
  });

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      bootstrapOnMount(() => active);
    });
    return () => {
      active = false;
    };
  }, []);

  const actionContext: DashboardActionsContext = {
    workspaceLoading: workspace.loading,
    openingWorkspace,
    loadingTarget,
    selectedDirectoryName,
    selectedTarget,
    workspaceSummary,
    workspaceInput,
    hasUnsavedWork,
    editorContext,
    newTargetContext,
    workspaceLifecycleContext,
    beginWorkspaceUpdate,
    isCurrentWorkspaceUpdate,
    hydrateWorkspaceSnapshot,
    setFeedback,
    setDirty,
    applyEditorState,
    cloneBaselineSession: () => cloneDraftSession(editorBaselineSession),
    editorBaselineToml,
    updateGuidedDraft,
    addCanonicalizerToDraft: () => {
      updateGuidedDraft(addDraftCanonicalizer);
    },
    updateCanonicalizerInDraft: (index, updater) => {
      updateGuidedDraft((draft) => updateDraftCanonicalizer(draft, index, updater));
    },
    removeCanonicalizerFromDraft: (index) => {
      updateGuidedDraft((draft) => removeDraftCanonicalizer(draft, index));
    },
  };

  async function handleSelectTarget(directoryName: string) {
    await selectTargetAction(actionContext, directoryName);
  }

  async function handleStartNewTarget(kind: TargetTemplateKind) {
    await startNewTargetAction(actionContext, kind);
  }

  async function handlePreview() {
    await previewTargetAction(actionContext);
  }

  async function handleSave() {
    await saveTargetAction(actionContext);
  }

  async function handleDeleteSelectedTarget() {
    await deleteSelectedTargetAction(actionContext);
  }

  async function handleRunSelectedTarget() {
    await runSelectedTargetAction(actionContext);
  }

  async function handleRunWorkspace() {
    await runWorkspaceAction(actionContext);
  }

  async function handleOpenWorkspaceFromInput() {
    await openWorkspaceFromInputAction(actionContext);
  }

  async function handleCreateWorkspaceFromInput() {
    await createWorkspaceFromInputAction(actionContext);
  }

  async function handleOpenRecentWorkspace(path: string) {
    await openRecentWorkspaceAction(actionContext, path);
  }

  async function handleOpenWorkspacePath() {
    await openWorkspacePathAction(actionContext);
  }

  async function handleOpenSelectedTargetPath() {
    await openSelectedTargetPathAction(actionContext);
  }

  async function handleUpdateNotificationSettings(settings: NotificationSettings) {
    await updateNotificationSettingsAction(actionContext, settings);
  }

  async function handleClearNotificationFeed() {
    await clearNotificationFeedAction(actionContext);
  }

  function handleResetDraft() {
    resetDraftAction(actionContext);
  }

  function setDraftKind(kind: TargetTemplateKind) {
    setDraftKindAction(actionContext, kind);
  }

  function setSelectionKind(kind: TargetDraft['selectionKind']) {
    setSelectionKindAction(actionContext, kind);
  }

  function setSelectionMatch(match: TargetDraft['selectionMatch']) {
    setSelectionMatchAction(actionContext, match);
  }

  function addCanonicalizer() {
    actionContext.addCanonicalizerToDraft();
  }

  function updateCanonicalizer(
    index: number,
    updater: (canonicalizer: TargetDraftCanonicalizer) => TargetDraftCanonicalizer,
  ) {
    actionContext.updateCanonicalizerInDraft(index, updater);
  }

  function removeCanonicalizer(index: number) {
    actionContext.removeCanonicalizerFromDraft(index);
  }

  const stats = useMemo(() => dashboardStats(workspace.data), [workspace.data]);

  return {
    workspace,
    workspaceSummary,
    workspaceInput,
    setWorkspaceInput,
    selectedDirectoryName,
    selectedTarget,
    isDraftContext,
    hasUnsavedWork,
    targets,
    recentWorkspaces,
    notificationCenter,
    document,
    draftSession,
    guidedDraft,
    repairMode,
    draftToml,
    dirty,
    editorMode,
    preview,
    previewSnapshot,
    previewArtifactIssues,
    lastRun,
    lastBatch,
    actionFeedback,
    isBusy,
    loadingTarget,
    saving,
    runningTarget,
    runningWorkspace,
    openingWorkspace,
    detailTab,
    setDetailTab,
    artifactTab,
    setArtifactTab,
    stats,
    setDraftToml: updateRepairToml,
    setDraftField,
    setDraftKind,
    setSelectionKind,
    setSelectionMatch,
    updateGuidedDraft,
    addCanonicalizer,
    updateCanonicalizer,
    removeCanonicalizer,
    setActionFeedback,
    handleSelectTarget,
    handleStartNewTarget,
    handlePreview,
    handleSave,
    handleDeleteSelectedTarget,
    handleRunSelectedTarget,
    handleRunWorkspace,
    handleUpdateNotificationSettings,
    handleClearNotificationFeed,
    handleOpenWorkspaceFromInput,
    handleCreateWorkspaceFromInput,
    handleOpenRecentWorkspace,
    handleOpenWorkspacePath,
    handleOpenSelectedTargetPath,
    handleResetDraft,
  };
}
