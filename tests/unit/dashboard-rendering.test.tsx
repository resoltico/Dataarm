import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { StatusPill } from '../../src/components/StatusPill';
import { TargetEditor } from '../../src/components/dashboard/TargetEditor';
import { TargetTable } from '../../src/components/dashboard/TargetTable';
import { NavSidebar } from '../../src/components/layout/NavSidebar';
import { NotificationCenter } from '../../src/components/layout/NotificationCenter';
import { TopBar } from '../../src/components/layout/TopBar';
import {
  makeDashboardState,
  makeDocument,
  makeNotificationCenter,
  makeNotificationRecord,
  makeTarget,
  makeWorkspaceSnapshot,
} from './fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function getButton(name: string | RegExp): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${String(name)} to resolve to a button element.`);
  }
  return button;
}

describe('TopBar', () => {
  it('renders workspace stats, feedback, and header actions', () => {
    const handleOpenWorkspacePath = vi.fn();
    const handleRunWorkspace = vi.fn();
    const state = makeDashboardState({
      stats: {
        total: 4,
        runnable: 4,
        ready: 2,
        changed: 1,
        firstRun: 1,
        attention: 1,
      },
      actionFeedback: { tone: 'success', message: 'Library loaded.' },
      handleOpenWorkspacePath,
      handleRunWorkspace,
    });

    render(<TopBar state={state} />);

    expect(screen.getByText('Dataarm')).toBeTruthy();
    expect(screen.getByText('1 changed')).toBeTruthy();
    expect(screen.getByText('1 first checks')).toBeTruthy();
    expect(screen.getByText('1 needs repair')).toBeTruthy();
    expect(screen.getByText('2/4 ready')).toBeTruthy();
    expect(screen.getByText('Library loaded.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check all watches' }));

    expect(handleOpenWorkspacePath).toHaveBeenCalledTimes(1);
    expect(handleRunWorkspace).toHaveBeenCalledTimes(1);
  });

  it('disables workspace actions when the workspace is unavailable or the draft is unsaved', () => {
    const noWorkspaceState = makeDashboardState({
      workspaceSummary: null,
      workspace: { loading: false, error: null, data: null },
    });
    const { rerender } = render(<TopBar state={noWorkspaceState} />);

    expect(getButton('Open library').disabled).toBe(true);
    expect(getButton('Check all watches').disabled).toBe(true);

    rerender(
      <TopBar
        state={makeDashboardState({
          hasUnsavedWork: true,
        })}
      />,
    );

    expect(getButton('Check all watches').disabled).toBe(true);
    expect(getButton('Check all watches').getAttribute('title')).toBe(
      'Save or reset the draft first.',
    );
  });

  it('shows the running workspace label and hides zero-value stat chips', () => {
    render(
      <TopBar
        state={makeDashboardState({
          stats: {
            total: 1,
            runnable: 1,
            ready: 1,
            changed: 0,
            firstRun: 0,
            attention: 0,
          },
          runningWorkspace: true,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Checking watches…' })).toBeTruthy();
    expect(screen.queryByText('0 changed')).toBeNull();
    expect(screen.queryByText('0 first checks')).toBeNull();
    expect(screen.queryByText('0 needs repair')).toBeNull();
  });
});

describe('NavSidebar', () => {
  it('lets users switch filters, create drafts, and manage workspaces', () => {
    const setFilterView = vi.fn();
    const setWorkspaceInput = vi.fn();
    const handleStartNewTarget = vi.fn();
    const handleOpenWorkspaceFromInput = vi.fn();
    const handleCreateWorkspaceFromInput = vi.fn();
    const handleOpenRecentWorkspace = vi.fn();
    const state = makeDashboardState({
      stats: {
        total: 5,
        runnable: 5,
        ready: 3,
        changed: 1,
        firstRun: 0,
        attention: 1,
      },
      workspaceInput: '/tmp/dataarm/other-watch-root',
      recentWorkspaces: [
        {
          workspaceName: 'demo-watch-root',
          workspacePath: '/tmp/dataarm/demo-watch-root',
          workspaceSource: 'demo',
          lastOpenedAt: '2026-05-15T09:00:00Z',
        },
        {
          workspaceName: 'alpha',
          workspacePath: '/tmp/dataarm/alpha',
          workspaceSource: 'user',
          lastOpenedAt: '2026-05-15T09:05:00Z',
        },
        {
          workspaceName: 'beta',
          workspacePath: '/tmp/dataarm/beta',
          workspaceSource: 'user',
          lastOpenedAt: '2026-05-15T09:06:00Z',
        },
        {
          workspaceName: 'gamma',
          workspacePath: '/tmp/dataarm/gamma',
          workspaceSource: 'user',
          lastOpenedAt: '2026-05-15T09:07:00Z',
        },
        {
          workspaceName: 'delta',
          workspacePath: '/tmp/dataarm/delta',
          workspaceSource: 'user',
          lastOpenedAt: '2026-05-15T09:08:00Z',
        },
      ],
      handleStartNewTarget,
      setWorkspaceInput,
      handleOpenWorkspaceFromInput,
      handleCreateWorkspaceFromInput,
      handleOpenRecentWorkspace,
    });

    render(<NavSidebar state={state} filterView="all" setFilterView={setFilterView} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show advanced library tools' }));
    fireEvent.change(screen.getByLabelText('Change library folder'), {
      target: { value: '/tmp/dataarm/typed-watch-root' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Changed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add watch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced: local file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create library' }));
    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));

    expect(setFilterView).toHaveBeenNthCalledWith(1, 'changed');
    expect(setFilterView).toHaveBeenNthCalledWith(2, 'failed');
    expect(setWorkspaceInput).toHaveBeenCalledWith('/tmp/dataarm/typed-watch-root');
    expect(handleStartNewTarget).toHaveBeenNthCalledWith(1, 'http');
    expect(handleStartNewTarget).toHaveBeenNthCalledWith(2, 'file');
    expect(handleOpenWorkspaceFromInput).toHaveBeenCalledTimes(1);
    expect(handleCreateWorkspaceFromInput).toHaveBeenCalledTimes(1);
    expect(handleOpenRecentWorkspace).toHaveBeenCalledWith('/tmp/dataarm/alpha');
    expect(screen.queryByRole('button', { name: 'demo-watch-root' })).toBeNull();
    expect(screen.getByRole('button', { name: 'gamma' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'delta' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Changed' }).className.includes('nav-item-alert'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Failed' }).className.includes('nav-item-alert'),
    ).toBe(true);
  });

  it('disables workspace actions while paths are unchanged or a transition is in progress', () => {
    const unchangedPathState = makeDashboardState({
      workspaceInput: '/tmp/dataarm/demo-watch-root',
    });
    const { unmount } = render(
      <NavSidebar state={unchangedPathState} filterView="all" setFilterView={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show advanced library tools' }));
    expect(getButton('Open library').disabled).toBe(true);
    expect(getButton('Create library').disabled).toBe(false);

    unmount();

    render(
      <NavSidebar
        state={makeDashboardState({
          openingWorkspace: true,
          workspaceInput: '/tmp/dataarm/new-watch-root',
        })}
        filterView="all"
        setFilterView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show advanced library tools' }));
    expect(getButton('Opening library…').disabled).toBe(true);
    expect(getButton('Create library').disabled).toBe(true);
    expect(getButton('Add watch').disabled).toBe(true);
    expect(getButton('Advanced: local file').disabled).toBe(true);
  });

  it('enables workspace controls when there is no current workspace path to compare against', () => {
    render(
      <NavSidebar
        state={makeDashboardState({
          workspaceSummary: null,
          workspace: { loading: false, error: null, data: null },
          workspaceInput: ' /tmp/dataarm/fresh-root ',
        })}
        filterView="all"
        setFilterView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show advanced library tools' }));
    expect(getButton('Open library').disabled).toBe(false);
    expect(getButton('Create library').disabled).toBe(false);
  });
});

describe('NotificationCenter', () => {
  it('renders permission state guidance for every delivery branch', () => {
    const handleUpdateNotificationSettings = vi.fn();
    const handleClearNotificationFeed = vi.fn();
    const { rerender } = render(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: null,
          handleUpdateNotificationSettings,
          handleClearNotificationFeed,
        })}
      />,
    );

    expect(screen.getByText('Loading notification settings.')).toBeTruthy();
    expect(getButton('Clear').disabled).toBe(true);

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'in_app' },
            permissionState: 'granted',
          }),
          handleUpdateNotificationSettings,
          handleClearNotificationFeed,
        })}
      />,
    );
    expect(
      screen.getByText('Alerts stay inside Dataarm until you enable system notifications.'),
    ).toBeTruthy();

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'system' },
            permissionState: 'granted',
          }),
        })}
      />,
    );
    expect(screen.getByText('System delivery is ready for this runtime.')).toBeTruthy();

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
            permissionState: 'denied',
          }),
        })}
      />,
    );
    expect(screen.getByText('System delivery was denied by the platform.')).toBeTruthy();

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
            permissionState: 'prompt',
          }),
        })}
      />,
    );
    expect(
      screen.getByText('System delivery is waiting for a platform permission prompt.'),
    ).toBeTruthy();

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
            permissionState: 'prompt_with_rationale',
          }),
        })}
      />,
    );
    expect(
      screen.getByText('System delivery needs a platform permission prompt with rationale.'),
    ).toBeTruthy();

    rerender(
      <NotificationCenter
        state={makeDashboardState({
          notificationCenter: makeNotificationCenter({
            settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
            permissionState: 'unknown',
          }),
        })}
      />,
    );
    expect(screen.getByText('System delivery is unavailable on this runtime.')).toBeTruthy();
  });

  it('renders notification history across channel combinations and action handlers', () => {
    const handleUpdateNotificationSettings = vi.fn();
    const handleClearNotificationFeed = vi.fn();
    const state = makeDashboardState({
      notificationCenter: makeNotificationCenter({
        items: [
          makeNotificationRecord({
            id: 'history-only',
            deliveredChannels: [],
          }),
          makeNotificationRecord({
            id: 'both',
            deliveredChannels: ['in_app', 'system'],
          }),
          makeNotificationRecord({
            id: 'system',
            deliveredChannels: ['system'],
            deliveryError: 'macOS notifications are disabled',
          }),
          makeNotificationRecord({
            id: 'in-app',
            deliveredChannels: ['in_app'],
          }),
          makeNotificationRecord({
            id: 'workspace-scope',
            targetDisplayName: null,
            workspaceName: 'workspace-only',
          }),
        ],
      }),
      handleUpdateNotificationSettings,
      handleClearNotificationFeed,
    });

    render(<NotificationCenter state={state} />);

    fireEvent.change(screen.getByLabelText('Notify for'), {
      target: { value: 'all_completions' },
    });
    fireEvent.change(screen.getByLabelText('Deliver through'), {
      target: { value: 'system' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(handleUpdateNotificationSettings).toHaveBeenNthCalledWith(1, {
      notifyWhen: 'all_completions',
      delivery: 'in_app',
    });
    expect(handleUpdateNotificationSettings).toHaveBeenNthCalledWith(2, {
      notifyWhen: 'changes_and_errors',
      delivery: 'system',
    });
    expect(handleClearNotificationFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText('History only')).toBeTruthy();
    expect(screen.getByText('In app + system')).toBeTruthy();
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In app').length).toBeGreaterThan(0);
    expect(screen.getByText('macOS notifications are disabled')).toBeTruthy();
    expect(screen.getByText('workspace-only')).toBeTruthy();
  });
});

describe('TargetTable', () => {
  it('renders empty states for blank workspaces and unmatched filters', () => {
    const emptyState = makeDashboardState({
      targets: [],
      workspaceSummary: makeWorkspaceSnapshot({
        summary: {
          workspaceName: 'blank',
          workspacePath: '/tmp/dataarm/blank',
          workspaceSource: 'user',
          targetCount: 0,
          runnableTargetCount: 0,
          issueCount: 0,
          lastRunCount: 0,
        },
        targets: [],
      }).summary,
      selectedTarget: null,
    });
    const { rerender } = render(<TargetTable state={emptyState} filterView="all" />);

    expect(
      screen.getByText('Add your first page to start tracking a website section over time.'),
    ).toBeTruthy();

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets: [makeTarget()],
        })}
        filterView="failed"
      />,
    );

    expect(screen.getByText('No watches match this view.')).toBeTruthy();
  });

  it('renders filtered rows, outcome labels, and selection handlers', () => {
    const handleSelectTarget = vi.fn();
    const targets = [
      makeTarget({
        directoryName: 'ready',
        displayName: 'Ready target',
        lastRunOutcome: 'unchanged',
      }),
      makeTarget({
        directoryName: 'changed',
        displayName: 'Changed target',
        statusKind: 'changed',
        lastRunOutcome: 'changed',
      }),
      makeTarget({
        directoryName: 'initialized',
        displayName: 'Initialized target',
        statusKind: 'pending',
        lastRunOutcome: 'initialized',
      }),
      makeTarget({
        directoryName: 'attention',
        displayName: 'Attention target',
        statusKind: 'failed_transient',
        lastRunOutcome: null,
        errorMessage: 'Failed to connect',
      }),
      makeTarget({
        directoryName: 'anonymous',
        displayName: null,
        targetId: null,
        sourceKind: null,
        sourceLocator: null,
        lastRunAt: null,
      }),
    ];
    const state = makeDashboardState({
      targets,
      selectedTarget: targets[0] ?? null,
      handleSelectTarget,
    });
    const { rerender } = render(<TargetTable state={state} filterView="all" />);

    expect(screen.getAllByText('No change').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Changed').length).toBeGreaterThan(0);
    expect(screen.getByText('First check')).toBeTruthy();
    expect(screen.getByText('Page not configured')).toBeTruthy();
    expect(screen.getByText('Failed to connect')).toBeTruthy();
    expect(screen.getByText('anonymous')).toBeTruthy();
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByText('Changed target').closest('tr') ?? screen.getByText('Changed target'),
    );
    fireEvent.keyDown(
      screen.getByText('Attention target').closest('tr') ?? screen.getByText('Attention target'),
      { key: 'Enter' },
    );
    fireEvent.keyDown(
      screen.getByText('Ready target').closest('tr') ?? screen.getByText('Ready target'),
      { key: ' ' },
    );

    expect(handleSelectTarget).toHaveBeenNthCalledWith(1, 'changed');
    expect(handleSelectTarget).toHaveBeenNthCalledWith(2, 'attention');

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[1] ?? null,
          handleSelectTarget,
          openingWorkspace: true,
        })}
        filterView="changed"
      />,
    );

    fireEvent.click(
      screen.getByText('Changed target').closest('tr') ?? screen.getByText('Changed target'),
    );
    expect(handleSelectTarget).toHaveBeenCalledTimes(3);

    rerender(
      <TargetTable
        state={makeDashboardState({
          targets,
          selectedTarget: targets[3] ?? null,
          handleSelectTarget,
        })}
        filterView="failed"
      />,
    );

    expect(screen.getByText('Attention target')).toBeTruthy();
    expect(screen.queryByText('Ready target')).toBeNull();
  });
});

