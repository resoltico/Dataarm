import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailPanel } from '../../../src/components/dashboard/DetailPanel';
import {
  makeDashboardState,
  makeDocument,
  makeSnapshotArtifact,
  makeWorkspaceSnapshot,
} from '../fixtures';

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

describe('DetailPanel artifacts tab', () => {
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
              lastRunSnapshot: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
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

  it('renders non-fallback artifact branches and preview issue surfaces', () => {
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
              dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
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
              runReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
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
          detailTab: 'artifacts',
          artifactTab: 'run',
          lastRun: {
            loading: false,
            error: null,
            data: {
              workspace: workspaceSnapshot,
              directoryName: 'demo_status_board',
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              runReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
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
          detailTab: 'artifacts',
          artifactTab: 'preview',
          previewArtifactIssues: ['Preview issue from runtime'],
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: guidedSession(),
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
              previewArtifactIssues: ['Preview issue from runtime'],
            },
          },
        })}
      />,
    );
    expect(screen.getByText('Preview issue from runtime')).toBeTruthy();
  });
});
