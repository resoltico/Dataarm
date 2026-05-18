import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailPanel } from '../../src/components/dashboard/DetailPanel';
import { makeDashboardState, makeDocument, makeSnapshotArtifact } from './fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('detail panel guided coverage', () => {
  it('wires preview actions and covers rendered, compare, and extraction workbench branches', () => {
    const handleSave = vi.fn();
    const setDetailTab = vi.fn();
    const previewDocument = makeDocument();
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
              draftSession: previewDocument.guidedSession,
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'initialized' } },
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
    const previewRenderedButton = screen.getAllByRole('button', { name: 'Rendered' })[0];
    if (!previewRenderedButton) {
      throw new Error('Expected a preview rendered button.');
    }
    fireEvent.click(previewRenderedButton);
    expect(screen.getByTitle('Rendered fragment preview')).toBeTruthy();

    rerender(
      <DetailPanel
        state={makeDashboardState({
          isDraftContext: true,
          selectedTarget: null,
          selectedDirectoryName: null,
          detailTab: 'changes',
          handleSave,
          saving: true,
          setDetailTab,
          previewSnapshot: makeSnapshotArtifact({
            extractionRecord: [],
          }),
          preview: {
            loading: false,
            error: null,
            data: {
              targetId: 'release_digest',
              displayName: 'Release digest',
              canonicalToml: 'target_id = "release_digest"\n',
              draftSession: previewDocument.guidedSession,
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'pending' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'initialized' } },
              previewSnapshot: makeSnapshotArtifact({
                extractionRecord: [],
              }),
              previewArtifactIssues: [],
            },
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
    const savingExtractionButton = screen.getAllByRole('button', { name: 'Extraction' })[0];
    if (!savingExtractionButton) {
      throw new Error('Expected an extraction button while preview is saving.');
    }
    fireEvent.click(savingExtractionButton);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('surfaces preview artifact issues in the artifacts tab and exposes valid extraction metadata on saved history', () => {
    const historySnapshot = makeSnapshotArtifact({
      extractionRecord: {
        selection_kind: 'css_selector',
        selection_match: 'single',
        selected_candidate_index: 2,
        candidate_count: 3,
        compare_basis: 'text',
      },
    });

    const { rerender } = render(
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
              draftSession: makeDocument().guidedSession,
              statusReport: { schema_name: 'ffhn.status_report', status: { kind: 'ready' } },
              dryRunReport: { schema_name: 'ffhn.run_report', result: { outcome: 'unchanged' } },
              previewSnapshot: historySnapshot,
              previewArtifactIssues: ['Preview issue from runtime'],
            },
          },
        })}
      />,
    );

    expect(screen.getByText('Preview issue from runtime')).toBeTruthy();

    rerender(
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
});
