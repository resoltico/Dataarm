import type {
  BatchRunResult,
  DesktopBootstrap,
  JsonValue,
  NotificationCenterSnapshot,
  NotificationChannel,
  NotificationDelivery,
  NotificationPermissionState,
  NotificationRecord,
  NotificationSettings,
  RecentWorkspace,
  SnapshotArtifactRecord,
  TargetDocumentRecord,
  TargetArtifactHistory,
  TargetDelimiterMode,
  TargetDraft,
  TargetDraftCanonicalizer,
  TargetDraftSession,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetRegexFlag,
  TargetRunResult,
  TargetSaveRequest,
  TargetSelectionMatch,
  TargetSummary,
  TargetTemplate,
  TargetTemplateKind,
  TargetWhitespaceMode,
  WorkspaceSnapshot,
  WorkspaceSource,
} from '../types';
import { APP_NAME, APP_VERSION } from './appVersion';

type MockTargetDocument = Omit<
  TargetDocumentRecord,
  | 'canonicalToml'
  | 'displayName'
  | 'enabled'
  | 'guidedSession'
  | 'stateDocument'
  | 'statusReport'
  | 'targetId'
> & {
  canonicalToml: string;
  displayName: string;
  enabled: true;
  guidedSession: TargetDraftSession | null;
  stateDocument: JsonValue;
  statusReport: JsonValue;
  targetId: string;
};

type MockWorkspace = {
  workspaceName: string;
  workspacePath: string;
  workspaceSource: WorkspaceSource;
  targets: TargetSummary[];
  documents: Map<string, MockTargetDocument>;
};

type MockState = {
  currentWorkspacePath: string;
  recentWorkspaces: RecentWorkspace[];
  notificationCenter: NotificationCenterSnapshot;
  notificationSequence: number;
  workspaces: Map<string, MockWorkspace>;
};

const DEMO_PATH = '/tmp/dataarm/demo-watch-root';
const MOCK_NOW = '2026-05-15T11:30:00Z';
const MAX_RECENT_WORKSPACES = 10;
const DOCUMENT_LOAD_DELAY_MS = 80;

const httpTemplate = `schema_name = "ffhn.target"
schema_version = 4
target_id = "website_watch"
display_name = "Website watch"
enabled = true

[target]
kind = "http"
source_url = "https://example.com"

[fetch]
engine = "http"
method = "GET"
timeout_ms = 15000
max_bytes = 2000000
user_agent = "dataarm/template"
follow_redirects = true
accept = "text/html,application/xhtml+xml"

[selection]
kind = "css_selector"
selector = "main"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
`;

const fileTemplate = `schema_name = "ffhn.target"
schema_version = 4
target_id = "file_watch"
display_name = "File watch"
enabled = true

[target]
kind = "file"
file_path = "/absolute/path/to/page.html"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = "main"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
`;

const mockState = createInitialState();

function createInitialState(): MockState {
  const demoWorkspace = createDemoWorkspace();
  return {
    currentWorkspacePath: DEMO_PATH,
    recentWorkspaces: [
      {
        workspaceName: demoWorkspace.workspaceName,
        workspacePath: demoWorkspace.workspacePath,
        workspaceSource: demoWorkspace.workspaceSource,
        lastOpenedAt: '2026-05-15T10:00:00Z',
      },
    ],
    notificationCenter: {
      settings: {
        notifyWhen: 'changes_and_errors',
        delivery: 'in_app',
      },
      permissionState: 'granted',
      items: [],
    },
    notificationSequence: 0,
    workspaces: new Map([[DEMO_PATH, demoWorkspace]]),
  };
}

function createDemoWorkspace(): MockWorkspace {
  const statusBoardToml = `schema_name = "ffhn.target"
schema_version = 4
target_id = "status_board"
display_name = "Demo status board"
enabled = true

[target]
kind = "file"
file_path = "${DEMO_PATH}/sources/status-board.html"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = ".status-card"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"
`;

  const releaseNotesToml = `schema_name = "ffhn.target"
schema_version = 4
target_id = "release_notes"
display_name = "Demo release notes"
enabled = true

[target]
kind = "file"
file_path = "${DEMO_PATH}/sources/release-notes.html"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = ".release"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"
`;

  const workspace = createEmptyWorkspace(DEMO_PATH, 'demo');
  const statusBoardHistory = buildArtifactHistory(
    'status_board',
    'text',
    {
      compareText: 'All systems operational\nLast checked 09:55 UTC',
      outerHtml:
        '<article class="status-card"><h2>All systems operational</h2><p>Last checked 09:55 UTC</p></article>',
      capturedAt: '2026-05-15T09:55:00Z',
    },
    [
      {
        compareText: 'Partial outage\nLast checked 09:15 UTC',
        outerHtml:
          '<article class="status-card"><h2>Partial outage</h2><p>Last checked 09:15 UTC</p></article>',
        capturedAt: '2026-05-15T09:15:00Z',
      },
    ],
  );
  const statusBoardDocument = makeDocument(
    workspace.workspacePath,
    'status_board',
    statusBoardToml,
    {
      targetId: 'status_board',
      displayName: 'Demo status board',
      sourceLocator: `${DEMO_PATH}/sources/status-board.html`,
      statusKind: 'ready',
      baselinePhase: 'has_baseline',
      lastRunOutcome: 'unchanged',
      lastRunAt: '2026-05-15T09:55:00Z',
      artifactHistory: statusBoardHistory,
    },
  );
  const releaseNotesDocument = makeDocument(
    workspace.workspacePath,
    'release_notes',
    releaseNotesToml,
    {
      targetId: 'release_notes',
      displayName: 'Demo release notes',
      sourceLocator: `${DEMO_PATH}/sources/release-notes.html`,
      statusKind: 'pending',
      baselinePhase: 'never_succeeded',
      lastRunOutcome: null,
      lastRunAt: null,
    },
  );

  workspace.documents.set('status_board', statusBoardDocument);
  workspace.documents.set('release_notes', releaseNotesDocument);
  workspace.targets = [
    documentToSummary(statusBoardDocument),
    documentToSummary(releaseNotesDocument),
  ];
  return workspace;
}

