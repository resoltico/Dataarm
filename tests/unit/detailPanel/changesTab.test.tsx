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

    expect(screen.getByText('New HTTP target')).toBeTruthy();
    expect(
      screen.getByText('Previewing the current draft against the canonical FFHN runtime contract.'),
    ).toBeTruthy();

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
    expect(screen.getByText('New file target')).toBeTruthy();
    expect(screen.getByText('Preview failed')).toBeTruthy();
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
    expect(screen.getByText('New target')).toBeTruthy();
    expect(screen.getByText('Unsaved draft')).toBeTruthy();
    expect(
      screen.getByText('Preview this draft to validate the target contract before saving it.'),
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

    expect(screen.getByText('Preview ready')).toBeTruthy();
    expect(screen.getByText('Release digest')).toBeTruthy();
    expect(screen.getByText('Preview status report')).toBeTruthy();
  });

  it('renders saved-target change states and baseline history', () => {
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

    expect(screen.getByText('Select a target to view its change status.')).toBeTruthy();

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
    expect(screen.getByText('Never Run')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run target' }));
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
    expect(screen.getByText('Baseline timeline')).toBeTruthy();
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
    expect(screen.getByText('Current compare.txt')).toBeTruthy();

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
    expect(screen.getByText('Baseline Recorded')).toBeTruthy();

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
        'No baseline snapshots exist yet. Run this target to create the first compare artifact.',
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

    fireEvent.click(screen.getByRole('button', { name: 'Save target' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review config' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(setDetailTab).toHaveBeenCalledWith('config');
    expect(screen.getByText('Preview artifact drift')).toBeTruthy();

    const previewCompareButton = screen.getAllByRole('button', { name: 'Compare' })[0];
    if (!previewCompareButton) {
      throw new Error('Expected a preview compare button.');
    }
    fireEvent.click(previewCompareButton);
    expect(screen.getByText('Current compare.txt')).toBeTruthy();

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

    expect(screen.getByRole('button', { name: 'Running target…' }).getAttribute('title')).toBe(
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

    expect(screen.queryByRole('button', { name: 'Run target' })).toBeNull();
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

    expect(screen.getByRole('button', { name: 'Running target…' })).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Selector')).toBeTruthy();
    expect(screen.getByText('Compare basis')).toBeTruthy();
    expect(screen.getByText('Target ID')).toBeTruthy();
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
    expect(screen.getByText('Current extraction.json')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
