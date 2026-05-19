import { waitFor } from '@testing-library/react';

import { APP_VERSION } from '../../../src/lib/appVersion';
import type { useDashboardState } from '../../../src/hooks/useDashboardState';
import type {
  BatchRunResult,
  DesktopBootstrap,
  NotificationSettings,
  SourceInspectionRequest,
  SourceInspectionResult,
  TargetDraftSession,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetRunResult,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../../../src/types';
import {
  makeDocument,
  makeNotificationCenter,
  makeTarget,
  makeWorkspaceSnapshot,
} from '../fixtures';

export type DashboardApiMock = {
  bootstrap: ReturnType<typeof vi.fn<() => Promise<DesktopBootstrap>>>;
  clearNotificationFeed: ReturnType<typeof vi.fn<() => Promise<WorkspaceSnapshot>>>;
  createWorkspace: ReturnType<typeof vi.fn<(workspacePath: string) => Promise<WorkspaceSnapshot>>>;
  deleteTarget: ReturnType<typeof vi.fn<(directoryName: string) => Promise<WorkspaceSnapshot>>>;
  getTargetTemplate: ReturnType<
    typeof vi.fn<(kind: TargetTemplateKind) => Promise<TargetTemplate>>
  >;
  inspectSource: ReturnType<
    typeof vi.fn<(request: SourceInspectionRequest) => Promise<SourceInspectionResult>>
  >;
  openTargetPath: ReturnType<typeof vi.fn<(directoryName: string) => Promise<void>>>;
  openWorkspacePath: ReturnType<typeof vi.fn<() => Promise<void>>>;
  openWorkspace: ReturnType<typeof vi.fn<(workspacePath?: string) => Promise<WorkspaceSnapshot>>>;
  previewTarget: ReturnType<
    typeof vi.fn<(request: TargetPreviewRequest) => Promise<TargetPreview>>
  >;
  readTarget: ReturnType<typeof vi.fn<(directoryName: string) => Promise<TargetDocumentRecord>>>;
  refreshWorkspace: ReturnType<typeof vi.fn<() => Promise<WorkspaceSnapshot>>>;
  runTarget: ReturnType<typeof vi.fn<(directoryName: string) => Promise<TargetRunResult>>>;
  runWorkspace: ReturnType<typeof vi.fn<() => Promise<BatchRunResult>>>;
  saveTarget: ReturnType<
    typeof vi.fn<
      (request: {
        previousDirectoryName?: string | null;
        draftSession?: TargetDraftSession | null;
        rawToml?: string | null;
        watchProfile?: unknown;
      }) => Promise<TargetMutationResult>
    >
  >;
  updateNotificationSettings: ReturnType<
    typeof vi.fn<(settings: NotificationSettings) => Promise<WorkspaceSnapshot>>
  >;
};

export function createApiMock(): DashboardApiMock {
  return {
    bootstrap: vi.fn<() => Promise<DesktopBootstrap>>(),
    clearNotificationFeed: vi.fn<() => Promise<WorkspaceSnapshot>>(),
    createWorkspace: vi.fn<(workspacePath: string) => Promise<WorkspaceSnapshot>>(),
    deleteTarget: vi.fn<(directoryName: string) => Promise<WorkspaceSnapshot>>(),
    getTargetTemplate: vi.fn<(kind: TargetTemplateKind) => Promise<TargetTemplate>>(),
    inspectSource: vi.fn<(request: SourceInspectionRequest) => Promise<SourceInspectionResult>>(),
    openTargetPath: vi.fn<(directoryName: string) => Promise<void>>(),
    openWorkspacePath: vi.fn<() => Promise<void>>(),
    openWorkspace: vi.fn<(workspacePath?: string) => Promise<WorkspaceSnapshot>>(),
    previewTarget: vi.fn<(request: TargetPreviewRequest) => Promise<TargetPreview>>(),
    readTarget: vi.fn<(directoryName: string) => Promise<TargetDocumentRecord>>(),
    refreshWorkspace: vi.fn<() => Promise<WorkspaceSnapshot>>(),
    runTarget: vi.fn<(directoryName: string) => Promise<TargetRunResult>>(),
    runWorkspace: vi.fn<() => Promise<BatchRunResult>>(),
    saveTarget:
      vi.fn<
        (request: {
          previousDirectoryName?: string | null;
          draftSession?: TargetDraftSession | null;
          rawToml?: string | null;
          watchProfile?: unknown;
        }) => Promise<TargetMutationResult>
      >(),
    updateNotificationSettings:
      vi.fn<(settings: NotificationSettings) => Promise<WorkspaceSnapshot>>(),
  };
}

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

export function targetToml(
  targetId: string,
  displayName: string,
  extras = '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/demo.html"\n',
) {
  return `schema_name = "ffhn.target"\ntarget_id = "${targetId}"\ndisplay_name = "${displayName}"\n${extras}`;
}

export function makeDraftSession(
  kind: TargetTemplateKind,
  targetId: string,
  displayName: string,
  sourceLocator: string,
): TargetDraftSession {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }
  const base = document.guidedSession;
  return {
    contractSeedToml: 'schema_name = "ffhn.target"\n',
    draft: {
      ...base.draft,
      kind,
      targetId,
      displayName,
      sourceLocator,
      fetchMethod: kind === 'http' ? 'GET' : null,
      fetchTimeoutMs: kind === 'http' ? 15000 : null,
      fetchUserAgent: kind === 'http' ? 'dataarm/template' : null,
      fetchFollowRedirects: kind === 'http' ? true : null,
      fetchAccept: kind === 'http' ? 'text/html,application/xhtml+xml' : null,
    },
  };
}

