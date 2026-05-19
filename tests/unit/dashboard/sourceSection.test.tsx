import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SourceSection } from '../../../src/components/dashboard/targetEditor/SourceSection';
import type * as SourceSectionHelpers from '../../../src/components/dashboard/targetEditor/sourceSection.helpers';
import { makeDashboardState, makeDocument } from '../fixtures';

const { inspectSource } = vi.hoisted(() => ({
  inspectSource: vi.fn(),
}));
const { highlightSelected, selectionFromPreviewPoint } = vi.hoisted(() => ({
  highlightSelected: vi.fn(),
  selectionFromPreviewPoint: vi.fn(),
}));

vi.mock('../../../src/lib/api', () => ({
  inspectSource,
}));
vi.mock('../../../src/components/dashboard/targetEditor/sourceSection.helpers', async () => {
  const actual = await vi.importActual<typeof SourceSectionHelpers>(
    '../../../src/components/dashboard/targetEditor/sourceSection.helpers',
  );
  return {
    ...actual,
    highlightSelected,
    selectionFromPreviewPoint,
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  inspectSource.mockReset();
  highlightSelected.mockReset();
  selectionFromPreviewPoint.mockReset();
});

function makeState(overrides: Partial<ReturnType<typeof makeDashboardState>> = {}) {
  const setDraftField = vi.fn();
  const setDraftKind = vi.fn();
  const setSelectionKind = vi.fn();
  const setSelectionMatch = vi.fn();
  const applyPreviewSelection = vi.fn();
  return {
    state: makeDashboardState({
      setDraftField,
      setDraftKind,
      setSelectionKind,
      setSelectionMatch,
      applyPreviewSelection,
      ...overrides,
    }),
    setDraftField,
    setDraftKind,
    setSelectionKind,
    setSelectionMatch,
    applyPreviewSelection,
  };
}

function makeDraft(kind: 'http' | 'file') {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }
  return {
    ...document.guidedSession.draft,
    kind,
    sourceLocator: kind === 'http' ? 'https://example.com/releases' : '/tmp/dataarm/releases.html',
    fetchMethod: kind === 'http' ? 'GET' : null,
    fetchTimeoutMs: kind === 'http' ? 15000 : null,
    fetchUserAgent: kind === 'http' ? 'dataarm/template' : null,
    fetchFollowRedirects: kind === 'http' ? true : null,
    fetchAccept: kind === 'http' ? 'text/html,application/xhtml+xml' : null,
    selectionSelector: null,
  };
}

