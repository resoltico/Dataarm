import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import type {
  DesktopBootstrap,
  NotificationSettings,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetRunResult,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../../../src/types';
import { configureApi, makeBootstrap, targetToml, waitForLoadedState } from './harness';
import { makeDocument, makeTarget, makeWorkspaceSnapshot } from '../fixtures';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn<() => Promise<DesktopBootstrap>>(),
  clearNotificationFeed: vi.fn<() => Promise<WorkspaceSnapshot>>(),
  createWorkspace: vi.fn<(workspacePath: string) => Promise<WorkspaceSnapshot>>(),
  deleteTarget: vi.fn<(directoryName: string) => Promise<WorkspaceSnapshot>>(),
  getTargetTemplate: vi.fn<(kind: TargetTemplateKind) => Promise<TargetTemplate>>(),
  openTargetPath: vi.fn<(directoryName: string) => Promise<void>>(),
  openWorkspacePath: vi.fn<() => Promise<void>>(),
  openWorkspace: vi.fn<(workspacePath?: string) => Promise<WorkspaceSnapshot>>(),
  previewTarget:
    vi.fn<
      (request: { draftSession?: unknown; rawToml?: string | null }) => Promise<TargetPreview>
    >(),
  readTarget: vi.fn<(directoryName: string) => Promise<TargetDocumentRecord>>(),
  refreshWorkspace: vi.fn<() => Promise<WorkspaceSnapshot>>(),
  runTarget: vi.fn<(directoryName: string) => Promise<TargetRunResult>>(),
  runWorkspace: vi.fn(),
  saveTarget:
    vi.fn<
      (request: {
        previousDirectoryName?: string | null;
        draftSession?: unknown;
        rawToml?: string | null;
      }) => Promise<TargetMutationResult>
    >(),
  updateNotificationSettings:
    vi.fn<(settings: NotificationSettings) => Promise<WorkspaceSnapshot>>(),
}));

vi.mock('../../../src/lib/api', () => api);

function fileDocument(directoryName: string, displayName: string) {
  return makeDocument({
    directoryName,
    targetId: directoryName,
    displayName,
    rawToml: targetToml(
      directoryName,
      displayName,
      '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/demo.html"\n',
    ),
    canonicalToml: targetToml(
      directoryName,
      displayName,
      '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/demo.html"\n',
    ),
  });
}

function repairDocument(directoryName: string, rawToml = '') {
  return makeDocument({
    directoryName,
    targetId: directoryName,
    displayName: `${directoryName} repair`,
    rawToml,
    canonicalToml: null,
    guidedSession: null,
  });
}

function template(kind: TargetTemplateKind) {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }

  const draft =
    kind === 'http'
      ? {
          ...document.guidedSession.draft,
          kind: 'http' as const,
          sourceLocator: 'https://example.com',
          fetchMethod: 'GET' as const,
          fetchTimeoutMs: 15000,
          fetchUserAgent: 'dataarm/template',
          fetchFollowRedirects: true,
          fetchAccept: 'text/html,application/xhtml+xml',
        }
      : {
          ...document.guidedSession.draft,
          kind: 'file' as const,
          sourceLocator: '/tmp/dataarm/source.html',
          fetchMethod: null,
          fetchTimeoutMs: null,
          fetchUserAgent: null,
          fetchFollowRedirects: null,
          fetchAccept: null,
        };

  return {
    kind,
    draftSession: { draft, contractSeedToml: 'schema_name = "ffhn.target"\n' },
    canonicalToml: targetToml(
      draft.targetId,
      draft.displayName,
      kind === 'http'
        ? `[target]\nkind = "http"\nsource_url = "${draft.sourceLocator}"\n`
        : `[target]\nkind = "file"\nfile_path = "${draft.sourceLocator}"\n`,
    ),
  };
}