function createEmptyWorkspace(
  workspacePath: string,
  workspaceSource: WorkspaceSource,
): MockWorkspace {
  return {
    workspaceName: pathBasename(workspacePath),
    workspacePath,
    workspaceSource,
    targets: [],
    documents: new Map(),
  };
}

function currentWorkspace(): MockWorkspace {
  return ensureWorkspace(mockState.currentWorkspacePath);
}

function workspaceSourceForPath(workspacePath: string): WorkspaceSource {
  return workspacePath === DEMO_PATH ? 'demo' : 'user';
}

function ensureWorkspace(workspacePath: string): MockWorkspace {
  const existing = mockState.workspaces.get(workspacePath);
  if (existing) {
    return existing;
  }

  const created = createEmptyWorkspace(workspacePath, workspaceSourceForPath(workspacePath));
  mockState.workspaces.set(workspacePath, created);
  return created;
}

function pathBasename(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.at(-1) ?? 'watch-root';
}

function makeDocument(
  workspacePath: string,
  directoryName: string,
  rawToml: string,
  target: {
    targetId: string;
    displayName: string;
    sourceLocator: string;
    statusKind: string;
    baselinePhase: string;
    lastRunOutcome: string | null;
    lastRunAt: string | null;
    artifactHistory?: TargetArtifactHistory | null;
  },
): MockTargetDocument {
  return {
    directoryName,
    targetDirectoryPath: `${workspacePath}/${directoryName}`,
    targetFilePath: `${workspacePath}/${directoryName}/target.toml`,
    rawToml,
    canonicalToml: rawToml,
    guidedSession: trySessionFromRawToml(rawToml),
    targetId: target.targetId,
    displayName: target.displayName,
    enabled: true,
    statusReport: mockStatusReport(target.targetId, target.displayName, target.statusKind),
    lastRunSnapshot: target.lastRunOutcome
      ? mockRunReport(target.targetId, target.displayName, target.lastRunOutcome)
      : null,
    stateDocument: mockStateDocument(
      target.targetId,
      target.baselinePhase,
      target.lastRunOutcome,
      target.lastRunAt,
      target.artifactHistory ?? null,
    ),
    artifactHistory: target.artifactHistory ?? null,
    artifactIssues: [],
    errorMessage: null,
  };
}

function documentToSummary(document: MockTargetDocument): TargetSummary {
  const statusKind = readStatusKind(document.statusReport);
  const stateDocument = asRecord(document.stateDocument);
  const lastRunSnapshot = asRecord(document.lastRunSnapshot);
  const result = asRecord(lastRunSnapshot?.result);
  const stateLastRun = readStateLastRun(stateDocument);

  return {
    directoryName: document.directoryName,
    targetDirectoryPath: document.targetDirectoryPath,
    targetId: document.targetId,
    runnableTargetId: document.targetId,
    displayName: document.displayName,
    enabled: document.enabled,
    sourceKind: parseSourceKind(document.rawToml),
    sourceLocator: parseSourceLocator(document.rawToml),
    selectionKind: parseSelectionKind(document.rawToml),
    selectionLabel: parseSelectionLabel(document.rawToml),
    compareBasis: parseCompareBasis(document.rawToml),
    statusKind,
    baselinePhase:
      typeof stateDocument?.baseline_phase === 'string' ? stateDocument.baseline_phase : null,
    lastRunOutcome:
      typeof result?.outcome === 'string' ? result.outcome : (stateLastRun?.outcome ?? null),
    lastRunAt: stateLastRun?.runAt ?? null,
    errorMessage: document.errorMessage,
  };
}

function readStateLastRun(stateDocument: Record<string, unknown> | null) {
  const lastRun = asRecord(stateDocument?.last_run);
  if (!lastRun) {
    return null;
  }

  return {
    runAt: typeof lastRun.run_at === 'string' ? lastRun.run_at : null,
    outcome: typeof lastRun.outcome === 'string' ? lastRun.outcome : null,
  };
}

function mockStatusReport(targetId: string, displayName: string, statusKind: string): JsonValue {
  return {
    schema_name: 'ffhn.status_report',
    target_id: targetId,
    display_name: displayName,
    status: {
      kind: statusKind,
    },
  };
}

function mockRunReport(targetId: string, displayName: string, outcome: string): JsonValue {
  return {
    schema_name: 'ffhn.run_report',
    target_id: targetId,
    display_name: displayName,
    result: {
      outcome,
    },
  };
}

function mockStateDocument(
  targetId: string,
  baselinePhase: string,
  outcome: string | null,
  lastRunAt: string | null,
  artifactHistory: MockTargetDocument['artifactHistory'] = null,
): JsonValue | null {
  const baseline =
    baselinePhase === 'has_baseline' && artifactHistory?.currentSnapshot
      ? {
          kind: 'ready',
          current_snapshot: toStateSnapshotSummary(artifactHistory.currentSnapshot),
          snapshot_history: artifactHistory.snapshotHistory.map(toStateSnapshotSummary),
        }
      : { kind: 'pending' };

  return {
    schema_name: 'ffhn.state',
    monitoring_contract_digest_sha256: 'abcd'.repeat(16),
    baseline_phase: baselinePhase,
    baseline,
    last_run:
      outcome && lastRunAt
        ? {
            run_at: lastRunAt,
            outcome,
          }
        : null,
  };
}