describe('SourceSection', () => {
  it('edits the local-file source path without exposing browser-only controls', () => {
    const draft = makeDraft('file');
    const { state, setDraftField, setDraftKind } = makeState();

    render(<SourceSection draft={draft} state={state} />);

    expect(screen.queryByText('Visual section picker')).toBeNull();

    fireEvent.change(screen.getByLabelText('Watch type'), {
      target: { value: 'http' },
    });
    fireEvent.change(screen.getByLabelText('File path'), {
      target: { value: '/tmp/dataarm/releases-2.html' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show advanced page settings' }));
    fireEvent.change(screen.getByLabelText('Maximum page size'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Maximum page size'), {
      target: { value: '4096' },
    });

    expect(setDraftKind).toHaveBeenCalledWith('http');
    expect(setDraftField).toHaveBeenCalledWith('sourceLocator', '/tmp/dataarm/releases-2.html');
    expect(setDraftField).toHaveBeenCalledWith('fetchMaxBytes', 1);
    expect(setDraftField).toHaveBeenCalledWith('fetchMaxBytes', 4096);
  });

  it('loads a page preview through the backend and exposes the preview metadata in the editor', async () => {
    const draft = makeDraft('http');
    const { state, setDraftField, applyPreviewSelection } = makeState();
    const previewDocument = document.implementation.createHTMLDocument('preview');
    inspectSource.mockResolvedValue({
      finalUrl: null,
      contentType: null,
      html: '<!doctype html><html><body><main><article id="release-card"><span>Fresh release note</span></article></main></body></html>',
    });

    render(<SourceSection draft={draft} state={state} />);

    fireEvent.change(screen.getByLabelText('Page URL'), {
      target: { value: 'https://example.com/releases/latest' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show advanced page settings' }));
    fireEvent.change(screen.getByLabelText('Browser identity'), {
      target: { value: 'Dataarm test agent' },
    });
    fireEvent.change(screen.getByLabelText('Timeout (ms)'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Timeout (ms)'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Redirects'), {
      target: { value: 'strict' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load page preview' }));

    await waitFor(() => {
      expect(inspectSource).toHaveBeenCalledWith({
        kind: 'http',
        sourceLocator: 'https://example.com/releases',
        fetchMethod: 'GET',
        fetchTimeoutMs: 15000,
        fetchUserAgent: 'dataarm/template',
        fetchFollowRedirects: true,
        fetchAccept: 'text/html,application/xhtml+xml',
      });
    });

    expect(setDraftField).toHaveBeenCalledWith(
      'sourceLocator',
      'https://example.com/releases/latest',
    );
    expect(setDraftField).toHaveBeenCalledWith('fetchUserAgent', 'Dataarm test agent');
    expect(setDraftField).toHaveBeenCalledWith('fetchTimeoutMs', 1000);
    expect(setDraftField).toHaveBeenCalledWith('fetchTimeoutMs', 25000);
    expect(setDraftField).toHaveBeenCalledWith('fetchFollowRedirects', false);

    await waitFor(() => {
      expect(screen.getByText('Loaded URL')).toBeTruthy();
      expect(screen.getByText('https://example.com/releases')).toBeTruthy();
      expect(screen.getByText('Unknown')).toBeTruthy();
      expect(screen.getByTitle('Page preview')).toBeTruthy();
    });

    selectionFromPreviewPoint.mockReturnValue({
      doc: previewDocument,
      trail: ['article#release-card > span.headline', 'article#release-card', 'body > main'],
      selectedSelector: 'article#release-card > span.headline',
      selectedText: 'Fresh release note',
    } satisfies SourceSectionHelpers.PreviewSelection);

    fireEvent.click(screen.getByLabelText('Preview picker overlay'), {
      clientX: 120,
      clientY: 80,
    });

    expect(selectionFromPreviewPoint).toHaveBeenCalled();
    expect(applyPreviewSelection).toHaveBeenCalledWith('article#release-card > span.headline');
    expect(highlightSelected).toHaveBeenCalledWith(
      previewDocument,
      'article#release-card > span.headline',
    );
    expect(screen.getByText('Fresh release note')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose smaller section' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Choose parent' })).toHaveProperty('disabled', false);

    fireEvent.click(screen.getByRole('button', { name: 'Choose parent' }));
    expect(setDraftField).toHaveBeenCalledWith('selectionSelector', 'article#release-card');
    expect(screen.getByRole('button', { name: 'Choose parent' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Choose smaller section' })).toHaveProperty(
      'disabled',
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose parent' }));
    expect(setDraftField).toHaveBeenCalledWith('selectionSelector', 'body > main');
    expect(screen.getByRole('button', { name: 'Choose parent' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Choose smaller section' }));
    expect(setDraftField).toHaveBeenCalledWith('selectionSelector', 'article#release-card');
    fireEvent.click(screen.getByRole('button', { name: 'Choose smaller section' }));
    expect(setDraftField).toHaveBeenCalledWith(
      'selectionSelector',
      'article#release-card > span.headline',
    );
    expect(screen.getByRole('button', { name: 'Choose smaller section' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('surfaces loading and backend errors while keeping the picker contract explicit', async () => {
    const draft = makeDraft('http');
    const { state } = makeState();
    let rejectInspection: ((error: unknown) => void) | undefined;
    inspectSource.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectInspection = reject;
        }),
    );

    render(<SourceSection draft={draft} state={state} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load page preview' }));
    expect(screen.getByText('Loading the page preview…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Loading page…' })).toBeTruthy();

    if (!rejectInspection) {
      throw new Error('Expected a pending inspection request.');
    }
    rejectInspection('Preview bridge failed');

    await waitFor(() => {
      expect(screen.getByText('Preview bridge failed')).toBeTruthy();
    });
  });

  it('surfaces structured Error objects from the preview bridge', async () => {
    const draft = makeDraft('http');
    const { state } = makeState();
    inspectSource.mockRejectedValue(new Error('Structured preview failure'));

    render(<SourceSection draft={draft} state={state} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load page preview' }));

    await waitFor(() => {
      expect(screen.getByText('Structured preview failure')).toBeTruthy();
    });
  });

  it('keeps the preview usable when the overlay cannot resolve a clicked element', async () => {
    const draft = makeDraft('http');
    const { state, applyPreviewSelection } = makeState();
    selectionFromPreviewPoint.mockReturnValue(null);
    inspectSource.mockResolvedValue({
      finalUrl: 'https://example.com/releases',
      contentType: 'text/html',
      html: '<!doctype html><html><body><main><article>Release</article></main></body></html>',
    });

    render(<SourceSection draft={draft} state={state} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load page preview' }));

    await waitFor(() => {
      expect(screen.getByTitle('Page preview')).toBeTruthy();
    });
    expect(screen.getByText('https://example.com/releases')).toBeTruthy();
    expect(screen.getByText('text/html')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Preview picker overlay'), {
      clientX: 16,
      clientY: 16,
    });
    expect(applyPreviewSelection).not.toHaveBeenCalled();
  });
});
