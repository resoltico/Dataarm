import type { useDashboardState } from '../../src/hooks/useDashboardState';
import type {
  NotificationCenterSnapshot,
  NotificationRecord,
  SnapshotArtifactRecord,
  TargetArtifactHistory,
  TargetDocumentRecord,
  TargetSummary,
  WorkspaceSnapshot,
} from '../../src/types';

type DashboardState = ReturnType<typeof useDashboardState>;

export function makeTarget(overrides: Partial<TargetSummary> = {}): TargetSummary {
  return {
    directoryName: 'demo_status_board',
    targetDirectoryPath: '/tmp/dataarm/demo-watch-root/demo_status_board',
    targetId: 'status_board',
    displayName: 'Demo status board',
    enabled: true,
    sourceKind: 'file',
    sourceLocator: '/tmp/dataarm/demo-watch-root/sources/status-board.html',
    selectionKind: 'css_selector',
    selectionLabel: '.status-card',
    compareBasis: 'text',
    statusKind: 'ready',
    baselinePhase: 'has_baseline',
    lastRunOutcome: 'unchanged',
    lastRunAt: '2026-05-15T11:30:00Z',
    errorMessage: null,
    ...overrides,
  };
}

export function makeNotificationRecord(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: 'notification-1',
    createdAt: '2026-05-15T11:30:00Z',
    tone: 'warning',
    scopeKind: 'target_run',
    title: 'Change detected in Demo status board.',
    body: 'The live run recorded content changes.',
    workspaceName: 'demo-watch-root',
    targetDisplayName: 'Demo status board',
    deliveredChannels: ['in_app'],
    deliveryError: null,
    ...overrides,
  };
}

export function makeNotificationCenter(
  overrides: Partial<NotificationCenterSnapshot> = {},
): NotificationCenterSnapshot {
  return {
    settings: {
      notifyWhen: 'changes_and_errors',
      delivery: 'in_app',
    },
    permissionState: 'granted',
    items: [],
    ...overrides,
  };
}

export function makeSnapshotArtifact(
  overrides: Partial<SnapshotArtifactRecord> = {},
): SnapshotArtifactRecord {
  return {
    slot: 'current',
    capturedAt: '2026-05-15T11:30:00Z',
    compareDigestSha256: 'digest-current',
    outerHtmlSha256: 'html-current',
    comparePath: '/tmp/dataarm/demo-watch-root/demo_status_board/current/compare.txt',
    outerHtmlPath: '/tmp/dataarm/demo-watch-root/demo_status_board/current/outer.html',
    extractionPath: '/tmp/dataarm/demo-watch-root/demo_status_board/current/extraction.json',
    compareText: 'Current line\nShared',
    outerHtml: '<article>Current</article>',
    extractionRecord: { schema_name: 'ffhn.extraction_record' },
    ...overrides,
  };
}

export function makeArtifactHistory(
  overrides: Partial<TargetArtifactHistory> = {},
): TargetArtifactHistory {
  return {
    monitoringContractDigestSha256: 'monitoring-digest',
    currentSnapshot: makeSnapshotArtifact(),
    snapshotHistory: [
      makeSnapshotArtifact({
        slot: 'history',
        capturedAt: '2026-05-14T11:30:00Z',
        compareDigestSha256: 'digest-previous',
        outerHtmlSha256: 'html-previous',
        comparePath: '/tmp/dataarm/demo-watch-root/demo_status_board/history/compare.txt',
        outerHtmlPath: '/tmp/dataarm/demo-watch-root/demo_status_board/history/outer.html',
        extractionPath: '/tmp/dataarm/demo-watch-root/demo_status_board/history/extraction.json',
        compareText: 'Previous line\nShared',
        outerHtml: '<article>Previous</article>',
      }),
    ],
    ...overrides,
  };
}

export function makeDocument(overrides: Partial<TargetDocumentRecord> = {}): TargetDocumentRecord {
  return {
    directoryName: 'demo_status_board',
    targetDirectoryPath: '/tmp/dataarm/demo-watch-root/demo_status_board',
    targetFilePath: '/tmp/dataarm/demo-watch-root/demo_status_board/target.toml',
    rawToml: 'schema_name = "ffhn.target"\ntarget_id = "status_board"\n',
    canonicalToml: 'schema_name = "ffhn.target"\ntarget_id = "status_board"\n',
    targetId: 'status_board',
    displayName: 'Demo status board',
    enabled: true,
    statusReport: { schema_name: 'ffhn.status_report' },
    lastRunSnapshot: { schema_name: 'ffhn.run_report' },
    stateDocument: { schema_name: 'ffhn.state' },
    artifactHistory: makeArtifactHistory(),
    artifactIssues: [],
    errorMessage: null,
    ...overrides,
  };
}

export function makeWorkspaceSnapshot(
  overrides: Partial<WorkspaceSnapshot> = {},
): WorkspaceSnapshot {
  return {
    summary: {
      workspaceName: 'demo-watch-root',
      workspacePath: '/tmp/dataarm/demo-watch-root',
      workspaceSource: 'demo',
      targetCount: 1,
      runnableTargetCount: 1,
      issueCount: 0,
      lastRunCount: 1,
    },
    recentWorkspaces: [],
    notificationCenter: makeNotificationCenter(),
    targets: [makeTarget()],
    ...overrides,
  };
}

export function makeDashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
  const workspace = makeWorkspaceSnapshot();
  const selectedTarget = workspace.targets[0] ?? null;
  const document = makeDocument();

  return {
    workspace: { loading: false, error: null, data: workspace },
    workspaceSummary: workspace.summary,
    workspaceInput: '/tmp/dataarm/demo-watch-root',
    setWorkspaceInput: () => {},
    selectedDirectoryName: selectedTarget?.directoryName ?? null,
    selectedTarget,
    isDraftContext: false,
    hasUnsavedWork: false,
    targets: workspace.targets,
    recentWorkspaces: workspace.recentWorkspaces,
    notificationCenter: workspace.notificationCenter,
    document: { loading: false, error: null, data: document },
    draftToml: document.rawToml,
    dirty: false,
    editorMode: 'existing',
    preview: { loading: false, error: null, data: null },
    lastRun: { loading: false, error: null, data: null },
    lastBatch: { loading: false, error: null, data: null },
    actionFeedback: null,
    isBusy: false,
    loadingTarget: false,
    saving: false,
    runningTarget: false,
    runningWorkspace: false,
    openingWorkspace: false,
    detailTab: 'changes',
    setDetailTab: () => {},
    artifactTab: 'preview',
    setArtifactTab: () => {},
    stats: {
      total: workspace.targets.length,
      runnable: workspace.targets.length,
      ready: 1,
      changed: 0,
      firstRun: 0,
      attention: 0,
    },
    setDraftToml: () => {},
    setActionFeedback: () => {},
    handleSelectTarget: async () => {},
    handleStartNewTarget: async () => {},
    handlePreview: async () => {},
    handleSave: async () => {},
    handleDeleteSelectedTarget: async () => {},
    handleRunSelectedTarget: async () => {},
    handleRunWorkspace: async () => {},
    handleUpdateNotificationSettings: async () => {},
    handleClearNotificationFeed: async () => {},
    handleOpenWorkspaceFromInput: async () => {},
    handleCreateWorkspaceFromInput: async () => {},
    handleOpenRecentWorkspace: async () => {},
    handleOpenWorkspacePath: async () => {},
    handleOpenSelectedTargetPath: async () => {},
    handleResetDraft: () => {},
    ...overrides,
  };
}
