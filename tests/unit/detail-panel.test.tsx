import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailPanel } from '../../src/components/dashboard/DetailPanel';
import {
  makeDashboardState,
  makeDocument,
  makeSnapshotArtifact,
  makeTarget,
  makeWorkspaceSnapshot,
} from './fixtures';

afterEach(() => {
  cleanup();
});

describe('DetailPanel', () => {
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
    expect(screen.getByText('Previewing the current draft against ffhn-core.')).toBeTruthy();

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
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'initialized' } },
            },
          },
        })}
      />,
    );

    expect(screen.getByText('Preview ready')).toBeTruthy();
    expect(screen.getByText('Release digest')).toBeTruthy();
    expect(screen.getByText('Preview status report')).toBeTruthy();
  });

  it('renders empty, never-run, changed, and baseline-history states for saved targets', () => {
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

  it('renders preview, run, state, and batch artifact tabs with fallbacks', () => {
    const setArtifactTab = vi.fn();
    const workspaceSnapshot = makeDashboardState().workspace.data ?? makeWorkspaceSnapshot();
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'preview',
          preview: { loading: false, error: 'Preview exploded', data: null },
          setArtifactTab,
        })}
      />,
    );

    expect(screen.getByText('Preview exploded')).toBeTruthy();
    expect(screen.getByText('Preview to inspect the canonical ffhn.status_report.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Last run' }));
    expect(setArtifactTab).toHaveBeenCalledWith('run');

    rerender(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'run',
          lastRun: { loading: false, error: 'Run exploded', data: null },
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              lastRunSnapshot: { schema_name: 'ffhn.run_report', result: { outcome: 'changed' } },
            }),
          },
        })}
      />,
    );
    expect(screen.getByText('Run exploded')).toBeTruthy();
    expect(screen.getByText('Run status report')).toBeTruthy();
    expect(screen.getByText('Last run snapshot')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'state',
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactIssues: ['State checksum mismatch'],
            }),
          },
        })}
      />,
    );
    expect(screen.getByText('State checksum mismatch')).toBeTruthy();
    expect(screen.getByText('State document')).toBeTruthy();
    expect(screen.getByText('Current extraction.json')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'batch',
          lastBatch: {
            loading: false,
            error: 'Workspace exploded',
            data: {
              workspace: workspaceSnapshot,
              batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
              skippedDirectories: [
                { directoryName: 'archive-watch-root', reason: 'Mock skip reason' },
              ],
              notification: null,
            },
          },
        })}
      />,
    );
    expect(screen.getByText('Workspace exploded')).toBeTruthy();
    expect(screen.getByText('Batch report')).toBeTruthy();
    expect(screen.getByText('Skipped directories')).toBeTruthy();
    expect(screen.getByText(/archive-watch-root/u)).toBeTruthy();
  });

  it('renders rich artifact and change branches without fallback content', () => {
    const runningHandler = vi.fn();
    const workspaceSnapshot = makeDashboardState().workspace.data ?? makeWorkspaceSnapshot();
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'preview',
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'preview-rich',
              displayName: 'Preview rich',
              canonicalToml: 'target_id = "preview-rich"\n',
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'unchanged' } },
            },
          },
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactIssues: [],
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: makeSnapshotArtifact({
                  compareText: 'Same line',
                }),
                snapshotHistory: [
                  makeSnapshotArtifact({
                    slot: 'history',
                    capturedAt: '2026-05-14T11:30:00Z',
                    compareDigestSha256: 'digest-previous',
                    compareText: 'Same line',
                  }),
                ],
              },
            }),
          },
          lastRun: {
            loading: false,
            error: null,
            data: {
              workspace: workspaceSnapshot,
              directoryName: 'demo_status_board',
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'unchanged' } },
              notification: null,
            },
          },
          lastBatch: {
            loading: false,
            error: null,
            data: {
              workspace: workspaceSnapshot,
              batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
              skippedDirectories: [],
              notification: null,
            },
          },
        })}
      />,
    );

    expect(screen.queryByText('Preview to inspect the canonical ffhn.status_report.')).toBeNull();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          selectedTarget: makeTarget({
            directoryName: 'unsupported',
            displayName: 'Unsupported',
            targetId: null,
            sourceLocator: null,
            selectionLabel: null,
            compareBasis: null,
            lastRunOutcome: null,
          }),
          selectedDirectoryName: 'unsupported',
          detailTab: 'changes',
          runningTarget: true,
          isBusy: true,
          handleRunSelectedTarget: runningHandler,
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactIssues: [],
              artifactHistory: {
                monitoringContractDigestSha256: 'digest',
                currentSnapshot: makeSnapshotArtifact({
                  compareText: 'Same line',
                }),
                snapshotHistory: [
                  makeSnapshotArtifact({
                    slot: 'history',
                    capturedAt: '2026-05-14T11:30:00Z',
                    compareDigestSha256: 'digest-previous',
                    compareText: 'Same line',
                  }),
                ],
              },
            }),
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Running target…' })).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('(no changed lines on the previous side)')).toBeTruthy();
    expect(screen.getByText('(no changed lines on the current side)')).toBeTruthy();
  });

  it('covers non-error artifact data branches and unsupported saved outcomes', () => {
    const workspaceSnapshot = makeDashboardState().workspace.data ?? makeWorkspaceSnapshot();
    const { rerender } = render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'run',
          lastRun: {
            loading: false,
            error: null,
            data: {
              workspace: workspaceSnapshot,
              directoryName: 'demo_status_board',
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              runReport: { schema_name: 'ffhn.run_report', result: { outcome: 'unchanged' } },
              notification: null,
            },
          },
        })}
      />,
    );

    expect(screen.queryByText('Run exploded')).toBeNull();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'state',
          document: {
            loading: false,
            error: null,
            data: makeDocument({
              artifactIssues: [],
              artifactHistory: null,
            }),
          },
        })}
      />,
    );

    expect(screen.queryByText('State checksum mismatch')).toBeNull();
    expect(screen.getByText('No current baseline compare artifact yet.')).toBeTruthy();
    expect(screen.getByText('No current extraction record yet.')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'artifacts',
          artifactTab: 'batch',
          lastBatch: {
            loading: false,
            error: null,
            data: {
              workspace: workspaceSnapshot,
              batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
              skippedDirectories: [],
              notification: null,
            },
          },
        })}
      />,
    );

    expect(screen.queryByText('Workspace exploded')).toBeNull();
    expect(screen.getByText('No directories were skipped.')).toBeTruthy();

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
});