describe('TargetEditor and StatusPill', () => {
  it('renders existing target metadata and editor actions', () => {
    const state = makeDashboardState({
      loadingTarget: true,
      selectedTarget: makeTarget({
        targetId: null,
      }),
      document: {
        loading: true,
        error: 'Document failed to load',
        data: makeDocument({
          errorMessage: 'Config warning',
        }),
      },
      handlePreview: vi.fn(),
      handleSave: vi.fn(),
      handleRunSelectedTarget: vi.fn(),
      handleResetDraft: vi.fn(),
      handleOpenSelectedTargetPath: vi.fn(),
      handleDeleteSelectedTarget: vi.fn(),
    });

    render(<TargetEditor state={state} />);

    expect(screen.getByText('Config warning')).toBeTruthy();
    expect(screen.getByText('Document failed to load')).toBeTruthy();
    expect(screen.getByText('Loading the saved watch setup for this selection.')).toBeTruthy();
    expect(getButton('Check section').disabled).toBe(true);
    expect(getButton('Save watch').disabled).toBe(true);
    expect(getButton('Check now').disabled).toBe(true);
    expect(
      screen.getByText('Page: /tmp/dataarm/demo-watch-root/sources/status-board.html'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete watch' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Open in Finder' })).toHaveLength(1);
  });

  it('renders draft mode actions and status pills', () => {
    render(
      <>
        <TargetEditor
          state={makeDashboardState({
            selectedTarget: null,
            isDraftContext: true,
            editorMode: 'file',
            draftToml: 'target_id = "draft"',
            dirty: true,
          })}
        />
        <StatusPill value="changed" />
        <StatusPill value="failed_transient" label="Retry now" size="compact" />
      </>,
    );

    expect(screen.getByText(/adding a local file watch/u)).toBeTruthy();
    expect(screen.getByText(/Selected section:/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show technical watch contract' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete watch' })).toBeNull();
    expect(screen.getByText('Changed')).toBeTruthy();
    expect(screen.getByText('Retry now')).toBeTruthy();
  });

  it('renders saved-target draft wording, running labels, and default status pill sizing', () => {
    render(
      <>
        <TargetEditor
          state={makeDashboardState({
            selectedTarget: null,
            isDraftContext: true,
            editorMode: 'existing',
            runningTarget: true,
            hasUnsavedWork: true,
          })}
        />
        <TargetEditor
          state={makeDashboardState({
            runningTarget: true,
            hasUnsavedWork: true,
          })}
        />
        <StatusPill value="ready" />
      </>,
    );

    expect(screen.getByText(/editing a saved watch/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Checking…' }).getAttribute('title')).toBe(
      'Save or reset the draft before checking the saved watch.',
    );
    const readyPill = screen.getByText('Ready to check').closest('span');
    expect(readyPill?.className.includes('pill-compact')).toBe(false);
  });
});
