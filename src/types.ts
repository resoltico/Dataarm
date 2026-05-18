export type WorkspaceSource = 'demo' | 'user';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export type NotificationPolicy = 'off' | 'errors_only' | 'changes_and_errors' | 'all_completions';

export type NotificationDelivery = 'in_app' | 'system' | 'both';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt_with_rationale'
  | 'unknown';

export type NotificationChannel = 'in_app' | 'system';

export type NotificationScopeKind = 'target_run' | 'workspace_run';

export type ActionFeedback = {
  tone: FeedbackTone;
  message: string;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

export type DesktopAppInfo = {
  appName: string;
  appVersion: string;
  runtimeContract: string;
};

export type RecentWorkspace = {
  workspaceName: string;
  workspacePath: string;
  workspaceSource: WorkspaceSource;
  lastOpenedAt: string;
};

export type WorkspaceSummary = {
  workspaceName: string;
  workspacePath: string;
  workspaceSource: WorkspaceSource;
  targetCount: number;
  runnableTargetCount: number;
  issueCount: number;
  lastRunCount: number;
};

export type TargetSummary = {
  directoryName: string;
  targetDirectoryPath: string;
  targetId: string | null;
  displayName: string | null;
  enabled: boolean | null;
  sourceKind: string | null;
  sourceLocator: string | null;
  selectionKind: string | null;
  selectionLabel: string | null;
  compareBasis: string | null;
  statusKind: string;
  baselinePhase: string | null;
  lastRunOutcome: string | null;
  lastRunAt: string | null;
  errorMessage: string | null;
};

export type WorkspaceSnapshot = {
  summary: WorkspaceSummary;
  recentWorkspaces: RecentWorkspace[];
  notificationCenter: NotificationCenterSnapshot;
  targets: TargetSummary[];
};

export type NotificationSettings = {
  notifyWhen: NotificationPolicy;
  delivery: NotificationDelivery;
};

export type NotificationRecord = {
  id: string;
  createdAt: string;
  tone: FeedbackTone;
  scopeKind: NotificationScopeKind;
  title: string;
  body: string;
  workspaceName: string;
  targetDisplayName: string | null;
  deliveredChannels: NotificationChannel[];
  deliveryError: string | null;
};

export type NotificationCenterSnapshot = {
  settings: NotificationSettings;
  permissionState: NotificationPermissionState;
  items: NotificationRecord[];
};

export type DesktopBootstrap = {
  app: DesktopAppInfo;
  workspace: WorkspaceSnapshot;
};

export type TargetDocumentRecord = {
  directoryName: string;
  targetDirectoryPath: string;
  targetFilePath: string;
  rawToml: string;
  canonicalToml: string | null;
  targetId: string | null;
  displayName: string | null;
  enabled: boolean | null;
  statusReport: JsonValue | null;
  lastRunSnapshot: JsonValue | null;
  stateDocument: JsonValue | null;
  artifactHistory: TargetArtifactHistory | null;
  artifactIssues: string[];
  errorMessage: string | null;
};

export type SnapshotArtifactSlot = 'current' | 'history';

export type SnapshotArtifactRecord = {
  slot: SnapshotArtifactSlot;
  capturedAt: string;
  compareDigestSha256: string;
  outerHtmlSha256: string;
  comparePath: string;
  outerHtmlPath: string;
  extractionPath: string;
  compareText: string;
  outerHtml: string;
  extractionRecord: JsonValue;
};

export type TargetArtifactHistory = {
  monitoringContractDigestSha256: string;
  currentSnapshot: SnapshotArtifactRecord | null;
  snapshotHistory: SnapshotArtifactRecord[];
};

export type TargetTemplateKind = 'http' | 'file';

export type TargetTemplate = {
  kind: TargetTemplateKind;
  rawToml: string;
};

export type TargetPreview = {
  targetId: string;
  displayName: string;
  canonicalToml: string;
  statusReport: JsonValue;
  dryRunReport: JsonValue;
};

export type TargetMutationResult = {
  workspace: WorkspaceSnapshot;
  directoryName: string;
};

export type TargetRunResult = {
  workspace: WorkspaceSnapshot;
  directoryName: string;
  statusReport: JsonValue;
  runReport: JsonValue;
  notification: NotificationRecord | null;
};

export type BatchRunResult = {
  workspace: WorkspaceSnapshot;
  batchReport: JsonValue;
  notification: NotificationRecord | null;
  skippedDirectories: {
    directoryName: string;
    reason: string;
  }[];
};