function toStateSnapshotSummary(snapshot: SnapshotArtifactRecord) {
  return {
    slot: snapshot.slot,
    compare_digest_sha256: snapshot.compareDigestSha256,
    outer_html_sha256: snapshot.outerHtmlSha256,
    extraction_record_path: snapshot.extractionPath,
    compare_path: snapshot.comparePath,
    outer_html_path: snapshot.outerHtmlPath,
    captured_at: snapshot.capturedAt,
  };
}

function buildArtifactHistory(
  targetId: string,
  compareBasis: string,
  current: { compareText: string; outerHtml: string; capturedAt: string } | null,
  history: Array<{ compareText: string; outerHtml: string; capturedAt: string }>,
): MockTargetDocument['artifactHistory'] {
  const currentSnapshot = current
    ? buildSnapshotArtifactRecord(targetId, compareBasis, 'current', current, 0)
    : null;
  const snapshotHistory = history.map((entry, index) =>
    buildSnapshotArtifactRecord(targetId, compareBasis, 'history', entry, index + 1),
  );

  return {
    monitoringContractDigestSha256: 'abcd'.repeat(16),
    currentSnapshot,
    snapshotHistory,
  };
}

function buildSnapshotArtifactRecord(
  targetId: string,
  compareBasis: string,
  slot: SnapshotArtifactRecord['slot'],
  artifact: { compareText: string; outerHtml: string; capturedAt: string },
  sequence: number,
): SnapshotArtifactRecord {
  const basePath =
    slot === 'current'
      ? 'snapshots/current'
      : `snapshots/history/${artifact.capturedAt.replace(/[:.]/g, '-').replace(/Z$/, 'Z')}`;
  return {
    slot,
    capturedAt: artifact.capturedAt,
    compareDigestSha256: fakeDigest(`${targetId}-compare-${String(sequence)}`),
    outerHtmlSha256: fakeDigest(`${targetId}-outer-${String(sequence)}`),
    comparePath: `${basePath}/compare.txt`,
    outerHtmlPath: `${basePath}/outer.html`,
    extractionPath: `${basePath}/extraction.json`,
    compareText: artifact.compareText,
    outerHtml: artifact.outerHtml,
    extractionRecord: {
      schema_name: 'ffhn.extraction_record',
      compare_basis: compareBasis,
      selection_kind: 'css_selector',
      selection_match: 'single',
      selected_candidate_index: 1,
      candidate_count: 1,
      warning_codes: [],
      created_at: artifact.capturedAt,
      selection_evidence: {
        kind: 'css_selector',
        path: '.demo > .selected',
        tag_name: 'article',
      },
    },
  };
}

function fakeDigest(seed: string) {
  const alphabet = '0123456789abcdef';
  let value = '';
  for (let index = 0; index < 64; index += 1) {
    value += alphabet.charAt((seed.charCodeAt(index % seed.length) + index) % alphabet.length);
  }
  return value;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStatusKind(value: JsonValue | null): string {
  const report = asRecord(value);
  const status = asRecord(report?.status);
  return typeof status?.kind === 'string' ? status.kind : 'pending';
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveMock<T>(factory: () => T): Promise<T> {
  return Promise.resolve().then(factory);
}

function resolveDelayedMock<T>(factory: () => T, delayMs = DOCUMENT_LOAD_DELAY_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(factory());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, delayMs);
  });
}

type ParsedScalar = string | number | boolean | string[];

type ParsedTable = Record<string, ParsedScalar>;

type ParsedMockToml = {
  root: ParsedTable;
  tables: Record<string, ParsedTable>;
  arrayTables: Record<string, ParsedTable[]>;
};

function parseMockScalar(rawValue: string): ParsedScalar {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const body = trimmed.slice(1, -1).trim();
    if (body.length === 0) {
      return [];
    }
    return body
      .split(',')
      .map((item) => item.trim())
      .map((item) => item.replace(/^"/u, '').replace(/"$/u, ''));
  }
  return trimmed;
}

function parseMockToml(rawToml: string): ParsedMockToml {
  const parsed: ParsedMockToml = {
    root: {},
    tables: {},
    arrayTables: {},
  };
  let currentTable: ParsedTable = parsed.root;

  for (const rawLine of rawToml.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('[[') && line.endsWith(']]')) {
      const name = line.slice(2, -2).trim();
      const nextTable: ParsedTable = {};
      parsed.arrayTables[name] = [...(parsed.arrayTables[name] ?? []), nextTable];
      currentTable = nextTable;
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      const name = line.slice(1, -1).trim();
      parsed.tables[name] = parsed.tables[name] ?? {};
      currentTable = parsed.tables[name];
      continue;
    }
    const separator = line.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    currentTable[key] = parseMockScalar(value);
  }

  return parsed;
}

function readParsedString(table: ParsedTable | undefined, key: string) {
  const value = table?.[key];
  return typeof value === 'string' ? value : null;
}

function readParsedNumber(table: ParsedTable | undefined, key: string) {
  const value = table?.[key];
  return typeof value === 'number' ? value : null;
}

function readParsedBoolean(table: ParsedTable | undefined, key: string) {
  const value = table?.[key];
  return typeof value === 'boolean' ? value : null;
}

