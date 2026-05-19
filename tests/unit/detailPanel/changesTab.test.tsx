import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailPanel } from '../../../src/components/dashboard/DetailPanel';
import { makeDashboardState, makeDocument, makeSnapshotArtifact, makeTarget } from '../fixtures';

function guidedSession() {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected fixture document to include a guided session.');
  }
  return document.guidedSession;
}

afterEach(() => {
  cleanup();
});

describe('DetailPanel changes tab', () => {
  it('renders draft titles, preview loading, preview errors, and preview results', () => {
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'http',
          detailTab: 'changes',
          preview: { loading: true, error: null, data: null },
        })}
      />,
    );

    expect(screen.getByText('Add watch')).toBeTruthy();
    expect(screen.getByText('Checking the page and selected section.')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'file',
          detailTab: 'changes',
          preview: { loading: false, error: 'Preview exploded', data: null },
        })}
      />,
    );
    expect(screen.getByText('Add local file watch')).toBeTruthy();
    expect(screen.getByText('Watch setup check failed')).toBeTruthy();
    expect(screen.getByText('Preview exploded')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'existing',
          detailTab: 'changes',
          preview: { loading: false, error: null, data: null },
          dirty: true,
        })}
      />,
    );
    expect(screen.getByText('Add watch')).toBeTruthy();
    expect(screen.getByText('Unsaved watch')).toBeTruthy();
    expect(
      screen.getByText(
        'Check this draft before saving so Dataarm can confirm the page and section.',
      ),
    ).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'http',
          detailTab: 'changes',
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: {
                ...guidedSession(),
                draft: {
                  ...guidedSession().draft,
                  sourceLocator: '',
                },
              },
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: {
                schema_name: 'ffhn.run_report',
                extraction: { candidate_count: 1 },
                result: { kind: 'initialized' },
              },
              previewSnapshot: makeSnapshotArtifact(),
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );

    expect(screen.getByText('Section ready')).toBeTruthy();
    expect(screen.getByText('Release digest')).toBeTruthy();
    expect(screen.getAllByText('Matched 1 section.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save watch' })).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'http',
          detailTab: 'changes',
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: guidedSession(),
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: {
                schema_name: 'ffhn.run_report',
                fetch: { final_url: 'http://127.0.0.1:9999/', http_status: null },
                result: {
                  kind: 'failed_transient',
                  cause: 'fetch_network_error',
                  error_detail: { message: 'io: Connection refused' },
                },
              },
              previewSnapshot: null,
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );

    expect(screen.getByText('Could not reach the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix watch setup' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save watch' })).toBeNull();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedDirectoryName: null,
          selectedTarget: null,
          editorMode: 'http',
          detailTab: 'changes',
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: guidedSession(),
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: {
                schema_name: 'ffhn.run_report',
                fetch: { final_url: 'https://example.com/missing', http_status: 500 },
                result: {
                  kind: 'failed_permanent',
                  cause: 'fetch_http_error',
                  error_detail: { message: 'HTTP 500' },
                },
              },
              previewSnapshot: null,
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );

    expect(screen.getByText('HTTP status')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
  });

  it('renders saved-target change states and reference history', () => {
    const handleRunSelectedTarget = vi.fn();
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: null,
          selectedDirectoryName: null,
          isDraftContext: false,
          detailTab: 'changes',
        })}
      />,
    );

    expect(screen.getByText('Select a watch to view its latest checks and changes.')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'never-run',
            displayName: 'Never run',
            lastRunOutcome: null,
            lastRunAt: null,
          }),
          selectedDirectoryName: 'never-run',
          detailTab: 'changes',
          handleRunSelectedTarget,
        })}
      />,
    );
    expect(screen.getByText('First check needed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check watch' }));
    expect(handleRunSelectedTarget).toHaveBeenCalledTimes(1);

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'release-notes',
            displayName: 'Release notes',
            statusKind: 'changed',
            lastRunOutcome: 'changed',
          }),
          selectedDirectoryName: 'release-notes',
          detailTab: 'changes',
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactIssues: ['Missing compare snapshot digest'],
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: makeSnapshotArtifact(),
                snapshotHistory: [
                  makeSnapshotArtifact({
                    slot: 'history',
                    capturedAt: '2026-05-14T11:30:00Z',
                    compareDigestSha256: 'digest-previous',
                  }),
                  makeSnapshotArtifact({
                    slot: 'history',
                    capturedAt: '2026-05-13T11:30:00Z',
                    compareDigestSha256: 'digest-older',
                    compareText: 'Older line\nShared',
                  }),
                ],
              },
            }),
          },
        })}
      />,
    );
    expect(screen.getByText('Content Changed')).toBeTruthy();
    expect(screen.getByText('Missing compare snapshot digest')).toBeTruthy();
    expect(screen.getByText('History timeline')).toBeTruthy();
    const historyButtons = screen.getAllByRole('button', { name: /2026/u });
    expect(historyButtons).toHaveLength(2);
    expect(historyButtons[0]?.className).toContain('history-pill-active');
    expect(historyButtons[1]?.className).not.toContain('history-pill-active');
    const secondHistoryButton = historyButtons[1];
    if (!secondHistoryButton) {
      throw new Error('Expected the second history snapshot button.');
    }
    fireEvent.click(secondHistoryButton);
    expect(screen.getByText('Comparing against')).toBeTruthy();
    expect(screen.getByText('Current saved text')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'initialized',
            displayName: 'Initialized',
            lastRunOutcome: 'initialized',
          }),
          selectedDirectoryName: 'initialized',
          detailTab: 'changes',
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: makeSnapshotArtifact(),
                snapshotHistory: [],
              },
            }),
          },
        })}
      />,
    );
    expect(screen.getByText('First Check Saved')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'unchanged',
            displayName: 'Unchanged',
            lastRunOutcome: 'unchanged',
          }),
          selectedDirectoryName: 'unchanged',
          detailTab: 'changes',
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactHistory: null,
            }),
          },
        })}
      />,
    );
    expect(screen.getByText('No Changes Detected')).toBeTruthy();
    expect(
      screen.getByText(
        'Dataarm has not saved a reference version yet. Check this watch once to start its history.',
      ),
    ).toBeTruthy();
  });

  it('surfaces running-state placeholders, preview artifact review, and unsupported outcomes', () => {
    const handleSave = vi.fn();
    const setDetailTab = vi.fn();
    const previewSnapshot = makeSnapshotArtifact({
      compareText: 'Current compare\nShared',
      extractionRecord: {
        selection_kind: '',
        selection_match: 7,
        compare_basis: null,
      },
    });

    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedTarget: null,
          selectedDirectoryName: null,
          detailTab: 'changes',
          handleSave,
          saving: false,
          setDetailTab,
          previewSnapshot,
          previewArtifactIssues: ['Preview artifact drift'],
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: guidedSession(),
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'initialized' } },
              previewSnapshot,
              previewArtifactIssues: ['Preview artifact drift'],
            },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save watch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review settings' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(setDetailTab).toHaveBeenCalledWith('config');
    expect(screen.getByText('Preview artifact drift')).toBeTruthy();

    const previewCompareButton = screen.getAllByRole('button', { name: 'Compare' })[0];
    if (!previewCompareButton) {
      throw new Error('Expected a preview compare button.');
    }
    fireEvent.click(previewCompareButton);
    expect(screen.getByText('Current saved text')).toBeTruthy();

    const previewExtractionButton = screen.getAllByRole('button', { name: 'Extraction' })[0];
    if (!previewExtractionButton) {
      throw new Error('Expected a preview extraction button.');
    }
    fireEvent.click(previewExtractionButton);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'changed-running',
            displayName: 'Changed running',
            lastRunOutcome: 'changed',
            sourceLocator: '/tmp/dataarm/running.html',
          }),
          selectedDirectoryName: 'changed-running',
          detailTab: 'changes',
          runningTarget: true,
          isBusy: true,
          hasUnsavedWork: true,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Checking watch…' }).getAttribute('title')).toBe(
      'Save or reset the draft first.',
    );

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'unsupported-card',
            displayName: 'Unsupported card',
            lastRunOutcome: 'surprising_status',
          }),
          selectedDirectoryName: 'unsupported-card',
          detailTab: 'changes',
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Check watch' })).toBeNull();
  });

  it('renders saving, running, and null-metadata fallback states honestly', () => {
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedTarget: null,
          selectedDirectoryName: null,
          detailTab: 'changes',
          saving: true,
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: guidedSession(),
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'initialized' } },
              previewSnapshot: makeSnapshotArtifact(),
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'running-first-baseline',
            displayName: 'Running first baseline',
            lastRunOutcome: null,
            lastRunAt: null,
            sourceLocator: null,
            selectionLabel: null,
            compareBasis: null,
            targetId: null,
          }),
          selectedDirectoryName: 'running-first-baseline',
          detailTab: 'changes',
          runningTarget: true,
          isBusy: true,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Checking watch…' })).toBeTruthy();
    expect(screen.getByText('Page')).toBeTruthy();
    expect(screen.getByText('Section')).toBeTruthy();
    expect(screen.getByText('Compare using')).toBeTruthy();
    expect(screen.getByText('Alerts')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows extraction metadata from saved history without falling back to placeholder copy', () => {
    const historySnapshot = makeSnapshotArtifact({
      extractionRecord: {
        selection_kind: 'css_selector',
        selection_match: 'single',
        selected_candidate_index: 2,
        candidate_count: 3,
        compare_basis: 'text',
      },
    });

    render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'changes',
          selectedDirectoryName: 'release_digest',
          selectedTarget: makeDashboardState().selectedTarget,
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: historySnapshot,
                snapshotHistory: [makeSnapshotArtifact()],
              },
            }),
          },
        })}
      />,
    );

    const historyExtractionButton = screen.getAllByRole('button', { name: 'Extraction' })[0];
    if (!historyExtractionButton) {
      throw new Error('Expected a history extraction button.');
    }
    fireEvent.click(historyExtractionButton);
    expect(screen.getByText('css_selector')).toBeTruthy();
    expect(screen.getByText('single')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getAllByText('text').length).toBeGreaterThan(0);
  });

  it('falls back gracefully when extraction artifacts are malformed', () => {
    render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'changes',
          selectedDirectoryName: 'release_digest',
          selectedTarget: makeDashboardState().selectedTarget,
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: makeSnapshotArtifact({
                  extractionRecord: ['unexpected-array-payload'],
                }),
                snapshotHistory: [makeSnapshotArtifact()],
              },
            }),
          },
        })}
      />,
    );

    const historyExtractionButton = screen.getAllByRole('button', { name: 'Extraction' })[0];
    if (!historyExtractionButton) {
      throw new Error('Expected a history extraction button.');
    }
    fireEvent.click(historyExtractionButton);
    expect(screen.getByText('Current extraction details')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
