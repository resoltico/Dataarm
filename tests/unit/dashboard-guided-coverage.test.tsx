import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TargetEditor } from '../../src/components/dashboard/TargetEditor';
import { TargetTable } from '../../src/components/dashboard/TargetTable';
import { makeDashboardState, makeDocument, makeTarget } from './fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('guided dashboard coverage', () => {
  it('wires the guided editor, repair fallback, and existing-target actions', () => {
    const baseDocument = makeDocument();
    const setDraftField = vi.fn();
    const setDraftKind = vi.fn();
    const setSelectionKind = vi.fn();
    const setSelectionMatch = vi.fn();
    const liveCanonicalizers = [
      { kind: 'strip_regex' as const, pattern: null, flags: [] as string[] },
      { kind: 'trim' as const, pattern: null, flags: [] as string[] },
    ];
    const updateCanonicalizer = vi.fn(
      (
        index: number,
        updater: (
          current: (typeof liveCanonicalizers)[number],
        ) => (typeof liveCanonicalizers)[number],
      ) => {
        const current = liveCanonicalizers[index];
        if (!current) {
          throw new Error(`Missing canonicalizer at index ${String(index)}.`);
        }
        liveCanonicalizers[index] = updater(current);
      },
    );
    const removeCanonicalizer = vi.fn();
    const addCanonicalizer = vi.fn();
    const setDraftToml = vi.fn();
    const handlePreview = vi.fn();
    const handleSave = vi.fn();
    const handleRunSelectedTarget = vi.fn();
    const handleResetDraft = vi.fn();
    const handleOpenSelectedTargetPath = vi.fn();
    const handleDeleteSelectedTarget = vi.fn();

    const guidedFileDraft = {
      ...baseDocument.guidedSession.draft,
      kind: 'file' as const,
      targetId: 'release_watch',
      displayName: 'Release watch',
      enabled: true,
      sourceLocator: '/tmp/dataarm/release.html',
      selectionKind: 'delimiter_pair' as const,
      selectionMatch: 'nth' as const,
      selectionIndex: null,
      selectionSelector: null,
      selectionStart: '<main>',
      selectionEnd: '</main>',
      selectionDelimiterMode: 'literal' as const,
      selectionIncludeStart: false,
      selectionIncludeEnd: false,
      selectionRegexFlags: [],
      compareBasis: 'text' as const,
      compareWhitespace: 'normalize' as const,
      compareRewriteUrls: false,
      compareCanonicalizers: [{ kind: 'strip_regex' as const, pattern: null, flags: [] }],
      storageHistoryLimit: 20,
    };

    const { rerender } = render(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'file',
          draftSession: { draft: guidedFileDraft, contractSeed: {} },
          guidedDraft: guidedFileDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          setDraftField,
          setDraftKind,
          setSelectionKind,
          setSelectionMatch,
          updateCanonicalizer,
          removeCanonicalizer,
          addCanonicalizer,
          handlePreview,
          handleSave,
          handleRunSelectedTarget,
          handleResetDraft,
          handleOpenSelectedTargetPath,
          handleDeleteSelectedTarget,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText('Target ID'), {
      target: { value: 'release_digest' },
    });
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Release digest' },
    });
    fireEvent.change(screen.getByLabelText('Enabled'), {
      target: { value: 'false' },
    });
    fireEvent.change(screen.getByLabelText('Target kind'), {
      target: { value: 'http' },
    });
    fireEvent.change(screen.getByLabelText('File path'), {
      target: { value: '/tmp/dataarm/release-digest.html' },
    });
    fireEvent.change(screen.getByLabelText('Maximum bytes'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Maximum bytes'), {
      target: { value: '4096' },
    });
    fireEvent.change(screen.getByLabelText('Selection kind'), {
      target: { value: 'css_selector' },
    });
    fireEvent.change(screen.getByLabelText('Selection match'), {
      target: { value: 'single' },
    });
    fireEvent.change(screen.getByLabelText('Nth index (1-based)'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Nth index (1-based)'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Start delimiter'), {
      target: { value: '<section>' },
    });
    fireEvent.change(screen.getByLabelText('End delimiter'), {
      target: { value: '</section>' },
    });
    fireEvent.change(screen.getByLabelText('Delimiter mode'), {
      target: { value: 'regex' },
    });
    fireEvent.change(screen.getByLabelText('Include start'), {
      target: { value: 'true' },
    });
    fireEvent.change(screen.getByLabelText('Include end'), {
      target: { value: 'true' },
    });
    const regexFlagInputs = screen.getAllByPlaceholderText('case_insensitive, multi_line');
    const selectionRegexFlagsInput = regexFlagInputs[0];
    const canonicalizerRegexFlagsInput = regexFlagInputs[1];
    if (!selectionRegexFlagsInput || !canonicalizerRegexFlagsInput) {
      throw new Error('Expected both selection and canonicalizer regex flag inputs.');
    }
    fireEvent.change(selectionRegexFlagsInput, {
      target: { value: 'case_insensitive, multi_line' },
    });
    fireEvent.change(screen.getByLabelText('Whitespace policy'), {
      target: { value: 'preserve' },
    });
    fireEvent.change(screen.getByLabelText('Compare basis'), {
      target: { value: 'outer_html' },
    });
    fireEvent.change(screen.getByLabelText('Rewrite discovered URLs'), {
      target: { value: 'true' },
    });
    fireEvent.change(screen.getByLabelText('Snapshot history limit'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Snapshot history limit'), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText('Canonicalizer 1 pattern'), {
      target: { value: 'Status:' },
    });
    fireEvent.change(canonicalizerRegexFlagsInput, {
      target: { value: 'case_insensitive, multi_line' },
    });
    fireEvent.change(screen.getByLabelText('Canonicalizer 1 kind'), {
      target: { value: 'lowercase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add canonicalizer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview target' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }));

    expect(setDraftField).toHaveBeenCalled();
    expect(setDraftKind).toHaveBeenCalledWith('http');
    expect(setSelectionKind).toHaveBeenCalledWith('css_selector');
    expect(setSelectionMatch).toHaveBeenCalledWith('single');
    expect(updateCanonicalizer).toHaveBeenCalled();
    expect(removeCanonicalizer).toHaveBeenCalledWith(0);
    expect(addCanonicalizer).toHaveBeenCalledTimes(1);
    expect(handlePreview).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledTimes(1);

    const httpDraft = {
      ...guidedFileDraft,
      kind: 'http' as const,
      sourceLocator: 'https://example.com/releases',
      fetchMethod: 'GET' as const,
      fetchTimeoutMs: null,
      fetchUserAgent: null,
      fetchFollowRedirects: false,
      fetchAccept: null,
      selectionKind: 'css_selector' as const,
      selectionMatch: 'single' as const,
      selectionIndex: null,
      selectionSelector: null,
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: null,
      selectionIncludeEnd: null,
      compareBasis: 'text' as const,
      compareCanonicalizers: [],
    };
    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'http',
          draftSession: { draft: httpDraft, contractSeed: {} },
          guidedDraft: httpDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          setDraftField,
          setDraftKind,
          setSelectionKind,
          setSelectionMatch,
          updateCanonicalizer,
          removeCanonicalizer,
          addCanonicalizer,
        })}
      />,
    );

    expect(
      screen.getByText(
        'No canonicalizers are active. Add one if the compare payload needs normalization.',
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Source URL'), {
      target: { value: 'https://example.com/releases/latest' },
    });
    fireEvent.change(screen.getByLabelText('HTTP method'), {
      target: { value: 'GET' },
    });
    fireEvent.change(screen.getByLabelText('Timeout (ms)'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Timeout (ms)'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Accept header'), {
      target: { value: 'text/plain' },
    });
    fireEvent.change(screen.getByLabelText('User-Agent'), {
      target: { value: 'Dataarm QA' },
    });
    fireEvent.change(screen.getByLabelText('Redirect policy'), {
      target: { value: 'follow' },
    });
    fireEvent.change(screen.getByLabelText('CSS selector'), {
      target: { value: 'main article' },
    });

    const canonicalizerDraft = {
      ...httpDraft,
      compareCanonicalizers: [{ kind: 'trim' as const, pattern: null, flags: [] }],
    };
    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'http',
          draftSession: { draft: canonicalizerDraft, contractSeed: {} },
          guidedDraft: canonicalizerDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          setDraftField,
          setDraftKind,
          setSelectionKind,
          setSelectionMatch,
          updateCanonicalizer,
          removeCanonicalizer,
          addCanonicalizer,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText('Canonicalizer 1 kind'), {
      target: { value: 'strip_regex' },
    });

    const fallbackDraft = {
      ...guidedFileDraft,
      enabled: false,
      kind: 'http' as const,
      fetchMethod: null,
      fetchTimeoutMs: 15000,
      fetchUserAgent: null,
      fetchFollowRedirects: false,
      fetchAccept: null,
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: true,
      selectionIncludeEnd: true,
      compareBasis: 'inner_html' as const,
      compareWhitespace: null,
      compareRewriteUrls: true,
      compareCanonicalizers: [],
    };
    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'http',
          draftSession: { draft: fallbackDraft, contractSeed: {} },
          guidedDraft: fallbackDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
        })}
      />,
    );

    expect(screen.queryByLabelText('Whitespace policy')).toBeNull();

    const nullWhitespaceDraft = {
      ...fallbackDraft,
      compareBasis: 'text' as const,
      compareWhitespace: null,
    };
    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'http',
          draftSession: { draft: nullWhitespaceDraft, contractSeed: {} },
          guidedDraft: nullWhitespaceDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
        })}
      />,
    );

    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'existing',
          draftSession: null,
          guidedDraft: null,
          repairMode: false,
          draftToml: 'target_id = "repair_watch"\n',
          loadingTarget: true,
          setDraftToml,
        })}
      />,
    );

    expect(screen.getByText('Guided editing is unavailable for this target.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Target TOML editor'), {
      target: { value: 'target_id = "repair_watch"\n[target]\nkind = "file"\n' },
    });
    expect(setDraftToml).toHaveBeenCalled();

    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'existing',
          draftSession: null,
          guidedDraft: null,
          repairMode: true,
          draftToml: 'target_id = "repair_watch"\n',
          loadingTarget: false,
          setDraftToml,
        })}
      />,
    );

    expect(screen.getByLabelText('Target TOML editor').getAttribute('placeholder')).toBeNull();

    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'release_digest',
            targetId: 'release_digest',
            displayName: 'Release digest',
          }),
          dirty: false,
          hasUnsavedWork: false,
          draftSession: baseDocument.guidedSession,
          guidedDraft: baseDocument.guidedSession.draft,
          repairMode: false,
          handlePreview,
          handleSave,
          handleRunSelectedTarget,
          handleResetDraft,
          handleOpenSelectedTargetPath,
          handleDeleteSelectedTarget,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run target' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    expect(screen.getByRole('button', { name: 'Run target' }).getAttribute('title')).toBeNull();
    expect(handleRunSelectedTarget).toHaveBeenCalledTimes(1);
    expect(handleOpenSelectedTargetPath).toHaveBeenCalledTimes(1);
    expect(handleDeleteSelectedTarget).toHaveBeenCalledTimes(1);

    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'release_digest',
            targetId: 'release_digest',
            displayName: 'Release digest',
          }),
          dirty: true,
          hasUnsavedWork: true,
          draftSession: baseDocument.guidedSession,
          guidedDraft: baseDocument.guidedSession.draft,
          repairMode: false,
          handleResetDraft,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset draft' }));
    expect(handleResetDraft).toHaveBeenCalledTimes(1);
  });

  it('covers search, grouping, and every filter branch in the target table', () => {
    const handleSelectTarget = vi.fn();
    const setSearchQuery = vi.fn();
    const setGroupBy = vi.fn();
    const targets = [
      makeTarget({
        directoryName: 'release-http',
        targetId: 'release_http',
        displayName: 'Release HTTP',
        sourceKind: 'http',
        sourceLocator: 'https://example.com/releases',
        selectionLabel: 'main article',
        compareBasis: 'inner_html',
        statusKind: 'changed',
        lastRunOutcome: 'changed',
      }),
      makeTarget({
        directoryName: 'release-http-duplicate',
        targetId: 'release_http_duplicate',
        displayName: 'Release HTTP duplicate',
        sourceKind: 'http',
        sourceLocator: 'https://example.com/releases/duplicate',
        selectionLabel: 'main article',
        compareBasis: 'outer_html',
        statusKind: 'changed',
        lastRunOutcome: 'changed',
      }),
      makeTarget({
        directoryName: 'release-file',
        targetId: 'release_file',
        displayName: 'Release file',
        sourceKind: 'file',
        sourceLocator: '/tmp/dataarm/release.html',
        statusKind: 'ready',
        lastRunOutcome: 'unchanged',
      }),
      makeTarget({
        directoryName: 'release-pending',
        targetId: 'release_pending',
        displayName: 'Release pending',
        sourceKind: 'file',
        sourceLocator: '/tmp/dataarm/pending.html',
        statusKind: 'pending',
        lastRunOutcome: null,
        lastRunAt: null,
      }),
      makeTarget({
        directoryName: 'release-alert',
        targetId: 'release_alert',
        displayName: 'Release alert',
        sourceKind: 'http',
        sourceLocator: 'https://example.com/error',
        statusKind: 'failed_transient',
        lastRunOutcome: null,
        errorMessage: 'Fetch failed',
      }),
    ];

    const { rerender } = render(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
          handleSelectTarget,
        })}
        filterView="all"
        groupBy="status"
        setGroupBy={setGroupBy}
        searchQuery=""
        setSearchQuery={setSearchQuery}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search targets'), {
      target: { value: 'release' },
    });
    fireEvent.change(screen.getByLabelText('Group targets'), {
      target: { value: 'none' },
    });
    fireEvent.click(
      screen.getByText('Release file').closest('tr') ?? screen.getByText('Release file'),
    );
    fireEvent.keyDown(
      screen.getByText('Release HTTP').closest('tr') ?? screen.getByText('Release HTTP'),
      { key: 'Enter' },
    );
    fireEvent.keyDown(
      screen.getByText('Release pending').closest('tr') ?? screen.getByText('Release pending'),
      { key: ' ' },
    );
    fireEvent.keyDown(
      screen.getByText('Release alert').closest('tr') ?? screen.getByText('Release alert'),
      { key: 'Escape' },
    );

    expect(screen.getAllByText('Changed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('First run').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
    expect(setSearchQuery).toHaveBeenCalledWith('release');
    expect(setGroupBy).toHaveBeenCalledWith('none');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-file');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-http');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-pending');

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
        })}
        filterView="http"
        groupBy="source_kind"
        searchQuery=""
      />,
    );
    expect(screen.getByText('HTTP source')).toBeTruthy();
    expect(screen.queryByText('Release file')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[1] ?? null,
        })}
        filterView="file"
        groupBy="source_kind"
        searchQuery=""
      />,
    );
    expect(screen.getByText('File source')).toBeTruthy();
    expect(screen.queryByText('Release alert')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[2] ?? null,
        })}
        filterView="never_run"
        groupBy="none"
        searchQuery=""
      />,
    );
    expect(screen.getByText('Release pending')).toBeTruthy();
    expect(screen.queryByText('Release HTTP')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[3] ?? null,
        })}
        filterView="attention"
        groupBy="status"
        searchQuery=""
      />,
    );
    expect(screen.getByText('Fetch failed')).toBeTruthy();
    expect(screen.queryByText('Release file')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
        })}
        filterView="all"
        groupBy="none"
        searchQuery="does-not-exist"
      />,
    );
    expect(screen.getByText('No targets match this search.')).toBeTruthy();
  });
});
