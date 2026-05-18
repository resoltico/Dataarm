import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TargetEditor } from '../../../src/components/dashboard/TargetEditor';
import { makeDashboardState, makeDocument, makeTarget } from '../fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeEditorSpies() {
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

  return {
    setDraftField,
    setDraftKind,
    setSelectionKind,
    setSelectionMatch,
    updateCanonicalizer,
    removeCanonicalizer: vi.fn(),
    addCanonicalizer: vi.fn(),
    setDraftToml: vi.fn(),
    handlePreview: vi.fn(),
    handleSave: vi.fn(),
    handleRunSelectedTarget: vi.fn(),
    handleResetDraft: vi.fn(),
    handleOpenSelectedTargetPath: vi.fn(),
    handleDeleteSelectedTarget: vi.fn(),
  };
}

function makeGuidedFileDraft() {
  const baseDocument = makeDocument();
  return {
    baseDocument,
    draft: {
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
    },
  };
}

describe('TargetEditor', () => {
  it('wires guided file authoring controls to the state surface', () => {
    const { draft } = makeGuidedFileDraft();
    const spies = makeEditorSpies();

    render(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'file',
          draftSession: {
            draft,
            contractSeedToml: 'schema_name = "ffhn.target"\n',
          },
          guidedDraft: draft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          ...spies,
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

    expect(spies.setDraftField).toHaveBeenCalled();
    expect(spies.setDraftKind).toHaveBeenCalledWith('http');
    expect(spies.setSelectionKind).toHaveBeenCalledWith('css_selector');
    expect(spies.setSelectionMatch).toHaveBeenCalledWith('single');
    expect(spies.updateCanonicalizer).toHaveBeenCalled();
    expect(spies.removeCanonicalizer).toHaveBeenCalledWith(0);
    expect(spies.addCanonicalizer).toHaveBeenCalledTimes(1);
    expect(spies.handlePreview).toHaveBeenCalledTimes(1);
    expect(spies.handleSave).toHaveBeenCalledTimes(1);
  });

  it('renders http-specific and compare-specific branches without compatibility fallbacks', () => {
    const { draft } = makeGuidedFileDraft();
    const spies = makeEditorSpies();
    const httpDraft = {
      ...draft,
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

    const { rerender } = render(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: true,
          editorMode: 'http',
          draftSession: { draft: httpDraft, contractSeedToml: 'schema_name = "ffhn.target"\n' },
          guidedDraft: httpDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          ...spies,
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
          draftSession: {
            draft: canonicalizerDraft,
            contractSeedToml: 'schema_name = "ffhn.target"\n',
          },
          guidedDraft: canonicalizerDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
          dirty: true,
          ...spies,
        })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Canonicalizer 1 kind'), {
      target: { value: 'strip_regex' },
    });

    const noWhitespaceDraft = {
      ...httpDraft,
      enabled: false,
      fetchMethod: null,
      fetchTimeoutMs: 15000,
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
          draftSession: {
            draft: noWhitespaceDraft,
            contractSeedToml: 'schema_name = "ffhn.target"\n',
          },
          guidedDraft: noWhitespaceDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
        })}
      />,
    );

    expect(screen.queryByLabelText('Whitespace policy')).toBeNull();
  });

  it('supports repair mode and saved-target actions as separate workflows', () => {
    const { baseDocument } = makeGuidedFileDraft();
    const spies = makeEditorSpies();
    const { rerender } = render(
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
          setDraftToml: spies.setDraftToml,
        })}
      />,
    );

    expect(screen.getByText('Guided editing is unavailable for this target.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Target TOML editor'), {
      target: { value: 'target_id = "repair_watch"\n[target]\nkind = "file"\n' },
    });
    expect(spies.setDraftToml).toHaveBeenCalled();

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
          setDraftToml: spies.setDraftToml,
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
          handlePreview: spies.handlePreview,
          handleSave: spies.handleSave,
          handleRunSelectedTarget: spies.handleRunSelectedTarget,
          handleResetDraft: spies.handleResetDraft,
          handleOpenSelectedTargetPath: spies.handleOpenSelectedTargetPath,
          handleDeleteSelectedTarget: spies.handleDeleteSelectedTarget,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run target' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    expect(screen.getByRole('button', { name: 'Run target' }).getAttribute('title')).toBeNull();
    expect(spies.handleRunSelectedTarget).toHaveBeenCalledTimes(1);
    expect(spies.handleOpenSelectedTargetPath).toHaveBeenCalledTimes(1);
    expect(spies.handleDeleteSelectedTarget).toHaveBeenCalledTimes(1);

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
          handleResetDraft: spies.handleResetDraft,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset draft' }));
    expect(spies.handleResetDraft).toHaveBeenCalledTimes(1);
  });

  it('renders busy labels and saved-target run guidance without hidden fallback branches', () => {
    const { baseDocument } = makeGuidedFileDraft();

    const { rerender } = render(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'release_digest',
            targetId: 'release_digest',
            displayName: 'Release digest',
          }),
          preview: { loading: true, error: null, data: null },
          saving: true,
          draftSession: baseDocument.guidedSession,
          guidedDraft: baseDocument.guidedSession.draft,
          repairMode: false,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previewing…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();

    rerender(
      <TargetEditor
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'release_digest',
            targetId: 'release_digest',
            displayName: 'Release digest',
          }),
          loadingTarget: true,
          draftSession: baseDocument.guidedSession,
          guidedDraft: baseDocument.guidedSession.draft,
          repairMode: false,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Run target' }).getAttribute('title')).toBe(
      'Wait for the selected target to finish loading.',
    );

    const delimiterDraft = {
      ...baseDocument.guidedSession.draft,
      kind: 'http' as const,
      fetchMethod: null,
      fetchTimeoutMs: null,
      fetchUserAgent: null,
      fetchFollowRedirects: true,
      fetchAccept: null,
      selectionKind: 'delimiter_pair' as const,
      selectionMatch: 'single' as const,
      selectionIndex: null,
      selectionSelector: null,
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: true,
      selectionIncludeEnd: true,
      selectionRegexFlags: [],
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
          draftSession: {
            draft: delimiterDraft,
            contractSeedToml: 'schema_name = "ffhn.target"\n',
          },
          guidedDraft: delimiterDraft,
          repairMode: false,
          draftToml: 'target_id = "release_watch"\n',
        })}
      />,
    );

    expect(screen.getByLabelText<HTMLSelectElement>('HTTP method').value).toBe('GET');
    expect(screen.getByLabelText<HTMLSelectElement>('HTTP method').value).toBe('GET');
    expect(screen.getByLabelText<HTMLInputElement>('Timeout (ms)').value).toBe('15000');
    expect(screen.getByLabelText<HTMLInputElement>('Accept header').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('User-Agent').value).toBe('');
    expect(screen.getByLabelText<HTMLSelectElement>('Redirect policy').value).toBe('follow');
    expect(screen.getByLabelText<HTMLInputElement>('Start delimiter').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('End delimiter').value).toBe('');
    expect(screen.getByLabelText<HTMLSelectElement>('Delimiter mode').value).toBe('literal');
    expect(screen.getByLabelText<HTMLSelectElement>('Include start').value).toBe('true');
    expect(screen.getByLabelText<HTMLSelectElement>('Include end').value).toBe('true');
    expect(screen.getByLabelText<HTMLSelectElement>('Whitespace policy').value).toBe('normalize');
  });
});
