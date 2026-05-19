export type WorkspaceSource = 'demo' | 'user';

export type TargetSourceKind = 'http' | 'file';

export type TargetStatusKind =
  | 'ready'
  | 'pending'
  | 'changed'
  | 'skipped_disabled'
  | 'invalid_config'
  | 'unavailable_target'
  | 'invalid_state'
  | 'incompatible_baseline'
  | 'integrity_mismatch'
  | 'directory_invalid'
  | 'status_error'
  | 'failed_permanent'
  | 'failed_transient';

export type TargetBaselinePhase = 'never_succeeded' | 'has_baseline';

export type TargetRunOutcome = 'unchanged' | 'changed' | 'initialized';

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

export type WatchSchedulePreset =
  | 'every_15_minutes'
  | 'manual_only'
  | 'every_5_minutes'
  | 'hourly'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'custom';

export type WatchAlertKind =
  | 'any_change'
  | 'text_appears'
  | 'text_disappears'
  | 'price_drops_below'
  | 'price_changes_by'
  | 'regex_match';

export type WatchSchedule = {
  preset: WatchSchedulePreset;
  customExpression: string | null;
};

export type WatchAlertRule = {
  kind: WatchAlertKind;
  textOperand: string | null;
  numericOperand: number | null;
  regexPattern: string | null;
  ignoreTextFragments: string[];
};

export type WatchProfile = {
  schemaName: string;
  schemaVersion: number;
  paused: boolean;
  folderName: string | null;
  tags: string[];
  schedule: WatchSchedule;
  alertRule: WatchAlertRule;
  delivery: NotificationDelivery;
};

export type TargetSummary = {
  directoryName: string;
  targetDirectoryPath: string;
  targetId: string | null;
  runnableTargetId: string | null;
  displayName: string | null;
  enabled: boolean | null;
  sourceKind: TargetSourceKind | null;
  sourceLocator: string | null;
  selectionKind: TargetSelectionKind | null;
  selectionLabel: string | null;
  compareBasis: TargetCompareBasis | null;
  statusKind: TargetStatusKind;
  baselinePhase: TargetBaselinePhase | null;
  lastRunOutcome: TargetRunOutcome | null;
  lastRunAt: string | null;
  currentComparePreview: string | null;
  watchProfile: WatchProfile;
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
  guidedSession: TargetDraftSession | null;
  targetId: string | null;
  displayName: string | null;
  enabled: boolean | null;
  statusReport: JsonValue | null;
  lastRunSnapshot: JsonValue | null;
  stateDocument: JsonValue | null;
  artifactHistory: TargetArtifactHistory | null;
  artifactIssues: string[];
  watchProfile: WatchProfile;
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

export type TargetSelectionKind = 'css_selector' | 'delimiter_pair';

export type TargetSelectionMatch = 'single' | 'first' | 'nth';

export type TargetDelimiterMode = 'literal' | 'regex';

export type TargetCompareBasis = 'text' | 'inner_html' | 'outer_html';

export type TargetWhitespaceMode = 'preserve' | 'normalize';

export type TargetRegexFlag =
  | 'case_insensitive'
  | 'multi_line'
  | 'dot_matches_new_line'
  | 'swap_greed'
  | 'ignore_whitespace';

export type TargetCanonicalizerKind =
  | 'trim'
  | 'collapse_whitespace'
  | 'normalize_newlines'
  | 'strip_regex'
  | 'lowercase';

export type TargetDraftCanonicalizer = {
  kind: TargetCanonicalizerKind;
  pattern: string | null;
  flags: TargetRegexFlag[];
};

export type TargetDraft = {
  kind: TargetTemplateKind;
  targetId: string;
  displayName: string;
  enabled: boolean;
  sourceLocator: string;
  fetchMethod: 'GET' | null;
  fetchTimeoutMs: number | null;
  fetchMaxBytes: number;
  fetchUserAgent: string | null;
  fetchFollowRedirects: boolean | null;
  fetchAccept: string | null;
  selectionKind: TargetSelectionKind;
  selectionMatch: TargetSelectionMatch;
  selectionIndex: number | null;
  selectionSelector: string | null;
  selectionStart: string | null;
  selectionEnd: string | null;
  selectionDelimiterMode: TargetDelimiterMode | null;
  selectionIncludeStart: boolean | null;
  selectionIncludeEnd: boolean | null;
  selectionRegexFlags: TargetRegexFlag[];
  compareBasis: TargetCompareBasis;
  compareWhitespace: TargetWhitespaceMode | null;
  compareRewriteUrls: boolean;
  compareCanonicalizers: TargetDraftCanonicalizer[];
  storageHistoryLimit: number;
};

export type TargetDraftSession = {
  draft: TargetDraft;
  contractSeedToml: string;
};

export type TargetPreviewRequest = {
  draftSession?: TargetDraftSession | null;
  rawToml?: string | null;
};

export type TargetSaveRequest = {
  previousDirectoryName?: string | null;
  draftSession?: TargetDraftSession | null;
  rawToml?: string | null;
  watchProfile?: WatchProfile | null;
};

export type SourceInspectionRequest = {
  kind: TargetTemplateKind;
  sourceLocator: string;
  fetchMethod: 'GET' | null;
  fetchTimeoutMs: number | null;
  fetchUserAgent: string | null;
  fetchFollowRedirects: boolean | null;
  fetchAccept: string | null;
};

export type SourceInspectionResult = {
  finalUrl: string | null;
  contentType: string | null;
  html: string;
};

export type TargetTemplate = {
  kind: TargetTemplateKind;
  draftSession: TargetDraftSession;
  canonicalToml: string;
};

export type TargetPreview = {
  targetId: string;
  displayName: string;
  canonicalToml: string;
  statusReport: JsonValue;
  dryRunReport: JsonValue;
  draftSession: TargetDraftSession;
  previewSnapshot: SnapshotArtifactRecord | null;
  previewArtifactIssues: string[];
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