function readParsedStringArray(table: ParsedTable | undefined, key: string) {
  const value = table?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseDirectoryName(rawToml: string) {
  const targetId = readParsedString(parseMockToml(rawToml).root, 'target_id');
  if (!targetId) {
    throw new Error('target_id is required.');
  }
  return targetId;
}

function parseDisplayName(rawToml: string) {
  const parsed = parseMockToml(rawToml);
  return readParsedString(parsed.root, 'display_name') ?? parseDirectoryName(rawToml);
}

function draftFromParsedToml(parsed: ParsedMockToml): TargetDraft {
  const targetId = readParsedString(parsed.root, 'target_id');
  if (!targetId) {
    throw new Error('target_id is required.');
  }
  const kind = readParsedString(parsed.tables.target, 'kind');
  const selectionKind = readParsedString(parsed.tables.selection, 'kind');
  const compareBasis = readParsedString(parsed.tables.compare, 'basis');
  if (kind !== 'http' && kind !== 'file') {
    throw new Error('target.kind must be http or file.');
  }
  if (selectionKind !== 'css_selector' && selectionKind !== 'delimiter_pair') {
    throw new Error('selection.kind must be css_selector or delimiter_pair.');
  }
  if (compareBasis !== 'text' && compareBasis !== 'inner_html' && compareBasis !== 'outer_html') {
    throw new Error('compare.basis must be text, inner_html, or outer_html.');
  }

  return {
    kind,
    targetId,
    displayName: readParsedString(parsed.root, 'display_name') ?? targetId,
    enabled: readParsedBoolean(parsed.root, 'enabled') ?? true,
    sourceLocator:
      readParsedString(parsed.tables.target, 'source_url') ??
      readParsedString(parsed.tables.target, 'file_path') ??
      '',
    fetchMethod: (readParsedString(parsed.tables.fetch, 'method') as 'GET' | null) ?? null,
    fetchTimeoutMs: readParsedNumber(parsed.tables.fetch, 'timeout_ms'),
    fetchMaxBytes: readParsedNumber(parsed.tables.fetch, 'max_bytes') ?? 2_000_000,
    fetchUserAgent: readParsedString(parsed.tables.fetch, 'user_agent'),
    fetchFollowRedirects: readParsedBoolean(parsed.tables.fetch, 'follow_redirects'),
    fetchAccept: readParsedString(parsed.tables.fetch, 'accept'),
    selectionKind,
    selectionMatch:
      (readParsedString(parsed.tables.selection, 'match') as TargetSelectionMatch | null) ??
      'single',
    selectionIndex: readParsedNumber(parsed.tables.selection, 'index'),
    selectionSelector: readParsedString(parsed.tables.selection, 'selector'),
    selectionStart: readParsedString(parsed.tables.selection, 'start'),
    selectionEnd: readParsedString(parsed.tables.selection, 'end'),
    selectionDelimiterMode:
      (readParsedString(parsed.tables.selection, 'mode') as TargetDelimiterMode | null) ?? null,
    selectionIncludeStart: readParsedBoolean(parsed.tables.selection, 'include_start'),
    selectionIncludeEnd: readParsedBoolean(parsed.tables.selection, 'include_end'),
    selectionRegexFlags: readParsedStringArray(
      parsed.tables.selection,
      'flags',
    ) as TargetRegexFlag[],
    compareBasis,
    compareWhitespace:
      (readParsedString(parsed.tables.compare, 'whitespace') as TargetWhitespaceMode | null) ??
      null,
    compareRewriteUrls: readParsedBoolean(parsed.tables.compare, 'rewrite_urls') ?? false,
    compareCanonicalizers: (parsed.arrayTables['compare.canonicalization'] ?? []).map((entry) => ({
      kind: (readParsedString(entry, 'kind') as TargetDraftCanonicalizer['kind'] | null) ?? 'trim',
      pattern: readParsedString(entry, 'pattern'),
      flags: readParsedStringArray(entry, 'flags') as TargetRegexFlag[],
    })),
    storageHistoryLimit: readParsedNumber(parsed.tables.storage, 'history_limit') ?? 20,
  };
}

function sessionFromRawToml(rawToml: string): TargetDraftSession {
  return {
    draft: draftFromParsedToml(parseMockToml(rawToml)),
    contractSeed: {},
  };
}

function trySessionFromRawToml(rawToml: string): TargetDraftSession | null {
  try {
    return sessionFromRawToml(rawToml);
  } catch {
    return null;
  }
}

function selectionLabelFromDraft(draft: TargetDraft) {
  if (draft.selectionKind === 'css_selector') {
    const selector = draft.selectionSelector ?? 'selector';
    if (draft.selectionMatch === 'nth') {
      return `${selector} (nth ${String(draft.selectionIndex ?? 1)})`;
    }
    return `${selector} (${draft.selectionMatch})`;
  }

  const start = draft.selectionStart ?? 'start';
  const end = draft.selectionEnd ?? 'end';
  if (draft.selectionMatch === 'nth') {
    return `${start} ... ${end} (nth ${String(draft.selectionIndex ?? 1)})`;
  }
  return `${start} ... ${end} (${draft.selectionMatch})`;
}

function compareArtifactFromDraft(draft: TargetDraft) {
  if (draft.compareBasis === 'outer_html') {
    return `<article class="preview-fragment"><h1>${draft.displayName}</h1><p>${draft.sourceLocator}</p></article>`;
  }
  if (draft.compareBasis === 'inner_html') {
    return `<h1>${draft.displayName}</h1><p>${draft.sourceLocator}</p>`;
  }
  return [draft.displayName, draft.sourceLocator, selectionLabelFromDraft(draft)].join('\n');
}

function previewOuterHtmlFromDraft(draft: TargetDraft) {
  const selectionSummary =
    draft.selectionKind === 'css_selector'
      ? (draft.selectionSelector ?? 'main')
      : `${draft.selectionStart ?? 'start'} ... ${draft.selectionEnd ?? 'end'}`;
  return [
    '<section class="dataarm-preview-surface">',
    `  <article data-kind="${draft.kind}">`,
    `    <h1>${draft.displayName}</h1>`,
    `    <p class="preview-source">${draft.sourceLocator}</p>`,
    `    <p class="preview-selection">${selectionSummary}</p>`,
    '  </article>',
    '</section>',
  ].join('\n');
}

function previewSelectionEvidenceFromDraft(draft: TargetDraft) {
  if (draft.selectionKind === 'delimiter_pair') {
    return {
      kind: 'delimiter_pair',
      selected_range: { start_byte: 0, end_byte: 42 },
      inner_range: { start_byte: 4, end_byte: 38 },
      outer_range: { start_byte: 0, end_byte: 42 },
      include_start: draft.selectionIncludeStart ?? false,
      include_end: draft.selectionIncludeEnd ?? false,
    };
  }

  return {
    kind: 'css_selector',
    path: draft.selectionSelector ?? 'main',
    tag_name: 'article',
  };
}

function buildPreviewSnapshot(draft: TargetDraft): SnapshotArtifactRecord {
  const compareText = compareArtifactFromDraft(draft);
  const outerHtml = previewOuterHtmlFromDraft(draft);
  return {
    slot: 'current',
    capturedAt: MOCK_NOW,
    compareDigestSha256: fakeDigest(`preview-compare-${draft.targetId}`),
    outerHtmlSha256: fakeDigest(`preview-outer-${draft.targetId}`),
    comparePath: `snapshots/current/${draft.targetId}/compare.txt`,
    outerHtmlPath: `snapshots/current/${draft.targetId}/outer.html`,
    extractionPath: `snapshots/current/${draft.targetId}/extraction.json`,
    compareText,
    outerHtml,
    extractionRecord: {
      schema_name: 'ffhn.extraction_record',
      compare_basis: draft.compareBasis,
      selection_kind: draft.selectionKind,
      selection_match: draft.selectionMatch,
      selected_candidate_index: draft.selectionIndex ?? 1,
      candidate_count: 1,
      warning_codes: [],
      created_at: MOCK_NOW,
      selection_evidence: previewSelectionEvidenceFromDraft(draft),
      monitoring_contract_digest_sha256: fakeDigest(`contract-${draft.targetId}`),
    },
  };
}

function serializeDraftSession(session: TargetDraftSession) {
  const draft = session.draft;
  const lines = [
    'schema_name = "ffhn.target"',
    'schema_version = 4',
    `target_id = "${draft.targetId}"`,
    `display_name = "${draft.displayName}"`,
    `enabled = ${draft.enabled ? 'true' : 'false'}`,
    '',
    '[target]',
    `kind = "${draft.kind}"`,
    draft.kind === 'http'
      ? `source_url = "${draft.sourceLocator}"`
      : `file_path = "${draft.sourceLocator}"`,
    '',
    '[fetch]',
    `engine = "${draft.kind}"`,
    `max_bytes = ${String(draft.fetchMaxBytes)}`,
  ];

  if (draft.kind === 'http') {
    lines.push(
      `method = "${draft.fetchMethod ?? 'GET'}"`,
      `timeout_ms = ${String(draft.fetchTimeoutMs ?? 15_000)}`,
      `user_agent = "${draft.fetchUserAgent ?? 'dataarm/template'}"`,
      `follow_redirects = ${(draft.fetchFollowRedirects ?? true) ? 'true' : 'false'}`,
      `accept = "${draft.fetchAccept ?? 'text/html,application/xhtml+xml'}"`,
    );
  }

  lines.push('', '[selection]', `kind = "${draft.selectionKind}"`);

  if (draft.selectionKind === 'css_selector') {
    lines.push(`selector = "${draft.selectionSelector ?? 'main'}"`);
  } else {
    lines.push(
      `start = "${draft.selectionStart ?? '<main>'}"`,
      `end = "${draft.selectionEnd ?? '</main>'}"`,
      `mode = "${draft.selectionDelimiterMode ?? 'literal'}"`,
      `include_start = ${draft.selectionIncludeStart ? 'true' : 'false'}`,
      `include_end = ${draft.selectionIncludeEnd ? 'true' : 'false'}`,
    );
    if (draft.selectionRegexFlags.length > 0) {
      lines.push(`flags = [${draft.selectionRegexFlags.map((flag) => `"${flag}"`).join(', ')}]`);
    }
  }

  lines.push(`match = "${draft.selectionMatch}"`);
  if (draft.selectionMatch === 'nth' && draft.selectionIndex != null) {
    lines.push(`index = ${String(draft.selectionIndex)}`);
  }

  lines.push(
    '',
    '[compare]',
    `basis = "${draft.compareBasis}"`,
    `rewrite_urls = ${draft.compareRewriteUrls ? 'true' : 'false'}`,
  );

  if (draft.compareBasis === 'text') {
    lines.push(`whitespace = "${draft.compareWhitespace ?? 'normalize'}"`);
  }

  for (const canonicalizer of draft.compareCanonicalizers) {
    lines.push('', '[[compare.canonicalization]]', `kind = "${canonicalizer.kind}"`);
    if (canonicalizer.pattern) {
      lines.push(`pattern = "${canonicalizer.pattern}"`);
    }
    if (canonicalizer.flags.length > 0) {
      lines.push(`flags = [${canonicalizer.flags.map((flag) => `"${flag}"`).join(', ')}]`);
    }
  }

  lines.push('', '[storage]', `history_limit = ${String(draft.storageHistoryLimit)}`, '');
  return lines.join('\n');
}

function parseSourceKind(rawToml: string) {
  const kind = readParsedString(parseMockToml(rawToml).tables.target, 'kind');
  return kind === 'http' || kind === 'file' ? kind : null;
}

function parseSourceLocator(rawToml: string) {
  const parsed = parseMockToml(rawToml);
  return (
    readParsedString(parsed.tables.target, 'source_url') ??
    readParsedString(parsed.tables.target, 'file_path') ??
    'Unknown source'
  );
}

function parseSelectionKind(rawToml: string) {
  const kind = readParsedString(parseMockToml(rawToml).tables.selection, 'kind');
  return kind === 'css_selector' || kind === 'delimiter_pair' ? kind : null;
}

function parseSelectionLabel(rawToml: string) {
  const parsed = parseMockToml(rawToml);
  const selectionKind = parseSelectionKind(rawToml);
  const selectionMatch =
    (readParsedString(parsed.tables.selection, 'match') as TargetSelectionMatch | null) ?? 'single';
  if (selectionKind === 'css_selector') {
    const selector = readParsedString(parsed.tables.selection, 'selector');
    if (!selector) {
      return 'Selection preview unavailable';
    }
    if (selectionMatch === 'nth') {
      return `${selector} (nth ${String(readParsedNumber(parsed.tables.selection, 'index') ?? 1)})`;
    }
    return `${selector} (${selectionMatch})`;
  }
  if (selectionKind === 'delimiter_pair') {
    const start = readParsedString(parsed.tables.selection, 'start');
    const end = readParsedString(parsed.tables.selection, 'end');
    if (!start || !end) {
      return 'Selection preview unavailable';
    }
    if (selectionMatch === 'nth') {
      return `${start} ... ${end} (nth ${String(readParsedNumber(parsed.tables.selection, 'index') ?? 1)})`;
    }
    return `${start} ... ${end} (${selectionMatch})`;
  }
  return 'Selection preview unavailable';
}

function parseCompareBasis(rawToml: string) {
  const basis = readParsedString(parseMockToml(rawToml).tables.compare, 'basis');
  return basis === 'text' || basis === 'inner_html' || basis === 'outer_html' ? basis : 'text';
}

function recalculateWorkspace(workspace: MockWorkspace) {
  const order = new Map(workspace.targets.map((target, index) => [target.directoryName, index]));
  workspace.targets = [...workspace.documents.values()]
    .map(documentToSummary)
    .sort((left, right) => {
      const leftIndex = order.get(left.directoryName) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.directoryName) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
}

function touchRecentWorkspace(workspace: MockWorkspace) {
  mockState.recentWorkspaces = [
    {
      workspaceName: workspace.workspaceName,
      workspacePath: workspace.workspacePath,
      workspaceSource: workspace.workspaceSource,
      lastOpenedAt: MOCK_NOW,
    },
    ...mockState.recentWorkspaces.filter(
      (entry) => entry.workspacePath !== workspace.workspacePath,
    ),
  ].slice(0, MAX_RECENT_WORKSPACES);
}

function workspaceSnapshot(workspace: MockWorkspace): WorkspaceSnapshot {
  const targets = deepClone(workspace.targets);
  return {
    summary: {
      workspaceName: workspace.workspaceName,
      workspacePath: workspace.workspacePath,
      workspaceSource: workspace.workspaceSource,
      targetCount: targets.length,
      runnableTargetCount: targets.filter((target) => target.runnableTargetId != null).length,
      issueCount: targets.filter((target) => target.errorMessage != null).length,
      lastRunCount: targets.filter((target) => target.lastRunAt != null).length,
    },
    recentWorkspaces: deepClone(mockState.recentWorkspaces),
    notificationCenter: deepClone(mockState.notificationCenter),
    targets,
  };
}

function requireTarget(workspace: MockWorkspace, directoryName: string): MockTargetDocument {
  const document = workspace.documents.get(directoryName);
  if (!document) {
    throw new Error(`Mock target ${directoryName} was not found.`);
  }
  return document;
}

export function bootstrapMock(): Promise<DesktopBootstrap> {
  return resolveMock(() => ({
    app: {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      runtimeContract: 'embedded-ffhn-core',
    },
    workspace: workspaceSnapshot(currentWorkspace()),
  }));
}

export function openWorkspaceMock(workspacePath?: string): Promise<WorkspaceSnapshot> {
  return resolveMock(() => {
    const nextWorkspace = ensureWorkspace(workspacePath?.trim() || DEMO_PATH);
    mockState.currentWorkspacePath = nextWorkspace.workspacePath;
    touchRecentWorkspace(nextWorkspace);
    return workspaceSnapshot(nextWorkspace);
  });
}

export function refreshWorkspaceMock(): Promise<WorkspaceSnapshot> {
  return resolveMock(() => workspaceSnapshot(currentWorkspace()));
}

export function createWorkspaceMock(workspacePath: string): Promise<WorkspaceSnapshot> {
  return resolveMock(() => {
    const nextWorkspace = ensureWorkspace(workspacePath.trim());
    mockState.currentWorkspacePath = nextWorkspace.workspacePath;
    touchRecentWorkspace(nextWorkspace);
    return workspaceSnapshot(nextWorkspace);
  });
}

export function readTargetMock(directoryName: string): Promise<TargetDocumentRecord> {
  return resolveDelayedMock(() => deepClone(requireTarget(currentWorkspace(), directoryName)));
}

export function getTargetTemplateMock(kind: TargetTemplateKind): Promise<TargetTemplate> {
  return resolveDelayedMock(() => {
    const canonicalToml = kind === 'http' ? httpTemplate : fileTemplate;
    return {
      kind,
      draftSession: sessionFromRawToml(canonicalToml),
      canonicalToml,
    };
  });
}

export function previewTargetMock(request: TargetPreviewRequest): Promise<TargetPreview> {
  return resolveMock(() => {
    const rawToml =
      request.draftSession != null
        ? serializeDraftSession(request.draftSession)
        : (request.rawToml ?? '');
    const draftSession =
      request.draftSession != null ? request.draftSession : sessionFromRawToml(rawToml);
    const targetId = parseDirectoryName(rawToml);
    const displayName = parseDisplayName(rawToml);
    return {
      targetId,
      displayName,
      canonicalToml: `${rawToml.trim()}\n`,
      draftSession,
      statusReport: mockStatusReport(targetId, displayName, 'pending'),
      dryRunReport: mockRunReport(targetId, displayName, 'initialized'),
      previewSnapshot: buildPreviewSnapshot(draftSession.draft),
      previewArtifactIssues: [],
    };
  });
}

export function saveTargetMock(request: TargetSaveRequest): Promise<TargetMutationResult> {
  return resolveMock(() => {
    const workspace = currentWorkspace();
    const rawToml =
      request.draftSession != null
        ? serializeDraftSession(request.draftSession)
        : (request.rawToml ?? '');
    const directoryName = parseDirectoryName(rawToml);
    const displayName = parseDisplayName(rawToml);
    const sourceLocator = parseSourceLocator(rawToml);
    const canonicalToml = `${rawToml.trim()}\n`;

    if (request.previousDirectoryName && request.previousDirectoryName !== directoryName) {
      workspace.documents.delete(request.previousDirectoryName);
      workspace.targets = workspace.targets.filter(
        (target) => target.directoryName !== request.previousDirectoryName,
      );
    }

    const document = makeDocument(workspace.workspacePath, directoryName, canonicalToml, {
      targetId: directoryName,
      displayName,
      sourceLocator,
      statusKind: 'pending',
      baselinePhase: 'never_succeeded',
      lastRunOutcome: null,
      lastRunAt: null,
    });

    workspace.documents.set(directoryName, document);
    workspace.targets = [
      documentToSummary(document),
      ...workspace.targets.filter((target) => target.directoryName !== directoryName),
    ];
    recalculateWorkspace(workspace);
    touchRecentWorkspace(workspace);

    return {
      workspace: workspaceSnapshot(workspace),
      directoryName,
    };
  });
}

export function updateNotificationSettingsMock(
  settings: NotificationSettings,
): Promise<WorkspaceSnapshot> {
  return resolveMock(() => {
    mockState.notificationCenter.settings = deepClone(settings);
    mockState.notificationCenter.permissionState = permissionStateFor(settings.delivery);
    return workspaceSnapshot(currentWorkspace());
  });
}

export function clearNotificationFeedMock(): Promise<WorkspaceSnapshot> {
  return resolveMock(() => {
    mockState.notificationCenter.items = [];
    return workspaceSnapshot(currentWorkspace());
  });
}

export function deleteTargetMock(directoryName: string): Promise<WorkspaceSnapshot> {
  return resolveMock(() => {
    const workspace = currentWorkspace();
    workspace.documents.delete(directoryName);
    workspace.targets = workspace.targets.filter(
      (target) => target.directoryName !== directoryName,
    );
    recalculateWorkspace(workspace);
    return workspaceSnapshot(workspace);
  });
}

export function runTargetMock(directoryName: string): Promise<TargetRunResult> {
  return resolveMock(() => {
    const workspace = currentWorkspace();
    const document = requireTarget(workspace, directoryName);
    const compareBasis = parseCompareBasis(document.rawToml);
    const displayName = document.displayName;
    const artifactHistorySeed = document.artifactHistory;
    const releaseAnnouncement = `${APP_NAME} ${APP_VERSION} shipped`;
    const nextCompareText =
      directoryName === 'release_notes'
        ? `${releaseAnnouncement}\nStatus: published`
        : 'All systems operational\nLast checked 11:30 UTC';
    const nextOuterHtml =
      directoryName === 'release_notes'
        ? `<article class="release"><h2>${releaseAnnouncement}</h2><p>Status: published</p></article>`
        : '<article class="status-card"><h2>All systems operational</h2><p>Last checked 11:30 UTC</p></article>';
    let historyEntries: Array<{ compareText: string; outerHtml: string; capturedAt: string }> = [];
    if (artifactHistorySeed?.currentSnapshot) {
      const previousCurrent = artifactHistorySeed.currentSnapshot;
      historyEntries = [
        {
          compareText: previousCurrent.compareText,
          outerHtml: previousCurrent.outerHtml,
          capturedAt: previousCurrent.capturedAt,
        },
        ...artifactHistorySeed.snapshotHistory.map((snapshot) => ({
          compareText: snapshot.compareText,
          outerHtml: snapshot.outerHtml,
          capturedAt: snapshot.capturedAt,
        })),
      ];
    }
    const artifactHistory = buildArtifactHistory(
      directoryName,
      compareBasis,
      {
        compareText: nextCompareText,
        outerHtml: nextOuterHtml,
        capturedAt: MOCK_NOW,
      },
      historyEntries,
    );

    document.lastRunSnapshot = mockRunReport(directoryName, displayName, 'changed');
    document.statusReport = mockStatusReport(directoryName, displayName, 'ready');
    document.stateDocument = mockStateDocument(
      directoryName,
      'has_baseline',
      'changed',
      MOCK_NOW,
      artifactHistory,
    );
    document.artifactHistory = artifactHistory;
    recalculateWorkspace(workspace);
    const notification = recordTargetRunNotification(
      workspace.workspaceName,
      displayName,
      'changed',
    );

    return {
      workspace: workspaceSnapshot(workspace),
      directoryName,
      statusReport: deepClone(document.statusReport),
      runReport: mockRunReport(directoryName, displayName, 'changed'),
      notification,
    };
  });
}

export function runWorkspaceMock(): Promise<BatchRunResult> {
  return resolveMock(() => {
    const workspace = currentWorkspace();

    for (const document of workspace.documents.values()) {
      const compareBasis = parseCompareBasis(document.rawToml);
      const displayName = document.displayName;
      const artifactHistory = buildArtifactHistory(
        document.directoryName,
        compareBasis,
        {
          compareText: `Baseline for ${displayName}`,
          outerHtml: `<article class="release"><p>Baseline for ${displayName}</p></article>`,
          capturedAt: MOCK_NOW,
        },
        [],
      );
      document.lastRunSnapshot = mockRunReport(document.directoryName, displayName, 'initialized');
      document.statusReport = mockStatusReport(document.directoryName, displayName, 'ready');
      document.stateDocument = mockStateDocument(
        document.directoryName,
        'has_baseline',
        'initialized',
        MOCK_NOW,
        artifactHistory,
      );
      document.artifactHistory = artifactHistory;
    }

    recalculateWorkspace(workspace);
    const notification = recordWorkspaceRunNotification(workspace.workspaceName, {
      changed: 0,
      initialized: workspace.targets.length,
      unchanged: 0,
    });

    return {
      workspace: workspaceSnapshot(workspace),
      batchReport: {
        schema_name: 'ffhn.batch_run_report',
        entries: [...workspace.documents.values()].map((document) => ({
          target_id: document.targetId,
          outcome: 'initialized',
        })),
      },
      skippedDirectories: [],
      notification,
    };
  });
}

export function openWorkspacePathMock(): Promise<void> {
  return resolveMock(() => {
    currentWorkspace();
  });
}

export function openTargetPathMock(directoryName: string): Promise<void> {
  return resolveMock(() => {
    requireTarget(currentWorkspace(), directoryName);
  });
}

function permissionStateFor(_delivery: NotificationDelivery): NotificationPermissionState {
  return 'granted';
}

function recordTargetRunNotification(
  workspaceName: string,
  targetDisplayName: string,
  outcome: 'changed' | 'initialized' | 'unchanged',
): NotificationRecord | null {
  const policy = mockState.notificationCenter.settings.notifyWhen;
  if (
    policy === 'off' ||
    policy === 'errors_only' ||
    (policy === 'changes_and_errors' && outcome === 'unchanged')
  ) {
    return null;
  }

  const title =
    outcome === 'changed'
      ? `Change detected in ${targetDisplayName}.`
      : outcome === 'initialized'
        ? `Baseline captured for ${targetDisplayName}.`
        : `No change in ${targetDisplayName}.`;
  const body =
    outcome === 'changed'
      ? `The live run in ${workspaceName} recorded content changes for ${targetDisplayName}.`
      : outcome === 'initialized'
        ? `The first live run in ${workspaceName} established a baseline for ${targetDisplayName}.`
        : `The live run in ${workspaceName} matched the current baseline for ${targetDisplayName}.`;

  return appendNotification({
    tone: outcome === 'changed' ? 'warning' : 'success',
    scopeKind: 'target_run',
    title,
    body,
    workspaceName,
    targetDisplayName,
  });
}

function recordWorkspaceRunNotification(
  workspaceName: string,
  counts: {
    changed: number;
    initialized: number;
    unchanged: number;
  },
): NotificationRecord | null {
  const policy = mockState.notificationCenter.settings.notifyWhen;
  if (policy === 'off' || policy === 'errors_only') {
    return null;
  }

  const changedTotal = counts.changed + counts.initialized;
  if (changedTotal > 0) {
    const details = [
      counts.changed > 0 ? pluralize(counts.changed, 'changed target') : null,
      counts.initialized > 0 ? pluralize(counts.initialized, 'new baseline') : null,
    ]
      .filter(Boolean)
      .join(' and ');
    return appendNotification({
      tone: 'warning',
      scopeKind: 'workspace_run',
      title: `Workspace run found ${details}.`,
      body: `${workspaceName} finished a live batch run with ${details}.`,
      workspaceName,
      targetDisplayName: null,
    });
  }

  if (policy !== 'all_completions') {
    return null;
  }

  return appendNotification({
    tone: 'success',
    scopeKind: 'workspace_run',
    title: 'Workspace run completed with no changes.',
    body: `${workspaceName} checked ${pluralize(counts.unchanged, 'target')} and found no changes.`,
    workspaceName,
    targetDisplayName: null,
  });
}

function appendNotification(entry: {
  tone: NotificationRecord['tone'];
  scopeKind: NotificationRecord['scopeKind'];
  title: string;
  body: string;
  workspaceName: string;
  targetDisplayName: string | null;
}): NotificationRecord {
  mockState.notificationSequence += 1;
  const deliveredChannels = deliveryChannelsFor(mockState.notificationCenter.settings.delivery);
  const record: NotificationRecord = {
    id: `mock-alert-${String(mockState.notificationSequence)}`,
    createdAt: MOCK_NOW,
    tone: entry.tone,
    scopeKind: entry.scopeKind,
    title: entry.title,
    body: entry.body,
    workspaceName: entry.workspaceName,
    targetDisplayName: entry.targetDisplayName,
    deliveredChannels,
    deliveryError: null,
  };
  mockState.notificationCenter.items = [record, ...mockState.notificationCenter.items].slice(0, 24);
  return deepClone(record);
}

function deliveryChannelsFor(delivery: NotificationDelivery): NotificationChannel[] {
  switch (delivery) {
    case 'both':
      return ['in_app', 'system'];
    case 'system':
      return ['system'];
    case 'in_app':
    default:
      return ['in_app'];
  }
}

function pluralize(count: number, singular: string) {
  return `${String(count)} ${count === 1 ? singular : `${singular}s`}`;
}

export const __mockDesktopInternals = Object.freeze({
  buildArtifactHistory,
  buildPreviewSnapshot,
  compareArtifactFromDraft,
  createEmptyWorkspace,
  documentToSummary,
  makeDocument,
  mockStateDocument,
  parseCompareBasis,
  parseDisplayName,
  parseDirectoryName,
  parseMockScalar,
  parseMockToml,
  parseSelectionLabel,
  parseSourceKind,
  parseSourceLocator,
  pathBasename,
  pluralize,
  previewOuterHtmlFromDraft,
  previewSelectionEvidenceFromDraft,
  readStatusKind,
  recalculateWorkspace,
  recordTargetRunNotification,
  recordWorkspaceRunNotification,
  resolveDelayedMock,
  selectionLabelFromDraft,
  serializeDraftSession,
  sessionFromRawToml,
  workspaceSourceForPath,
});
