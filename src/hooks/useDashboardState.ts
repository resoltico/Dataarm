import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  bootstrap,
  clearNotificationFeed,
  createWorkspace,
  deleteTarget,
  getTargetTemplate,
  openTargetPath,
  openWorkspace,
  openWorkspacePath,
  previewTarget,
  readTarget,
  refreshWorkspace,
  runTarget,
  runWorkspace,
  saveTarget,
  updateNotificationSettings,
} from '../lib/api';
import type {
  ActionFeedback,
  AsyncState,
  BatchRunResult,
  NotificationRecord,
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

type DetailTab = 'changes' | 'config' | 'artifacts';
type ArtifactTab = 'preview' | 'run' | 'state' | 'batch';

function initialState<T>(loading = true): AsyncState<T> {
  return { loading, error: null, data: null };
}

function useAsyncState<T>(loading = true) {
  return useState(() => initialState<T>(loading));
}

function createFeedback(tone: ActionFeedback['tone'], message: string): ActionFeedback {
  return { tone, message };
}

function notificationFeedback(record: NotificationRecord): ActionFeedback {
  return createFeedback(record.tone, record.title);
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRunOutcome(value: unknown) {
  const report = asRecord(value);
  const result = asRecord(report?.result);
  return typeof result?.outcome === 'string' ? result.outcome : null;
}

function cloneDraftSession(session: TargetDraftSession | null) {
  return session == null ? null : (JSON.parse(JSON.stringify(session)) as TargetDraftSession);
}

function editorSignature(session: TargetDraftSession | null, toml: string) {
  return session == null ? toml : JSON.stringify(session);
}

function normalizeDraftForKind(draft: TargetDraft, kind: TargetTemplateKind): TargetDraft {
  if (kind === 'http') {
    return {
      ...draft,
      kind,
      sourceLocator:
        draft.sourceLocator.startsWith('http://') || draft.sourceLocator.startsWith('https://')
          ? draft.sourceLocator
          : 'https://example.com',
      fetchMethod: 'GET',
      fetchTimeoutMs: draft.fetchTimeoutMs ?? 15000,
      fetchUserAgent: draft.fetchUserAgent ?? 'dataarm/template',
      fetchFollowRedirects: draft.fetchFollowRedirects ?? true,
      fetchAccept: draft.fetchAccept ?? 'text/html,application/xhtml+xml',
    };
  }

  return {
    ...draft,
    kind,
    sourceLocator: draft.sourceLocator.startsWith('/')
      ? draft.sourceLocator
      : '/absolute/path/to/page.html',
    fetchMethod: null,
    fetchTimeoutMs: null,
    fetchUserAgent: null,
    fetchFollowRedirects: null,
    fetchAccept: null,
  };
}

function normalizeDraftForSelectionKind(
  draft: TargetDraft,
  selectionKind: TargetDraft['selectionKind'],
): TargetDraft {
  if (selectionKind === 'css_selector') {
    return {
      ...draft,
      selectionKind,
      selectionSelector: draft.selectionSelector ?? 'main',
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: null,
      selectionIncludeEnd: null,
      selectionRegexFlags: [],
    };
  }

  return {
    ...draft,
    selectionKind,
    selectionSelector: null,
    selectionStart: draft.selectionStart ?? '<main>',
    selectionEnd: draft.selectionEnd ?? '</main>',
    selectionDelimiterMode: draft.selectionDelimiterMode ?? 'literal',
    selectionIncludeStart: draft.selectionIncludeStart ?? false,
    selectionIncludeEnd: draft.selectionIncludeEnd ?? false,
    selectionRegexFlags: draft.selectionRegexFlags,
  };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
    updateGuidedDraft((draft) => ({
      ...draft,
      [field]: value,
    }));
  }

  function setDraftKind(kind: TargetTemplateKind) {
    updateGuidedDraft((draft) => normalizeDraftForKind(draft, kind));
  }

  function setSelectionKind(kind: TargetDraft['selectionKind']) {
    updateGuidedDraft((draft) => normalizeDraftForSelectionKind(draft, kind));
  }

  function setSelectionMatch(match: TargetDraft['selectionMatch']) {
    updateGuidedDraft((draft) => ({
      ...draft,
      selectionMatch: match,
      selectionIndex: match === 'nth' ? (draft.selectionIndex ?? 1) : null,
    }));
  }

  function addCanonicalizer() {
    updateGuidedDraft((draft) => ({
      ...draft,
      compareCanonicalizers: [
        ...draft.compareCanonicalizers,
        { kind: 'trim', pattern: null, flags: [] },
      ],
    }));
  }

  function updateCanonicalizer(
    index: number,
    updater: (canonicalizer: TargetDraftCanonicalizer) => TargetDraftCanonicalizer,
  ) {
    updateGuidedDraft((draft) => ({
      ...draft,
      compareCanonicalizers: draft.compareCanonicalizers.map((canonicalizer, currentIndex) =>
        currentIndex === index ? updater(canonicalizer) : canonicalizer,
      ),
    }));
  }

  function removeCanonicalizer(index: number) {
    updateGuidedDraft((draft) => ({
      ...draft,
      compareCanonicalizers: draft.compareCanonicalizers.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    }));
  }

  function applyWorkspaceSnapshot(
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
  ) {
    setWorkspace({ loading: false, error: null, data: snapshot });
    setWorkspaceInput('');
    const nextDirectoryName =
      snapshot.targets.find((target) => target.directoryName === preferredDirectoryName)
        ?.directoryName ??
      snapshot.targets[0]?.directoryName ??
      null;

    setSelectedDirectoryName(nextDirectoryName);
    return nextDirectoryName;
  }

  async function loadTargetDocument(directoryName: string) {
    const loadId = beginDocumentLoad();
    setDocument(initialState());
    setDraftSession(null);
    setDraftToml('');
    setDirty(false);
    setEditorMode('existing');
    setDetailTab('changes');
    setArtifactTab('preview');
    clearInspector();

    try {
      const record = await readTarget(directoryName);
      if (!isCurrentDocumentLoad(loadId)) {
        return;
      }
      setDocument({ loading: false, error: null, data: record });
      primeEditorBaseline(record.guidedSession, record.canonicalToml ?? record.rawToml);
      setEditorMode('existing');
    } catch (error) {
      if (!isCurrentDocumentLoad(loadId)) {
        return;
      }
      setDocument({ loading: false, error: errorMessage(error), data: null });
      setFeedback('error', errorMessage(error));
    }
  }

  async function hydrateWorkspaceSnapshot(
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
  ) {
    const nextDirectoryName = applyWorkspaceSnapshot(snapshot, preferredDirectoryName);
    if (nextDirectoryName) {
      await loadTargetDocument(nextDirectoryName);
    } else {
      clearEditor();
    }
  }

  async function bootstrapApp(isActive: () => boolean) {
    try {
      const payload = await bootstrap();
      if (!isActive()) {
        return;
      }

      await hydrateWorkspaceSnapshot(payload.workspace, selectedDirectoryName);
    } catch (error) {
      if (!isActive()) {
        return;
      }

      const message = errorMessage(error);
      setWorkspace({ loading: false, error: message, data: null });
      setFeedback('error', message);
    }
  }

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

  async function handleSelectTarget(directoryName: string) {
    if (workspace.loading || openingWorkspace) {
      return;
    }
    if (directoryName === selectedDirectoryName && !loadingTarget) {
      return;
    }
    if (!confirmDiscardDraft()) {
      return;
    }

    setSelectedDirectoryName(directoryName);
    await loadTargetDocument(directoryName);
  }

  async function loadNewTargetTemplate(kind: TargetTemplateKind) {
    const loadId = beginDocumentLoad();
    setSelectedDirectoryName(null);
    setEditorMode(kind);
    setDocument(initialState());
    setDraftSession(null);
    setDraftToml('');
    setDirty(false);
    setDetailTab('config');
    setArtifactTab('preview');
    clearInspector();

    try {
      const template = await getTargetTemplate(kind);
      if (!isCurrentDocumentLoad(loadId)) {
        return;
      }
      setDocument({ loading: false, error: null, data: null });
      primeEditorBaseline(template.draftSession, template.canonicalToml);
      setEditorMode(kind);
      setActionFeedback(createFeedback('info', `Loaded the ${kind} target template.`));
    } catch (error) {
      if (!isCurrentDocumentLoad(loadId)) {
        return;
      }
      const message = errorMessage(error);
      setDocument({ loading: false, error: message, data: null });
      setFeedback('error', message);
    }
  }

  async function handleStartNewTarget(kind: TargetTemplateKind) {
    if (workspace.loading || openingWorkspace) {
      return;
    }
    if (!confirmDiscardDraft()) {
      return;
    }

    await loadNewTargetTemplate(kind);
  }

  async function handlePreview() {
    if (loadingTarget) {
      return;
    }

    if (draftSession == null && !draftToml.trim()) {
      setFeedback('warning', 'The target document is empty.');
      return;
    }

    setPreview(initialState());

    try {
      const nextPreview = await previewTarget(
        draftSession ? { draftSession } : { rawToml: draftToml },
      );
      setPreview({ loading: false, error: null, data: nextPreview });
      applyEditorState(nextPreview.draftSession, nextPreview.canonicalToml, {
        clearInspector: false,
      });
      setArtifactTab('preview');
      setDetailTab('changes');
      setFeedback('success', 'Preview refreshed from canonical FFHN runtime artifacts.');
    } catch (error) {
      const message = errorMessage(error);
      setPreview({ loading: false, error: message, data: null });
      setArtifactTab('preview');
      setDetailTab('changes');
      setFeedback('error', message);
    }
  }

  async function handleSave() {
    if (loadingTarget) {
      return;
    }
    if (!workspaceSummary) {
      setFeedback('error', 'Open a workspace before saving targets.');
      return;
    }

    setSaving(true);

    try {
      const result = await saveTarget(
        draftSession
          ? {
              previousDirectoryName: selectedDirectoryName,
              draftSession,
            }
          : {
              previousDirectoryName: selectedDirectoryName,
              rawToml: draftToml,
            },
      );
      await hydrateWorkspaceSnapshot(result.workspace, result.directoryName);
      setDirty(false);
      setFeedback('success', 'Target saved. Baseline artifacts were reset for a clean next run.');
    } catch (error) {
      setFeedback('error', errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelectedTarget() {
    if (loadingTarget) {
      return;
    }
    if (!workspaceSummary || !selectedTarget) {
      return;
    }
    if (!window.confirm(`Delete ${selectedTarget.displayName ?? selectedTarget.directoryName}?`)) {
      return;
    }

    try {
      const snapshot = await deleteTarget(selectedTarget.directoryName);
      await hydrateWorkspaceSnapshot(snapshot, selectedDirectoryName);
      setFeedback('success', 'Target deleted.');
    } catch (error) {
      setFeedback('error', errorMessage(error));
    }
  }

  async function handleRunSelectedTarget() {
    if (loadingTarget) {
      return;
    }
    if (!workspaceSummary || !selectedTarget) {
      return;
    }
    if (hasUnsavedWork) {
      setFeedback('warning', 'Save or reset the draft before running the saved target.');
      return;
    }

    setRunningTarget(true);
    setLastRun(initialState());

    try {
      const result = await runTarget(selectedTarget.directoryName);
      setLastRun({ loading: false, error: null, data: result });
      await hydrateWorkspaceSnapshot(result.workspace, result.directoryName);
      if (result.notification?.deliveredChannels.includes('in_app')) {
        setActionFeedback(notificationFeedback(result.notification));
      } else {
        const outcome = readRunOutcome(result.runReport);
        setFeedback(
          outcome === 'changed' ? 'warning' : 'success',
          outcome ? `Run finished with outcome ${outcome}.` : 'Run finished.',
        );
      }
    } catch (error) {
      const message = errorMessage(error);
      setLastRun({ loading: false, error: message, data: null });
      try {
        const snapshot = await refreshWorkspace();
        await hydrateWorkspaceSnapshot(snapshot, selectedTarget.directoryName);
      } catch {
        // Preserve the original run failure if workspace refresh also fails.
      }
      setFeedback('error', message);
    } finally {
      setRunningTarget(false);
    }
  }

  async function handleRunWorkspace() {
    if (loadingTarget) {
      return;
    }
    if (!workspaceSummary) {
      return;
    }
    if (hasUnsavedWork) {
      setFeedback('warning', 'Save or reset the draft before running the workspace.');
      return;
    }

    setRunningWorkspace(true);
    setLastBatch(initialState());

    try {
      const result = await runWorkspace();
      setLastBatch({ loading: false, error: null, data: result });
      await hydrateWorkspaceSnapshot(result.workspace, selectedTarget?.directoryName ?? null);
      if (result.notification?.deliveredChannels.includes('in_app')) {
        setActionFeedback(notificationFeedback(result.notification));
      } else {
        setFeedback('success', 'Workspace batch run finished.');
      }
    } catch (error) {
      const message = errorMessage(error);
      setLastBatch({ loading: false, error: message, data: null });
      try {
        const snapshot = await refreshWorkspace();
        await hydrateWorkspaceSnapshot(snapshot, selectedTarget?.directoryName ?? null);
      } catch {
        // Preserve the original batch-run failure if workspace refresh also fails.
      }
      setFeedback('error', message);
    } finally {
      setRunningWorkspace(false);
    }
  }

  async function handleOpenWorkspacePath() {
    if (!workspaceSummary) {
      return;
    }

    try {
      await openWorkspacePath();
    } catch (error) {
      setFeedback('error', errorMessage(error));
    }
  }

  async function handleOpenSelectedTargetPath() {
    if (loadingTarget) {
      return;
    }
    if (!selectedTarget) {
      return;
    }

    try {
      await openTargetPath(selectedTarget.directoryName);
    } catch (error) {
      setFeedback('error', errorMessage(error));
    }
  }

  async function handleOpenWorkspaceRequest(path?: string) {
    if (!confirmDiscardDraft()) {
      return;
    }

    setOpeningWorkspace(true);

    try {
      const snapshot = await openWorkspace(path);
      await hydrateWorkspaceSnapshot(snapshot, selectedDirectoryName);
      setFeedback('success', 'Workspace loaded.');
    } catch (error) {
      const message = errorMessage(error);
      setFeedback('error', message);
    } finally {
      setOpeningWorkspace(false);
    }
  }

  async function handleOpenWorkspaceFromInput() {
    const path = workspaceInput.trim();
    await handleOpenWorkspaceRequest(path.length > 0 ? path : undefined);
  }

  async function handleOpenRecentWorkspace(path: string) {
    await handleOpenWorkspaceRequest(path);
  }

  async function handleCreateWorkspaceFromInput() {
    if (!confirmDiscardDraft()) {
      return;
    }
    const path = workspaceInput.trim();
    if (!path) {
      setFeedback('warning', 'Enter a workspace path first.');
      return;
    }

    setOpeningWorkspace(true);

    try {
      const snapshot = await createWorkspace(path);
      await hydrateWorkspaceSnapshot(snapshot, selectedDirectoryName);
      setFeedback('success', 'Workspace created.');
    } catch (error) {
      setFeedback('error', errorMessage(error));
    } finally {
      setOpeningWorkspace(false);
    }
  }

  async function handleUpdateNotificationSettings(settings: NotificationSettings) {
    try {
      const snapshot = await updateNotificationSettings(settings);
      await hydrateWorkspaceSnapshot(snapshot, selectedTarget?.directoryName ?? null);
      const permissionState = snapshot.notificationCenter.permissionState;
      if (
        (settings.delivery === 'system' || settings.delivery === 'both') &&
        permissionState !== 'granted'
      ) {
        setFeedback('warning', 'System delivery is not ready on this runtime.');
        return;
      }
      setFeedback('success', 'Notification settings updated.');
    } catch (error) {
      setFeedback('error', errorMessage(error));
    }
  }

  async function handleClearNotificationFeed() {
    try {
      const snapshot = await clearNotificationFeed();
      await hydrateWorkspaceSnapshot(snapshot, selectedTarget?.directoryName ?? null);
      setFeedback('info', 'Notification history cleared.');
    } catch (error) {
      setFeedback('error', errorMessage(error));
    }
  }

  function handleResetDraft() {
    if (loadingTarget) {
      return;
    }
    applyEditorState(cloneDraftSession(editorBaselineSession), editorBaselineToml);
    setDirty(false);
  }

  const stats = useMemo(
    () => ({
      total: targets.length,
      runnable: targets.filter((target) => target.runnableTargetId != null).length,
      ready: targets.filter((target) => target.statusKind === 'ready').length,
      changed: targets.filter(
        (target) => target.statusKind === 'changed' || target.lastRunOutcome === 'changed',
      ).length,
      firstRun: targets.filter((target) => target.statusKind === 'pending').length,
      attention: targets.filter(
        (target) =>
          target.errorMessage != null ||
          [
            'invalid_config',
            'unavailable_target',
            'invalid_state',
            'incompatible_baseline',
            'integrity_mismatch',
            'directory_invalid',
            'status_error',
            'failed_permanent',
            'failed_transient',
          ].includes(target.statusKind),
      ).length,
    }),
    [targets],
  );

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
