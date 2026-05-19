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

    fireEvent.change(screen.getByLabelText('Search watches'), {
      target: { value: 'release' },
    });
    fireEvent.change(screen.getByLabelText('Group watches'), {
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
    expect(screen.getAllByText('First check needed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
    expect(setSearchQuery).toHaveBeenCalledWith('release');
    expect(setGroupBy).toHaveBeenCalledWith('none');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-file');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-http');
    expect(handleSelectTarget).toHaveBeenCalledWith('release-pending');
  });

  it('applies changed, needs-setup, and failed views with their grouped labels', () => {
    const targets = makeTargets();
    const { rerender } = render(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
        })}
        filterView="changed"
        groupBy="status"
        searchQuery=""
      />,
    );
    expect(screen.getAllByText('Changed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Release file')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[1] ?? null,
        })}
        filterView="needs_setup"
        groupBy="none"
        searchQuery=""
      />,
    );
    expect(screen.getByText('Release pending')).toBeTruthy();
    expect(screen.queryByText('Release alert')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[2] ?? null,
        })}
        filterView="failed"
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
    expect(screen.getByText('No watches match this search.')).toBeTruthy();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets: [makeTarget({ displayName: 'Release file' })],
        })}
        filterView="all"
      />,
    );

    fireEvent.change(screen.getByLabelText('Search watches'), {
      target: { value: 'release' },
    });
    fireEvent.change(screen.getByLabelText('Group watches'), {
      target: { value: 'none' },
    });

    expect(screen.getByText('Release file')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Group watches' })).toBeTruthy();
  });

  it('covers alerts, paused, folder grouping, and workspace-transition branches', () => {
    const handleSelectTarget = vi.fn();
    const targets = [
      makeTarget({
        directoryName: 'folder-http',
        displayName: 'Folder HTTP',
        sourceKind: 'http',
        sourceLocator: 'https://example.com/folder',
        currentComparePreview: 'Version 1.2.3',
        watchProfile: {
          ...makeTarget().watchProfile,
          folderName: 'Releases',
          tags: ['release', 'critical'],
          schedule: { preset: 'every_5_minutes', customExpression: null },
        },
        statusKind: 'changed',
        lastRunOutcome: 'changed',
      }),
      makeTarget({
        directoryName: 'paused-file',
        displayName: 'Paused file',
        sourceKind: 'file',
        watchProfile: {
          ...makeTarget().watchProfile,
          paused: true,
          folderName: null,
        },
        statusKind: 'skipped_disabled',
        lastRunOutcome: null,
      }),
      makeTarget({
        directoryName: 'missing-page',
        displayName: 'Missing page',
        sourceKind: null,
        sourceLocator: null,
        currentComparePreview: null,
        watchProfile: {
          ...makeTarget().watchProfile,
          folderName: 'Repair',
        },
        statusKind: 'failed_permanent',
        lastRunOutcome: null,
        errorMessage: null,
      }),
      makeTarget({
        directoryName: 'http-without-url',
        displayName: 'HTTP without URL',
        sourceKind: 'http',
        sourceLocator: null,
        currentComparePreview: null,
        watchProfile: {
          ...makeTarget().watchProfile,
          folderName: 'Repair',
        },
        statusKind: 'ready',
        lastRunOutcome: 'unchanged',
      }),
    ];

    const { rerender } = render(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
          handleSelectTarget,
          openingWorkspace: true,
        })}
        filterView="paused"
        groupBy="folder"
        searchQuery=""
      />,
    );

    expect(screen.getByText('Ungrouped')).toBeTruthy();
    fireEvent.click(
      screen.getByText('Paused file').closest('tr') ?? screen.getByText('Paused file'),
    );
    fireEvent.keyDown(
      screen.getByText('Paused file').closest('tr') ?? screen.getByText('Paused file'),
      { key: 'Enter' },
    );
    expect(handleSelectTarget).not.toHaveBeenCalled();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[0] ?? null,
          handleSelectTarget,
        })}
        filterView="alerts"
        groupBy="folder"
        searchQuery="critical"
      />,
    );
    expect(screen.getByText('Releases')).toBeTruthy();
    expect(screen.getByText('Version 1.2.3')).toBeTruthy();
    expect(screen.queryByText('Paused file')).toBeNull();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[2] ?? null,
          handleSelectTarget,
        })}
        filterView="all"
        groupBy="folder"
        searchQuery="repair"
      />,
    );
    expect(screen.getByText('Repair')).toBeTruthy();
    expect(screen.getByText('Page not configured')).toBeTruthy();
    expect(screen.getAllByText('No saved value yet').length).toBeGreaterThan(0);

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[3] ?? null,
          handleSelectTarget,
        })}
        filterView="all"
        groupBy="none"
        searchQuery="without"
      />,
    );
    expect(screen.getByText('Website page')).toBeTruthy();
  });
});