export function makeTemplate(
  kind: TargetTemplateKind,
  targetId: string,
  displayName: string,
  sourceLocator: string,
): TargetTemplate {
  return {
    kind,
    draftSession: makeDraftSession(kind, targetId, displayName, sourceLocator),
    canonicalToml: targetToml(
      targetId,
      displayName,
      kind === 'http'
        ? `[target]\nkind = "http"\nsource_url = "${sourceLocator}"\n`
        : `[target]\nkind = "file"\nfile_path = "${sourceLocator}"\n`,
    ),
  };
}

export function makePreview(
  targetId: string,
  displayName: string,
  draftSession: TargetDraftSession,
): TargetPreview {
  return {
    targetId,
    displayName,
    canonicalToml: `${targetToml(targetId, displayName).trim()}\n`,
    draftSession,
    statusReport: { schema_name: 'ffhn.status_report' },
    dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'initialized' } },
    previewSnapshot: null,
    previewArtifactIssues: [],
  };
}

export function makeWorkspace(
  targets = [
    makeTarget({
      directoryName: 'alpha',
      targetId: 'alpha',
      displayName: 'Alpha',
      lastRunOutcome: 'unchanged',
      statusKind: 'ready',
    }),
    makeTarget({
      directoryName: 'bravo',
      targetId: 'bravo',
      displayName: 'Bravo',
      lastRunOutcome: 'changed',
      statusKind: 'changed',
    }),
    makeTarget({
      directoryName: 'charlie',
      targetId: 'charlie',
      displayName: 'Charlie',
      lastRunOutcome: null,
      statusKind: 'pending',
    }),
    makeTarget({
      directoryName: 'delta',
      targetId: 'delta',
      displayName: 'Delta',
      lastRunOutcome: null,
      statusKind: 'failed_transient',
      errorMessage: 'Target unavailable',
    }),
  ],
  notificationCenter = makeNotificationCenter(),
): WorkspaceSnapshot {
  return makeWorkspaceSnapshot({
    summary: {
      workspaceName: 'demo-watch-root',
      workspacePath: '/tmp/dataarm/demo-watch-root',
      workspaceSource: 'demo',
      targetCount: targets.length,
      runnableTargetCount: targets.filter((target) => target.runnableTargetId != null).length,
      issueCount: targets.filter((target) => target.errorMessage != null).length,
      lastRunCount: targets.filter((target) => target.lastRunAt != null).length,
    },
    notificationCenter,
    targets,
  });
}

export function makeBootstrap(workspace: WorkspaceSnapshot): DesktopBootstrap {
  return {
    app: {
      appName: 'Dataarm',
      appVersion: APP_VERSION,
      runtimeContract: 'embedded-ffhn-core',
    },
    workspace,
  };
}