function preview(targetId: string, displayName: string) {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }

  return {
    targetId,
    displayName,
    canonicalToml: `${targetToml(
      targetId,
      displayName,
      '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/repair.html"\n',
    ).trim()}\n`,
    draftSession: {
      draft: {
        ...document.guidedSession.draft,
        targetId,
        displayName,
        sourceLocator: '/tmp/dataarm/repair.html',
      },
      contractSeedToml: 'schema_name = "ffhn.target"\n',
    },
    statusReport: { schema_name: 'ffhn.status_report' },
    dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'initialized' } },
    previewSnapshot: null,
    previewArtifactIssues: [],
  };
}

function workspace(
  targets = [makeTarget({ directoryName: 'alpha', targetId: 'alpha', displayName: 'Alpha' })],
) {
  return makeWorkspaceSnapshot({
    summary: {
      workspaceName: 'demo-watch-root',
      workspacePath: '/tmp/dataarm/demo-watch-root',
      workspaceSource: 'demo',
      targetCount: targets.length,
      runnableTargetCount: targets.length,
      issueCount: 0,
      lastRunCount: 0,
    },
    targets,
  });
}

describe('useDashboardState draft behavior', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    const bootWorkspace = workspace();
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    configureApi(api);
    api.bootstrap.mockResolvedValue(makeBootstrap(bootWorkspace));
    api.readTarget.mockImplementation((directoryName) =>
      Promise.resolve(fileDocument(directoryName, directoryName)),
    );
    api.getTargetTemplate.mockImplementation((kind) => Promise.resolve(template(kind)));
    api.previewTarget.mockResolvedValue(preview('repair_watch', 'Repair watch'));
    api.saveTarget.mockResolvedValue({
      directoryName: 'alpha',
      workspace: bootWorkspace,
    });
  });

  it('preserves the right source defaults when a draft switches between file and http kinds', async () => {
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    await act(async () => {
      await result.current.handleStartNewTarget('file');
    });

    act(() => {
      result.current.setDraftField('sourceLocator', 'https://already-http.example/releases');
    });
    act(() => {
      result.current.setDraftKind('http');
    });
    expect(result.current.guidedDraft).toMatchObject({
      kind: 'http',
      sourceLocator: 'https://already-http.example/releases',
      fetchMethod: 'GET',
      fetchTimeoutMs: 15000,
      fetchUserAgent: 'dataarm/template',
      fetchFollowRedirects: true,
      fetchAccept: 'text/html,application/xhtml+xml',
    });

    act(() => {
      result.current.setDraftField('sourceLocator', '/tmp/already-absolute.html');
    });
    act(() => {
      result.current.setDraftKind('file');
    });
    expect(result.current.guidedDraft).toMatchObject({
      kind: 'file',
      sourceLocator: '/tmp/already-absolute.html',
      fetchMethod: null,
      fetchTimeoutMs: null,
      fetchUserAgent: null,
      fetchFollowRedirects: null,
      fetchAccept: null,
    });

    act(() => {
      result.current.setDraftField('sourceLocator', 'relative/path.html');
      result.current.setDraftKind('http');
    });
    expect(result.current.guidedDraft?.sourceLocator).toBe('https://example.com');

    act(() => {
      result.current.setDraftField('sourceLocator', 'relative/path.html');
      result.current.setDraftKind('file');
    });
    expect(result.current.guidedDraft?.sourceLocator).toBe('/absolute/path/to/page.html');
  });

  it('switches selection semantics cleanly between delimiter and selector modes', async () => {
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    await act(async () => {
      await result.current.handleStartNewTarget('file');
    });

    act(() => {
      result.current.setSelectionKind('delimiter_pair');
    });
    expect(result.current.guidedDraft).toMatchObject({
      selectionKind: 'delimiter_pair',
      selectionSelector: null,
      selectionStart: '<main>',
      selectionEnd: '</main>',
      selectionDelimiterMode: 'literal',
      selectionIncludeStart: false,
      selectionIncludeEnd: false,
    });

    act(() => {
      result.current.setSelectionMatch('nth');
    });
    expect(result.current.guidedDraft?.selectionIndex).toBe(1);
    expect(result.current.guidedDraft?.selectionMatch).toBe('nth');

    act(() => {
      result.current.setSelectionMatch('single');
    });
    act(() => {
      result.current.setSelectionKind('css_selector');
    });
    expect(result.current.guidedDraft).toMatchObject({
      selectionKind: 'css_selector',
      selectionSelector: 'main',
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: null,
      selectionIncludeEnd: null,
      selectionIndex: null,
    });
  });

  it('adds, updates, and removes canonicalizers as draft-owned state', async () => {
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    await act(async () => {
      await result.current.handleStartNewTarget('file');
    });

    act(() => {
      result.current.addCanonicalizer();
    });
    act(() => {
      result.current.updateCanonicalizer(1, (canonicalizer) => ({
        ...canonicalizer,
        kind: 'strip_regex',
        pattern: 'Status:',
        flags: ['case_insensitive'],
      }));
    });
    act(() => {
      result.current.removeCanonicalizer(0);
    });

    expect(result.current.guidedDraft?.compareCanonicalizers).toEqual([
      {
        kind: 'strip_regex',
        pattern: 'Status:',
        flags: ['case_insensitive'],
      },
    ]);
  });

  it('repairs a raw document, previews it, and returns to guided authoring once the contract becomes valid', async () => {
    const repairWorkspace = workspace([
      makeTarget({ directoryName: 'alpha', targetId: 'alpha', displayName: 'Alpha repair' }),
    ]);
    api.bootstrap.mockResolvedValueOnce(makeBootstrap(repairWorkspace));
    api.readTarget.mockImplementationOnce(() => Promise.resolve(repairDocument('alpha')));
    api.readTarget.mockImplementation((directoryName) =>
      Promise.resolve(fileDocument(directoryName, directoryName)),
    );
    api.saveTarget.mockResolvedValueOnce({
      directoryName: 'alpha',
      workspace: repairWorkspace,
    });
    api.previewTarget.mockResolvedValueOnce(preview('alpha', 'Alpha repaired'));

    const { result, unmount } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    expect(result.current.repairMode).toBe(true);
    expect(result.current.guidedDraft).toBeNull();

    act(() => {
      result.current.setDraftField('displayName', 'ignored in repair mode');
    });
    expect(result.current.guidedDraft).toBeNull();

    await act(async () => {
      await result.current.handlePreview();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'The target document is empty.',
    });

    act(() => {
      result.current.setDraftToml('target_id = "scratch"\n');
    });
    expect(result.current.dirty).toBe(true);
    act(() => {
      result.current.handleResetDraft();
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.draftToml).toBe('');

    const repairToml = targetToml(
      'alpha',
      'Alpha repaired',
      '[target]\nkind = "file"\nfile_path = "/tmp/dataarm/repaired.html"\n',
    );
    act(() => {
      result.current.setDraftToml(repairToml);
    });
    await act(async () => {
      await result.current.handleSave();
    });
    expect(api.saveTarget).toHaveBeenCalledWith({
      previousDirectoryName: 'alpha',
      rawToml: repairToml,
    });

    unmount();

    api.bootstrap.mockResolvedValueOnce(makeBootstrap(repairWorkspace));
    api.readTarget.mockImplementationOnce(() =>
      Promise.resolve(repairDocument('alpha', repairToml)),
    );
    api.previewTarget.mockResolvedValueOnce(preview('alpha', 'Alpha repaired'));

    const previewHook = renderHook(() => useDashboardState());
    await waitForLoadedState(previewHook.result);
    await act(async () => {
      await previewHook.result.current.handlePreview();
    });
    expect(api.previewTarget).toHaveBeenCalledWith({
      rawToml: repairToml,
    });
    await waitFor(() => {
      expect(previewHook.result.current.repairMode).toBe(false);
      expect(previewHook.result.current.guidedDraft?.displayName).toBe('Alpha repaired');
    });
  });
});
