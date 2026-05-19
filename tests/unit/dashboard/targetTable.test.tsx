import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TargetTable } from '../../../src/components/dashboard/TargetTable';
import { makeDashboardState, makeTarget } from '../fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeTargets() {
  return [
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
}

describe('TargetTable', () => {
  it('wires search, grouping, and selection interactions to the state surface', () => {
    const handleSelectTarget = vi.fn();
    const setSearchQuery = vi.fn();
    const setGroupBy = vi.fn();
    const targets = makeTargets();

    render(
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
  });

  it('applies source, never-run, and attention filters with their grouped labels', () => {
    const targets = makeTargets();
    const { rerender } = render(
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
  });

  it('surfaces empty-search and default-callback paths without crashing', () => {
    const targets = makeTargets();
    const { rerender } = render(
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

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets: [makeTarget({ displayName: 'Release file' })],
        })}
        filterView="all"
      />,
    );

    fireEvent.change(screen.getByLabelText('Search targets'), {
      target: { value: 'release' },
    });
    fireEvent.change(screen.getByLabelText('Group targets'), {
      target: { value: 'none' },
    });

    expect(screen.getByText('Release file')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Group targets' })).toBeTruthy();
  });
});
