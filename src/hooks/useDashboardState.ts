import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  createTarget,
  deleteTarget,
  duplicateTarget,
  getAppInfo,
  getBundleHydrationStatus,
  getBundleManifest,
  getProjectStatus,
  getRunDetail,
  getRuntimeReadinessStatus,
  getSidecarHealth,
  getWorkspaceDiagnostics,
  listRecentWorkspaces,
  listRuns,
  listTargets,
  openWorkspace,
  runAllTargets,
  runFfhnProbe,
  runTarget,
  toggleTargetState,
  openPath,
} from '../lib/api';
import type {
  AsyncState,
  BundleHydrationStatus,
  BundleManifest,
  DesktopAppInfo,
  ProbeResult,
  ProjectStatus,
  RecentWorkspace,
  RunDetail,
  RunRecord,
  RuntimeReadinessStatus,
  SidecarHealth,
  TargetRecord,
  WorkspaceDiagnostics,
  WorkspaceSummary,
} from '../types';

function initialState<T>(loading = true): AsyncState<T> {
  return { loading, error: null, data: null };
}

function useAsyncState<T>(loading = true) {
  return useState(() => initialState<T>(loading));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useDashboardState() {
  const [appInfo, setAppInfo] = useAsyncState<DesktopAppInfo>();
  const [health, setHealth] = useAsyncState<SidecarHealth>();
  const [workspace, setWorkspace] = useAsyncState<WorkspaceSummary>();
  const [targets, setTargets] = useAsyncState<TargetRecord[]>();
  const [runs, setRuns] = useAsyncState<RunRecord[]>();
  const [recent, setRecent] = useAsyncState<RecentWorkspace[]>();
  const [diagnostics, setDiagnostics] = useAsyncState<WorkspaceDiagnostics>();
  const [bundleManifest, setBundleManifest] = useAsyncState<BundleManifest>();
  const [bundleHydration, setBundleHydration] = useAsyncState<BundleHydrationStatus>();
  const [runtimeReadiness, setRuntimeReadiness] = useAsyncState<RuntimeReadinessStatus>();
  const [projectStatus, setProjectStatus] = useAsyncState<ProjectStatus>();
  const [probe, setProbe] = useAsyncState<ProbeResult>(false);
  const [runDetail, setRunDetail] = useAsyncState<RunDetail>(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [isCreatingTarget, setIsCreatingTarget] = useState(false);
  const [executingTargets, setExecutingTargets] = useState(() => new Set<string>());
  const [targetValidationError, setTargetValidationError] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () =>
      targets.data?.find((target) => target.id === selectedTargetId) ?? targets.data?.[0] ?? null,
    [selectedTargetId, targets.data],
  );

  const selectedRun = useMemo(
    () => runs.data?.find((run) => run.id === selectedRunId) ?? runs.data?.[0] ?? null,
    [selectedRunId, runs.data],
  );

  function setWorkspaceCounts(
    nextCounts: Partial<Pick<WorkspaceSummary, 'targetCount' | 'runCount'>>,
  ) {
    setWorkspace((current) => {
      if (!current.data) {
        return current;
      }

      return {
        loading: false,
        error: null,
        data: {
          ...current.data,
          ...nextCounts,
        },
      };
    });
  }

  function findLatestRunIdForTarget(
    targetId: string | null,
    runItems: RunRecord[] | null | undefined = runs.data,
  ) {
    if (!targetId || !runItems?.length) {
      return null;
    }

    return runItems.find((run) => run.targetId === targetId)?.id ?? null;
  }

  function handleSelectTarget(targetId: string | null) {
    setSelectedTargetId(targetId);
    setSelectedRunId(findLatestRunIdForTarget(targetId));
  }

  async function refreshOperationalState(workspacePath = workspace.data?.workspacePath) {
    const [sidecar, diag, runtime, project] = await Promise.all([
      getSidecarHealth(),
      getWorkspaceDiagnostics(workspacePath),
      getRuntimeReadinessStatus(),
      getProjectStatus(),
    ]);

    setHealth({ loading: false, error: null, data: sidecar });
    setDiagnostics({ loading: false, error: null, data: diag });
    setRuntimeReadiness({ loading: false, error: null, data: runtime });
    setProjectStatus({ loading: false, error: null, data: project });
  }

  async function bootstrap(workspacePath?: string) {
    try {
      const [
        app,
        sidecar,
        workspaceSummary,
        targetItems,
        runItems,
        recents,
        diag,
        bundle,
        hydration,
        runtime,
        project,
      ] = await Promise.all([
        getAppInfo(),
        getSidecarHealth(),
        openWorkspace(workspacePath),
        listTargets(workspacePath),
        listRuns(workspacePath),
        listRecentWorkspaces(),
        getWorkspaceDiagnostics(workspacePath),
        getBundleManifest(),
        getBundleHydrationStatus(),
        getRuntimeReadinessStatus(),
        getProjectStatus(),
      ]);

      setAppInfo({ loading: false, error: null, data: app });
      setHealth({ loading: false, error: null, data: sidecar });
      setWorkspace({ loading: false, error: null, data: workspaceSummary });
      setTargets({ loading: false, error: null, data: targetItems });
      setRuns({ loading: false, error: null, data: runItems });
      setRecent({ loading: false, error: null, data: recents });
      setDiagnostics({ loading: false, error: null, data: diag });
      setBundleManifest({ loading: false, error: null, data: bundle });
      setBundleHydration({ loading: false, error: null, data: hydration });
      setRuntimeReadiness({ loading: false, error: null, data: runtime });
      setProjectStatus({ loading: false, error: null, data: project });
      const nextSelectedTargetId = targetItems[0]?.id ?? null;
      setSelectedTargetId(nextSelectedTargetId);
      setSelectedRunId(
        findLatestRunIdForTarget(nextSelectedTargetId, runItems) ?? runItems[0]?.id ?? null,
      );
      return workspaceSummary;
    } catch (error) {
      setActionMessage(errorMessage(error));
      return null;
    }
  }

  async function refreshRuns(options?: { runId?: string | null; targetId?: string | null }) {
    const runItems = await listRuns(workspace.data?.workspacePath);
    setRuns({ loading: false, error: null, data: runItems });
    setWorkspaceCounts({ runCount: runItems.length });
    setSelectedRunId(
      options?.runId ??
        findLatestRunIdForTarget(options?.targetId ?? selectedTargetId, runItems) ??
        runItems[0]?.id ??
        null,
    );
    return runItems;
  }

  async function loadRunDetail(runId: string) {
    setRunDetail(initialState());
    try {
      const detail = await getRunDetail(runId, workspace.data?.workspacePath);
      setRunDetail({ loading: false, error: null, data: detail });
    } catch (error) {
      setRunDetail({ loading: false, error: errorMessage(error), data: null });
    }
  }

  const bootstrapOnMount = useEffectEvent(() => {
    void bootstrap();
  });

  const loadSelectedRunDetail = useEffectEvent((runId: string) => {
    void loadRunDetail(runId);
  });

  useEffect(() => {
    bootstrapOnMount();
  }, []);

  useEffect(() => {
    if (selectedRun?.id) {
      loadSelectedRunDetail(selectedRun.id);
      return;
    }

    setRunDetail(initialState(false));
  }, [selectedRun?.id, setRunDetail, workspace.data?.workspacePath]);

  async function handleProbe() {
    setProbe(initialState());
    try {
      const result = await runFfhnProbe();
      setProbe({ loading: false, error: null, data: result });
      await refreshOperationalState();
      setActionMessage(`Probe completed in ${result.mode} mode.`);
    } catch (error) {
      setProbe({ loading: false, error: errorMessage(error), data: null });
      setActionMessage(errorMessage(error));
    }
  }

  async function handleRunAll() {
    try {
      const allTargetIds = targets.data?.map((target) => target.id) ?? [];
      setExecutingTargets(new Set(allTargetIds));

      await runAllTargets(workspace.data?.workspacePath);
      const runItems = await refreshRuns({ targetId: selectedTargetId });
      setActionMessage(`Executed ${String(runItems.length)} targets.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setExecutingTargets(new Set());
    }
  }

  async function handleRunTarget(targetId = selectedTarget?.id) {
    if (!targetId) return;
    try {
      setExecutingTargets((prev) => new Set(prev).add(targetId));
      const record = await runTarget(targetId, workspace.data?.workspacePath);
      await refreshRuns({ runId: record.id, targetId });
      setActionMessage(`Target executed in ${record.mode} mode.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setExecutingTargets((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  }

  function handleCancelRun(targetId: string) {
    setActionMessage(`Requested cancellation for target execution: ${targetId}.`);
    // Phase 3 binds to OS process sigkill here.
    setExecutingTargets((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }

  async function handleOpenWorkspace(workspacePath?: string) {
    try {
      const opened = await bootstrap(workspacePath);
      if (opened) {
        setActionMessage(
          workspacePath
            ? `Workspace opened at ${opened.workspacePath}.`
            : `Sample workspace opened at ${opened.workspacePath}.`,
        );
      }
    } catch (error) {
      setActionMessage(errorMessage(error));
    }
  }

  async function handleCreateTarget(data: { name: string; url: string; extractorSummary: string }) {
    setTargetValidationError(null);
    if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) {
      setTargetValidationError(
        'Target URL must start with http:// or https:// to conform to upstream FFHN specification.',
      );
      return;
    }

    const id = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const target: TargetRecord = {
      id,
      name: data.name,
      url: data.url,
      extractorSummary: data.extractorSummary,
      status: 'pending',
      enabled: true,
      lastRunAt: null,
    };

    try {
      await createTarget(target, workspace.data?.workspacePath);
      const next = await listTargets(workspace.data?.workspacePath ?? undefined);
      setTargets({ loading: false, error: null, data: next });
      setWorkspaceCounts({ targetCount: next.length });
      handleSelectTarget(id);
      setIsCreatingTarget(false);
      setActionMessage(`Created and persisted new target: ${data.name}.`);
    } catch (error) {
      setActionMessage(`Failed to create target: ${errorMessage(error)}`);
    }
  }

  async function handleDeleteTarget(targetId: string) {
    try {
      await deleteTarget(targetId, workspace.data?.workspacePath);
      const next = await listTargets(workspace.data?.workspacePath ?? undefined);
      setTargets({ loading: false, error: null, data: next });
      setWorkspaceCounts({ targetCount: next.length });
      handleSelectTarget(next[0]?.id ?? null);
      setActionMessage(`Deleted target: ${targetId}.`);
    } catch (error) {
      setActionMessage(`Failed to delete target: ${errorMessage(error)}`);
    }
  }

  async function handleOpenPath(pathString: string) {
    try {
      await openPath(pathString);
      setActionMessage(`Opened path: ${pathString}`);
    } catch (error) {
      setActionMessage(`Failed to open path: ${errorMessage(error)}`);
    }
  }

  async function handleDuplicateTarget(targetId: string) {
    try {
      const copy = await duplicateTarget(targetId, workspace.data?.workspacePath);
      const next = await listTargets(workspace.data?.workspacePath ?? undefined);
      setTargets({ loading: false, error: null, data: next });
      setWorkspaceCounts({ targetCount: next.length });
      handleSelectTarget(copy.id);
      setActionMessage(`Duplicated target: ${targetId} -> ${copy.id}.`);
    } catch (error) {
      setActionMessage(`Failed to duplicate target: ${errorMessage(error)}`);
    }
  }

  async function handleToggleTargetState(targetId: string) {
    try {
      const updated = await toggleTargetState(targetId, workspace.data?.workspacePath);
      const next = await listTargets(workspace.data?.workspacePath ?? undefined);
      setTargets({ loading: false, error: null, data: next });
      setActionMessage(`Target ${targetId} is now ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setActionMessage(`Failed to toggle target: ${errorMessage(error)}`);
    }
  }

  return {
    appInfo,
    health,
    workspace,
    targets,
    runs,
    recent,
    diagnostics,
    bundleManifest,
    bundleHydration,
    runtimeReadiness,
    projectStatus,
    probe,
    runDetail,
    selectedTargetId,
    setSelectedTargetId,
    handleSelectTarget,
    selectedRunId,
    setSelectedRunId,
    actionMessage,
    selectedTarget,
    selectedRun,
    isCreatingTarget,
    setIsCreatingTarget,
    targetValidationError,
    setTargetValidationError,
    executingTargets,
    handleCreateTarget,
    handleDeleteTarget,
    handleOpenPath,
    handleDuplicateTarget,
    handleToggleTargetState,
    bootstrap,
    handleProbe,
    handleRunAll,
    handleRunTarget,
    handleCancelRun,
    handleOpenWorkspace,
  };
}