export function makeDocumentMap() {
  return new Map<string, TargetDocumentRecord>([
    [
      'alpha',
      makeDocument({
        directoryName: 'alpha',
        targetId: 'alpha',
        displayName: 'Alpha',
        rawToml: targetToml('alpha', 'Alpha'),
        canonicalToml: targetToml('alpha', 'Alpha'),
        guidedSession: makeDraftSession('file', 'alpha', 'Alpha', '/tmp/dataarm/demo.html'),
      }),
    ],
    [
      'bravo',
      makeDocument({
        directoryName: 'bravo',
        targetId: 'bravo',
        displayName: 'Bravo',
        rawToml: targetToml('bravo', 'Bravo'),
        canonicalToml: targetToml('bravo', 'Bravo'),
        guidedSession: makeDraftSession('file', 'bravo', 'Bravo', '/tmp/dataarm/demo.html'),
      }),
    ],
    [
      'charlie',
      makeDocument({
        directoryName: 'charlie',
        targetId: 'charlie',
        displayName: 'Charlie',
        rawToml: targetToml('charlie', 'Charlie'),
        canonicalToml: targetToml('charlie', 'Charlie'),
        guidedSession: makeDraftSession('file', 'charlie', 'Charlie', '/tmp/dataarm/demo.html'),
      }),
    ],
  ]);
}

export function configureApi(api: DashboardApiMock, workspace = makeWorkspace()) {
  const documents = makeDocumentMap();
  const defaultBootstrap = makeBootstrap(workspace);

  api.bootstrap.mockResolvedValue(defaultBootstrap);
  api.readTarget.mockImplementation((directoryName) => {
    const document = documents.get(directoryName);
    if (!document) {
      throw new Error(`Unknown mock target ${directoryName}`);
    }
    return Promise.resolve(document);
  });
  api.getTargetTemplate.mockImplementation((kind) =>
    Promise.resolve(
      kind === 'http'
        ? makeTemplate('http', 'website_watch', 'Website watch', 'https://example.com')
        : makeTemplate('file', 'file_watch', 'File watch', '/tmp/dataarm/demo.html'),
    ),
  );
  api.previewTarget.mockResolvedValue(
    makePreview(
      'website_watch',
      'Website watch',
      makeDraftSession('http', 'website_watch', 'Website watch', 'https://example.com'),
    ),
  );
  api.inspectSource.mockResolvedValue({
    finalUrl: 'https://example.com/',
    contentType: 'text/html',
    html: '<!doctype html><html><body><main><article class="release">Preview release</article></main></body></html>',
  });
  api.saveTarget.mockResolvedValue({
    directoryName: 'saved-target',
    workspace: makeWorkspace([
      makeTarget({
        directoryName: 'saved-target',
        targetId: 'saved-target',
        displayName: 'Saved target',
        lastRunOutcome: null,
        statusKind: 'pending',
      }),
    ]),
  });
  api.deleteTarget.mockResolvedValue(makeWorkspace([]));
  api.runTarget.mockResolvedValue({
    workspace,
    directoryName: 'alpha',
    statusReport: { schema_name: 'ffhn.status_report' },
    runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
    notification: null,
  });
  api.runWorkspace.mockResolvedValue({
    workspace,
    batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
    skippedDirectories: [],
    notification: null,
  });
  api.openWorkspacePath.mockResolvedValue(undefined);
  api.openTargetPath.mockResolvedValue(undefined);
  api.openWorkspace.mockResolvedValue(workspace);
  api.createWorkspace.mockResolvedValue(makeWorkspace([]));
  api.updateNotificationSettings.mockResolvedValue(
    makeWorkspace(workspace.targets, makeNotificationCenter()),
  );
  api.clearNotificationFeed.mockResolvedValue(
    makeWorkspace(workspace.targets, makeNotificationCenter({ items: [] })),
  );

  return { documents, workspace };
}

export async function waitForLoadedState(result: {
  current: ReturnType<typeof useDashboardState>;
}) {
  await waitFor(() => {
    expect(result.current).not.toBeNull();
    expect(result.current.workspace.loading).toBe(false);
    expect(result.current.selectedDirectoryName).not.toBeNull();
    expect(result.current.document.loading).toBe(false);
  });
}
