/** Execution modes exposed by the desktop wrapper. */
export type ExecutionMode = 'mock' | 'sidecar-ready' | 'sidecar-live';

/** Where the desktop runtime currently resolves its sidecar pair from. */
export type RuntimeSource = 'env-override' | 'bundled-candidate' | 'path-hint' | 'none';

/** Basic desktop identity and current execution posture. */
export type DesktopAppInfo = {
  appName: string;
  appVersion: string;
  mode: ExecutionMode;
};

/** Current sidecar resolution facts shown in the operator UI. */
export type SidecarHealth = {
  ffhnConfigured: boolean;
  htmlcutConfigured: boolean;
  ffhnBinaryPathHint: string | null;
  htmlcutBinaryPathHint: string | null;
  runtimeSource: RuntimeSource;
  executionMode: ExecutionMode;
  note: string;
};

/** High-level workspace facts derived from committed sample data or a local workspace. */
export type WorkspaceSummary = {
  workspaceName: string;
  workspacePath: string;
  targetCount: number;
  runCount: number;
  mode: ExecutionMode;
  note: string;
};

/** A single monitoring target visible to the desktop UI. */
export type TargetRecord = {
  id: string;
  name: string;
  url: string;
  status: 'healthy' | 'attention' | 'error' | 'pending';
  enabled: boolean;
  extractorSummary: string;
  lastRunAt: string | null;
};

/** A summarized run entry used by the run history list. */
export type RunRecord = {
  id: string;
  targetId: string;
  status: 'initialized' | 'changed' | 'unchanged' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  summary: string;
  mode: ExecutionMode;
};

/** Expanded run detail for the selected run panel. */
export type RunDetail = {
  id: string;
  targetId: string;
  status: string;
  mode: ExecutionMode;
  commandAttempted: string;
  stdoutPreview: string;
  stderrPreview: string;
  note: string;
};

/** Result of the one-shot FFHN runtime probe. */
export type ProbeResult = {
  ok: boolean;
  command: string;
  mode: ExecutionMode;
  note: string;
};

/** Recently opened workspaces remembered by the desktop wrapper. */
export type RecentWorkspace = {
  workspaceName: string;
  workspacePath: string;
};

/** Current diagnostic facts that explain runtime behavior. */
export type WorkspaceDiagnostics = {
  executionMode: ExecutionMode;
  workspacePath: string;
  ffhnResolution: string;
  htmlcutResolution: string;
  notes: string[];
};

/** Shared async state wrapper for frontend resource loading. */
export type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

/** Pinned metadata for a bundled sidecar dependency. */
export type BundleDependency = {
  repo: string;
  ref: string;
  versionLabel: string;
  binaryBasename: string;
  status: string;
};

/** Machine-readable definition of the current sidecar bundle contract. */
export type BundleManifest = {
  schemaVersion: number;
  desktopProduct: {
    name: string;
    version: string;
  };
  runtimeContract: string;
  executionPosture: {
    current: string;
    note: string;
  };
  dependencies: {
    ffhn: BundleDependency;
    htmlcut: BundleDependency;
  };
  supportedTargetTriples: string[];
  notes: string[];
};

/** Current filesystem state of the committed bundle inputs. */
export type BundleHydrationStatus = {
  current: string;
  note: string;
  ffhn: {
    path: string;
    present: boolean;
    executable: boolean;
  };
  htmlcut: {
    path: string;
    present: boolean;
    executable: boolean;
  };
  supportedTargetTriples: string[];
};

/** Runtime availability of the executable sidecar pair on the current host. */
export type RuntimeReadinessStatus = {
  hostTargetTriple: string;
  current: string;
  runtimeSource: RuntimeSource;
  ffhnBinaryPath: string | null;
  htmlcutBinaryPath: string | null;
  executablePairAvailable: boolean;
  note: string;
};

/** Aggregated maintainer-facing project status derived from active vendor sources. */
export type ProjectStatus = {
  runtimeContract: string;
  supportedPlatform: {
    targetTriple: string;
    status: string;
    note: string;
  };
  sidecarIntake: {
    current: string;
    targetTriple: string;
    status: string;
    expectedFfhnArtifacts: string[];
    expectedHtmlcutArtifacts: string[];
    activationReceiptPresent: boolean;
    note: string;
  };
  packagedExecution: {
    current: string;
    targetTriple: string;
    status: string;
    packagedReceiptPresent: boolean;
    runtimeEnvelopeCompatibilityChecked: boolean;
    note: string;
  };
  packaging: {
    current: string;
    localOutputDirectory: string;
    bundles: string[];
    githubWorkflow: string;
    githubRunner: string;
    signing: string;
    notarization: string;
    note: string;
  };
  release: {
    current: string;
    targetTriple: string;
    status: string;
    blockingGates: string[];
    releaseReceiptPresent: boolean;
    note: string;
  };
  priorities: string[];
};
