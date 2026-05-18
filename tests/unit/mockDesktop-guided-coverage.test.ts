async function loadMockDesktop() {
  vi.resetModules();
  return import('../../src/lib/mockDesktop');
}

describe('mock desktop guided coverage', () => {
  it('serializes guided draft sessions across preview and save contracts', async () => {
    const mockDesktop = await loadMockDesktop();
    await mockDesktop.bootstrapMock();

    const httpPreview = await mockDesktop.previewTargetMock({
      draftSession: {
        contractSeed: {},
        draft: {
          kind: 'http',
          targetId: 'release_digest',
          displayName: 'Release digest',
          enabled: true,
          sourceLocator: 'https://example.com/releases',
          fetchMethod: 'GET',
          fetchTimeoutMs: 20000,
          fetchMaxBytes: 4096,
          fetchUserAgent: 'Dataarm QA',
          fetchFollowRedirects: false,
          fetchAccept: 'text/html',
          selectionKind: 'delimiter_pair',
          selectionMatch: 'nth',
          selectionIndex: 2,
          selectionSelector: null,
          selectionStart: '<main>',
          selectionEnd: '</main>',
          selectionDelimiterMode: 'regex',
          selectionIncludeStart: true,
          selectionIncludeEnd: true,
          selectionRegexFlags: ['case_insensitive'],
          compareBasis: 'outer_html',
          compareWhitespace: null,
          compareRewriteUrls: true,
          compareCanonicalizers: [
            {
              kind: 'strip_regex',
              pattern: 'Status:',
              flags: ['multi_line'],
            },
          ],
          storageHistoryLimit: 8,
        },
      },
    });

    expect(httpPreview.canonicalToml).toContain('source_url = "https://example.com/releases"');
    expect(httpPreview.canonicalToml).toContain('method = "GET"');
    expect(httpPreview.canonicalToml).toContain('timeout_ms = 20000');
    expect(httpPreview.canonicalToml).toContain('follow_redirects = false');
    expect(httpPreview.canonicalToml).toContain('flags = ["case_insensitive"]');
    expect(httpPreview.canonicalToml).toContain('pattern = "Status:"');
    expect(httpPreview.canonicalToml).toContain('flags = ["multi_line"]');
    expect(httpPreview.previewSnapshot?.compareText).toContain(
      '<article class="preview-fragment">',
    );
    expect(httpPreview.previewSnapshot?.extractionRecord).toMatchObject({
      compare_basis: 'outer_html',
      selection_kind: 'delimiter_pair',
      selection_match: 'nth',
      selection_evidence: {
        kind: 'delimiter_pair',
        include_start: true,
        include_end: true,
      },
    });

    const saved = await mockDesktop.saveTargetMock({
      draftSession: {
        contractSeed: {},
        draft: {
          kind: 'file',
          targetId: 'release_snapshot',
          displayName: 'Release snapshot',
          enabled: false,
          sourceLocator: '/tmp/dataarm/release-snapshot.html',
          fetchMethod: null,
          fetchTimeoutMs: null,
          fetchMaxBytes: 2048,
          fetchUserAgent: null,
          fetchFollowRedirects: null,
          fetchAccept: null,
          selectionKind: 'css_selector',
          selectionMatch: 'nth',
          selectionIndex: null,
          selectionSelector: '.release-card',
          selectionStart: null,
          selectionEnd: null,
          selectionDelimiterMode: null,
          selectionIncludeStart: null,
          selectionIncludeEnd: null,
          selectionRegexFlags: [],
          compareBasis: 'inner_html',
          compareWhitespace: 'normalize',
          compareRewriteUrls: false,
          compareCanonicalizers: [],
          storageHistoryLimit: 3,
        },
      },
    });

    const summary = saved.workspace.targets.find(
      (target) => target.directoryName === 'release_snapshot',
    );
    expect(summary).toMatchObject({
      sourceKind: 'file',
      sourceLocator: '/tmp/dataarm/release-snapshot.html',
      selectionLabel: '.release-card (nth 1)',
      compareBasis: 'inner_html',
    });
  });

  it('covers parse fallbacks, raw parse failures, and helper defaults', async () => {
    const mockDesktop = await loadMockDesktop();
    const internal = mockDesktop.__mockDesktopInternals;

    expect(internal.mockStateDocument('alpha', 'never_succeeded', null, null)).toMatchObject({
      baseline_phase: 'never_succeeded',
      baseline: { kind: 'pending' },
      last_run: null,
    });

    const rawWithoutDisplayName = [
      'schema_name = "ffhn.target"',
      'schema_version = 4',
      'this line has no separator',
      'target_id = "fallback_name"',
      '[target]',
      'kind = "file"',
      'file_path = "/tmp/dataarm/fallback.html"',
      '[selection]',
      'kind = "delimiter_pair"',
      'start = "<main>"',
      'end = "</main>"',
      'match = "nth"',
      'index = 4',
      'flags = []',
      '[compare]',
      'basis = "mystery"',
    ].join('\n');

    expect(internal.parseDisplayName(rawWithoutDisplayName)).toBe('fallback_name');
    expect(internal.parseSourceKind('target_id = "x"\n[target]\nkind = "unknown"\n')).toBeNull();
    expect(internal.parseSourceLocator('target_id = "x"\n')).toBe('Unknown source');
    expect(internal.parseSelectionLabel(rawWithoutDisplayName)).toBe('<main> ... </main> (nth 4)');
    expect(
      internal.parseSelectionLabel('[selection]\nkind = "css_selector"\nmatch = "single"\n'),
    ).toBe('Selection preview unavailable');
    expect(
      internal.parseSelectionLabel(
        '[selection]\nkind = "delimiter_pair"\nstart = "<main>"\nend = "</main>"\nmatch = "single"\nflags = ["case_insensitive"]\n',
      ),
    ).toBe('<main> ... </main> (single)');
    expect(internal.parseCompareBasis(rawWithoutDisplayName)).toBe('text');

    await expect(
      mockDesktop.previewTargetMock({
        rawToml: [
          'target_id = "broken_kind"',
          '[target]',
          'kind = "broken"',
          '[selection]',
          'kind = "css_selector"',
          'selector = "main"',
          '[compare]',
          'basis = "text"',
        ].join('\n'),
      }),
    ).rejects.toThrow('target.kind must be http or file.');

    await expect(
      mockDesktop.previewTargetMock({
        rawToml: [
          'target_id = "broken_selection"',
          '[target]',
          'kind = "file"',
          'file_path = "/tmp/dataarm/source.html"',
          '[selection]',
          'kind = "broken"',
          '[compare]',
          'basis = "text"',
        ].join('\n'),
      }),
    ).rejects.toThrow('selection.kind must be css_selector or delimiter_pair.');

    await expect(
      mockDesktop.previewTargetMock({
        rawToml: [
          'target_id = "broken_compare"',
          '[target]',
          'kind = "file"',
          'file_path = "/tmp/dataarm/source.html"',
          '[selection]',
          'kind = "css_selector"',
          'selector = "main"',
          '[compare]',
          'basis = "broken"',
        ].join('\n'),
      }),
    ).rejects.toThrow('compare.basis must be text, inner_html, or outer_html.');

    expect(() => internal.parseDirectoryName('display_name = "Missing ID"\n')).toThrow(
      'target_id is required.',
    );
  });

  it('exposes the mock projection helpers directly so the tolerant contract stays explicit', async () => {
    const mockDesktop = await loadMockDesktop();
    const internal = mockDesktop.__mockDesktopInternals;

    expect(internal.parseMockScalar('[]')).toEqual([]);
    expect(internal.parseMockScalar('["case_insensitive", "multi_line"]')).toEqual([
      'case_insensitive',
      'multi_line',
    ]);
    expect(internal.parseMockScalar('bare_token')).toBe('bare_token');

    const selectorSession = internal.sessionFromRawToml(
      [
        'schema_name = "ffhn.target"',
        'schema_version = 4',
        'target_id = "selector_watch"',
        '[target]',
        'kind = "http"',
        'source_url = "https://example.com/source"',
        '[selection]',
        'kind = "css_selector"',
        'match = "nth"',
        '[compare]',
        'basis = "text"',
      ].join('\n'),
    );
    expect(internal.selectionLabelFromDraft(selectorSession.draft)).toBe('selector (nth 1)');
    expect(internal.compareArtifactFromDraft(selectorSession.draft)).toContain('selector (nth 1)');
    expect(internal.previewSelectionEvidenceFromDraft(selectorSession.draft)).toMatchObject({
      kind: 'css_selector',
      path: 'main',
    });

    const delimiterSession = internal.sessionFromRawToml(
      [
        'schema_name = "ffhn.target"',
        'schema_version = 4',
        'target_id = "delimiter_watch"',
        'display_name = "Delimiter watch"',
        '[target]',
        'kind = "file"',
        'file_path = "/tmp/dataarm/delimiter.html"',
        '[fetch]',
        'engine = "file"',
        'max_bytes = 2048',
        '[selection]',
        'kind = "delimiter_pair"',
        'start = "<main>"',
        'end = "</main>"',
        'match = "nth"',
        'index = 3',
        'mode = "regex"',
        'include_start = true',
        'include_end = true',
        'flags = ["case_insensitive"]',
        '[compare]',
        'basis = "inner_html"',
        'rewrite_urls = true',
        '[[compare.canonicalization]]',
        'kind = "strip_regex"',
        'pattern = "Status:"',
        'flags = ["multi_line"]',
      ].join('\n'),
    );
    expect(delimiterSession.draft.selectionRegexFlags).toEqual(['case_insensitive']);
    expect(delimiterSession.draft.compareCanonicalizers).toEqual([
      {
        kind: 'strip_regex',
        pattern: 'Status:',
        flags: ['multi_line'],
      },
    ]);
    expect(internal.selectionLabelFromDraft(delimiterSession.draft)).toBe(
      '<main> ... </main> (nth 3)',
    );
    expect(internal.compareArtifactFromDraft(delimiterSession.draft)).toBe(
      '<h1>Delimiter watch</h1><p>/tmp/dataarm/delimiter.html</p>',
    );
    expect(internal.previewOuterHtmlFromDraft(delimiterSession.draft)).toContain(
      '<p class="preview-selection"><main> ... </main></p>',
    );
    expect(internal.previewSelectionEvidenceFromDraft(delimiterSession.draft)).toMatchObject({
      kind: 'delimiter_pair',
      include_start: true,
      include_end: true,
    });

    const serializedHttp = internal.serializeDraftSession({
      contractSeed: {},
      draft: {
        ...selectorSession.draft,
        enabled: false,
        sourceLocator: 'https://example.com/serialized',
        selectionIndex: 1,
        fetchMethod: null,
        fetchTimeoutMs: null,
        fetchMaxBytes: 2048,
        fetchUserAgent: null,
        fetchFollowRedirects: null,
        fetchAccept: null,
        compareWhitespace: null,
        compareCanonicalizers: [],
      },
    });
    expect(serializedHttp).toContain('method = "GET"');
    expect(serializedHttp).toContain('timeout_ms = 15000');
    expect(serializedHttp).toContain('user_agent = "dataarm/template"');
    expect(serializedHttp).toContain('follow_redirects = true');
    expect(serializedHttp).toContain('accept = "text/html,application/xhtml+xml"');
    expect(serializedHttp).toContain('selector = "main"');
    expect(serializedHttp).toContain('index = 1');
    expect(serializedHttp).toContain('whitespace = "normalize"');

    const serializedDelimiter = internal.serializeDraftSession({
      contractSeed: {},
      draft: {
        ...delimiterSession.draft,
        selectionStart: null,
        selectionEnd: null,
        selectionDelimiterMode: null,
        selectionIncludeStart: null,
        selectionIncludeEnd: null,
      },
    });
    expect(serializedDelimiter).toContain('start = "<main>"');
    expect(serializedDelimiter).toContain('end = "</main>"');
    expect(serializedDelimiter).toContain('mode = "literal"');
    expect(serializedDelimiter).toContain('include_start = false');
    expect(serializedDelimiter).toContain('include_end = false');

    const defaultedSession = internal.sessionFromRawToml(
      [
        'schema_name = "ffhn.target"',
        'schema_version = 4',
        'target_id = "defaulted_watch"',
        '[target]',
        'kind = "file"',
        '[selection]',
        'kind = "delimiter_pair"',
        '[compare]',
        'basis = "text"',
        '[[compare.canonicalization]]',
      ].join('\n'),
    );
    expect(defaultedSession.draft.sourceLocator).toBe('');
    expect(defaultedSession.draft.selectionMatch).toBe('single');
    expect(defaultedSession.draft.compareCanonicalizers).toEqual([
      { kind: 'trim', pattern: null, flags: [] },
    ]);
    const serializedDefaultedDelimiter = internal.serializeDraftSession({
      contractSeed: {},
      draft: {
        ...defaultedSession.draft,
        selectionRegexFlags: [],
      },
    });
    expect(serializedDefaultedDelimiter).not.toContain('flags = [');
    const previewSnapshot = internal.buildPreviewSnapshot({
      ...selectorSession.draft,
      compareBasis: 'text',
      selectionSelector: null,
    });
    expect(previewSnapshot.compareText).toContain('selector (nth 1)');
    expect(
      internal.selectionLabelFromDraft({
        ...defaultedSession.draft,
        selectionMatch: 'single',
      }),
    ).toBe('start ... end (single)');
    expect(
      internal.selectionLabelFromDraft({
        ...defaultedSession.draft,
        selectionMatch: 'nth',
        selectionIndex: null,
      }),
    ).toBe('start ... end (nth 1)');
    expect(internal.previewOuterHtmlFromDraft(defaultedSession.draft)).toContain(
      '<p class="preview-selection">start ... end</p>',
    );
    expect(internal.previewSelectionEvidenceFromDraft(defaultedSession.draft)).toMatchObject({
      kind: 'delimiter_pair',
      include_start: false,
      include_end: false,
    });

    expect(
      internal.parseSelectionLabel(
        '[selection]\nkind = "delimiter_pair"\nstart = "<main>"\nmatch = "single"\n',
      ),
    ).toBe('Selection preview unavailable');
    expect(
      internal.parseSelectionLabel(
        '[selection]\nkind = "delimiter_pair"\nstart = "<main>"\nend = "</main>"\nmatch = "nth"\n',
      ),
    ).toBe('<main> ... </main> (nth 1)');

    await expect(mockDesktop.previewTargetMock({})).rejects.toThrow('target_id is required.');
    await expect(mockDesktop.saveTargetMock({})).rejects.toThrow('target_id is required.');
  });
});
