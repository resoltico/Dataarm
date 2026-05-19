import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SelectionSection } from '../../../src/components/dashboard/targetEditor/SelectionSection';
import { makeDashboardState, makeDocument } from '../fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeState(overrides: Partial<ReturnType<typeof makeDashboardState>> = {}) {
  const setDraftField = vi.fn();
  const setSelectionKind = vi.fn();
  const setSelectionMatch = vi.fn();
  return {
    state: makeDashboardState({
      setDraftField,
      setSelectionKind,
      setSelectionMatch,
      ...overrides,
    }),
    setDraftField,
    setSelectionKind,
    setSelectionMatch,
  };
}

function guidedDraftFixture() {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected the fixture document to include a guided session.');
  }
  return {
    document,
    guidedSession: document.guidedSession,
  };
}

describe('SelectionSection', () => {
  it('guides selector editing and surfaces validation states in user-facing language', () => {
    const { guidedSession } = guidedDraftFixture();
    const baseDraft = guidedSession.draft;
    const { state, setDraftField, setSelectionKind, setSelectionMatch } = makeState({
      preview: { loading: false, error: null, data: null },
    });

    const { rerender } = render(<SelectionSection draft={baseDraft} state={state} />);

    expect(
      screen.getByText(
        'Use “Check section” after choosing a section so Dataarm can confirm the match.',
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Selection method'), {
      target: { value: 'delimiter_pair' },
    });
    fireEvent.change(screen.getByLabelText('Selection match'), {
      target: { value: 'nth' },
    });
    expect(setSelectionKind).toHaveBeenCalledWith('delimiter_pair');
    expect(setSelectionMatch).toHaveBeenCalledWith('nth');

    const nthDraft = {
      ...baseDraft,
      selectionKind: 'delimiter_pair' as const,
      selectionMatch: 'nth' as const,
      selectionSelector: null,
    };
    rerender(<SelectionSection draft={nthDraft} state={state} />);

    fireEvent.change(screen.getByLabelText('Nth index (1-based)'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Start delimiter'), {
      target: { value: '<main>' },
    });
    fireEvent.change(screen.getByLabelText('End delimiter'), {
      target: { value: '</main>' },
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
    fireEvent.change(screen.getByLabelText('Regex flags'), {
      target: { value: 'case_insensitive, multi_line' },
    });

    expect(setDraftField).toHaveBeenCalledWith('selectionIndex', 1);
    expect(setDraftField).toHaveBeenCalledWith('selectionStart', '<main>');
    expect(setDraftField).toHaveBeenCalledWith('selectionEnd', '</main>');
    expect(setDraftField).toHaveBeenCalledWith('selectionDelimiterMode', 'regex');
    expect(setDraftField).toHaveBeenCalledWith('selectionIncludeStart', true);
    expect(setDraftField).toHaveBeenCalledWith('selectionIncludeEnd', true);
    expect(setDraftField).toHaveBeenCalledWith('selectionRegexFlags', [
      'case_insensitive',
      'multi_line',
    ]);

    rerender(
      <SelectionSection
        draft={baseDraft}
        state={makeDashboardState({
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_notes',
              displayName: 'Release notes',
              canonicalToml: 'target_id = "release_notes"\n',
              draftSession: guidedSession,
              statusReport: { schema_name: 'ffhn.status_report' },
              dryRunReport: {
                schema_name: 'ffhn.run_report',
                extraction: { candidateCount: 1 },
              },
              previewSnapshot: null,
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );
    expect(screen.getByText('Matched 1 section. This watch is ready to save.')).toBeTruthy();

    rerender(
      <SelectionSection
        draft={baseDraft}
        state={makeDashboardState({
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_notes',
              displayName: 'Release notes',
              canonicalToml: 'target_id = "release_notes"\n',
              draftSession: guidedSession,
              statusReport: { schema_name: 'ffhn.status_report' },
              dryRunReport: {
                schema_name: 'ffhn.run_report',
                extraction: { candidateCount: 14 },
              },
              previewSnapshot: null,
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );
    expect(screen.getByText(/Matched 14 sections\./)).toBeTruthy();
  });
});
