import type { NotificationSettings, WorkspaceSnapshot } from '../../src/types';
import {
  applyWorkspaceSnapshotToState,
  bootstrapWorkspaceIntoState,
  clearNotificationFeedIntoState,
  createWorkspaceFromInputIntoState,
  hydrateWorkspaceSnapshotIntoState,
  openWorkspacePathIntoState,
  openWorkspaceRequestIntoState,
  updateNotificationSettingsIntoState,
} from '../../src/hooks/dashboardState.workspace';
import { makeNotificationCenter, makeTarget, makeWorkspaceSnapshot } from './fixtures';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  clearNotificationFeed: vi.fn(),
  createWorkspace: vi.fn(),
  openWorkspace: vi.fn(),
  openWorkspacePath: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

vi.mock('../../src/lib/api', () => api);

function makeWorkspaceContext(
  overrides: Partial<{
    beginWorkspaceUpdate: () => number;
    isCurrentWorkspaceUpdate: (updateId: number) => boolean;
    setWorkspace: (state: unknown) => void;
    setWorkspaceInput: (value: string) => void;
    setSelectedDirectoryName: (directoryName: string | null) => void;
    selectedDirectoryName: string | null;
    setOpeningWorkspace: (opening: boolean) => void;
    setFeedback: (tone: string, message: string) => void;
    setActionFeedback: (feedback: unknown) => void;
    confirmDiscardDraft: () => boolean;
    clearEditor: () => void;
    loadTargetDocument: (directoryName: string, loadMode: string) => Promise<void>;
    workspaceInput: string;
  }> = {},
) {
  return {
    beginWorkspaceUpdate: vi.fn(() => 1),
    isCurrentWorkspaceUpdate: vi.fn(() => true),
    setWorkspace: vi.fn(),
    setWorkspaceInput: vi.fn(),
    setSelectedDirectoryName: vi.fn(),
    selectedDirectoryName: 'alpha',
    setOpeningWorkspace: vi.fn(),
    setFeedback: vi.fn(),
    setActionFeedback: vi.fn(),
    confirmDiscardDraft: vi.fn(() => true),
    clearEditor: vi.fn(),
    loadTargetDocument: vi.fn(async () => {}),
    workspaceInput: '/tmp/dataarm/demo-watch-root',
    ...overrides,
  };
}

function makeNotificationContext(
  overrides: Partial<{
    beginWorkspaceUpdate: () => number;
    isCurrentWorkspaceUpdate: (updateId: number) => boolean;
    hydrateWorkspaceSnapshot: (
      snapshot: WorkspaceSnapshot,
      preferredDirectoryName: string | null,
      hydrationMode: string,
    ) => Promise<void>;
    selectedTargetDirectoryName: string | null;
    setFeedback: (tone: string, message: string) => void;
  }> = {},
) {
  return {
    beginWorkspaceUpdate: vi.fn(() => 1),
    isCurrentWorkspaceUpdate: vi.fn(() => true),
    hydrateWorkspaceSnapshot: vi.fn(async () => {}),
    selectedTargetDirectoryName: 'alpha',
    setFeedback: vi.fn(),
    ...overrides,
  };
}

describe('dashboardState.workspace', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('applies workspace snapshots by preferred target, latest run, label, and directory order', () => {
    const context = makeWorkspaceContext();
    const latestSnapshot = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'older',
          displayName: 'Older',
          lastRunAt: '2026-05-17T11:30:00Z',
        }),
        makeTarget({
          directoryName: 'latest',
          displayName: 'Latest',
          lastRunAt: '2026-05-18T11:30:00Z',
        }),
      ],
    });

    expect(applyWorkspaceSnapshotToState(context, latestSnapshot, null)).toBe('latest');
    expect(context.setSelectedDirectoryName).toHaveBeenLastCalledWith('latest');

    const namedSnapshot = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'zeta',
          displayName: 'Zulu',
          lastRunAt: '2026-05-18T11:30:00Z',
        }),
        makeTarget({
          directoryName: 'alpha',
          displayName: 'Alpha',
          lastRunAt: '2026-05-18T11:30:00Z',
        }),
      ],
    });

    expect(applyWorkspaceSnapshotToState(context, namedSnapshot, null)).toBe('alpha');

    const directorySnapshot = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'zeta',
          displayName: 'Same',
          lastRunAt: '2026-05-18T11:30:00Z',
        }),
        makeTarget({
          directoryName: 'alpha',
          displayName: 'Same',
          lastRunAt: '2026-05-18T11:30:00Z',
        }),
        makeTarget({
          directoryName: 'pending',
          displayName: null,
          lastRunAt: null,
        }),
      ],
    });

    expect(applyWorkspaceSnapshotToState(context, directorySnapshot, null)).toBe('alpha');

    const fallbackSnapshot = makeWorkspaceSnapshot({
      targets: [
        makeTarget({
          directoryName: 'plain_zeta',
          displayName: null,
          lastRunAt: null,
        }),
        makeTarget({
          directoryName: 'plain_alpha',
          displayName: null,
          lastRunAt: null,
        }),
      ],
    });

    expect(applyWorkspaceSnapshotToState(context, fallbackSnapshot, null)).toBe('plain_alpha');
    expect(applyWorkspaceSnapshotToState(context, latestSnapshot, 'older')).toBe('older');
    expect(context.setWorkspaceInput).toHaveBeenCalledWith('');
  });

  it('hydrates the selected target or clears the editor when the workspace is empty', async () => {
    const context = makeWorkspaceContext();
    const populatedSnapshot = makeWorkspaceSnapshot({
      targets: [makeTarget({ directoryName: 'release_notes', displayName: 'Release notes' })],
    });

    await hydrateWorkspaceSnapshotIntoState(context, populatedSnapshot, null);
    expect(context.loadTargetDocument).toHaveBeenCalledWith('release_notes', 'replace_view');

    const preservingContext = makeWorkspaceContext({ selectedDirectoryName: 'alpha' });
    const preservingSnapshot = makeWorkspaceSnapshot({
      targets: [makeTarget({ directoryName: 'alpha', displayName: 'Alpha' })],
    });
    await hydrateWorkspaceSnapshotIntoState(
      preservingContext,
      preservingSnapshot,
      'alpha',
      'preserve_view',
    );
    expect(preservingContext.loadTargetDocument).toHaveBeenCalledWith('alpha', 'refresh_view');

    const emptyContext = makeWorkspaceContext();
    const emptySnapshot = makeWorkspaceSnapshot({ targets: [] });
    await hydrateWorkspaceSnapshotIntoState(emptyContext, emptySnapshot, null);
    expect(emptyContext.clearEditor).toHaveBeenCalledTimes(1);
  });

  it('bootstraps the workspace and ignores stale or inactive results', async () => {
    const activeContext = makeWorkspaceContext();
    const snapshot = makeWorkspaceSnapshot({
      targets: [makeTarget({ directoryName: 'release_notes', displayName: 'Release notes' })],
    });
    api.bootstrap.mockResolvedValueOnce({ workspace: snapshot });

    await bootstrapWorkspaceIntoState(activeContext, () => true);
    expect(activeContext.setWorkspace).toHaveBeenCalled();
    expect(activeContext.loadTargetDocument).toHaveBeenCalledWith('release_notes', 'replace_view');

    const staleContext = makeWorkspaceContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.bootstrap.mockResolvedValueOnce({ workspace: snapshot });
    await bootstrapWorkspaceIntoState(staleContext, () => true);
    expect(staleContext.setWorkspace).not.toHaveBeenCalled();
    expect(staleContext.loadTargetDocument).not.toHaveBeenCalled();

    const inactiveContext = makeWorkspaceContext();
    api.bootstrap.mockRejectedValueOnce(new Error('Late bootstrap failure'));
    await bootstrapWorkspaceIntoState(inactiveContext, () => false);
    expect(inactiveContext.setFeedback).not.toHaveBeenCalled();

    const failingContext = makeWorkspaceContext();
    api.bootstrap.mockRejectedValueOnce(new Error('Bootstrap exploded'));
    await bootstrapWorkspaceIntoState(failingContext, () => true);
    expect(failingContext.setWorkspace).toHaveBeenCalledWith({
      loading: false,
      error: 'Bootstrap exploded',
      data: null,
    });
    expect(failingContext.setFeedback).toHaveBeenCalledWith('error', 'Bootstrap exploded');
  });

  it('opens and creates workspaces with trim, stale-update, and error handling', async () => {
    const snapshot = makeWorkspaceSnapshot();

    const blockedContext = makeWorkspaceContext({
      confirmDiscardDraft: vi.fn(() => false),
    });
    await openWorkspaceRequestIntoState(blockedContext);
    expect(api.openWorkspace).not.toHaveBeenCalled();

    const openContext = makeWorkspaceContext();
    api.openWorkspace.mockResolvedValueOnce(snapshot);
    await openWorkspaceRequestIntoState(openContext, '/tmp/dataarm/workspace');
    expect(api.openWorkspace).toHaveBeenCalledWith('/tmp/dataarm/workspace');
    expect(openContext.setOpeningWorkspace).toHaveBeenNthCalledWith(1, true);
    expect(openContext.setOpeningWorkspace).toHaveBeenLastCalledWith(false);
    expect(openContext.setFeedback).toHaveBeenCalledWith('success', 'Workspace loaded.');

    const staleOpenContext = makeWorkspaceContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.openWorkspace.mockResolvedValueOnce(snapshot);
    await openWorkspaceRequestIntoState(staleOpenContext, '/tmp/dataarm/stale');
    expect(staleOpenContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateOpenContext = makeWorkspaceContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.openWorkspace.mockResolvedValueOnce(snapshot);
    await openWorkspaceRequestIntoState(staleAfterHydrateOpenContext, '/tmp/dataarm/late-open');
    expect(staleAfterHydrateOpenContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedOpenContext = makeWorkspaceContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.openWorkspace.mockRejectedValueOnce(new Error('Late open failure'));
    await openWorkspaceRequestIntoState(staleRejectedOpenContext, '/tmp/dataarm/late-fail');
    expect(staleRejectedOpenContext.setFeedback).not.toHaveBeenCalled();

    const failingOpenContext = makeWorkspaceContext();
    api.openWorkspace.mockRejectedValueOnce(new Error('Open exploded'));
    await openWorkspaceRequestIntoState(failingOpenContext, '/tmp/dataarm/fail');
    expect(failingOpenContext.setFeedback).toHaveBeenCalledWith('error', 'Open exploded');

    const blankCreateContext = makeWorkspaceContext({ workspaceInput: '   ' });
    await createWorkspaceFromInputIntoState(blankCreateContext);
    expect(blankCreateContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'Enter a workspace path first.',
    );

    const createContext = makeWorkspaceContext({ workspaceInput: '  /tmp/dataarm/new-root  ' });
    api.createWorkspace.mockResolvedValueOnce(snapshot);
    await createWorkspaceFromInputIntoState(createContext);
    expect(api.createWorkspace).toHaveBeenCalledWith('/tmp/dataarm/new-root');
    expect(createContext.setFeedback).toHaveBeenCalledWith('success', 'Workspace created.');

    const staleCreateContext = makeWorkspaceContext({
      workspaceInput: '/tmp/dataarm/stale-root',
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.createWorkspace.mockResolvedValueOnce(snapshot);
    await createWorkspaceFromInputIntoState(staleCreateContext);
    expect(staleCreateContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateCreateContext = makeWorkspaceContext({
      workspaceInput: '/tmp/dataarm/stale-after-hydrate',
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.createWorkspace.mockResolvedValueOnce(snapshot);
    await createWorkspaceFromInputIntoState(staleAfterHydrateCreateContext);
    expect(staleAfterHydrateCreateContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedCreateContext = makeWorkspaceContext({
      workspaceInput: '/tmp/dataarm/late-create-fail',
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.createWorkspace.mockRejectedValueOnce(new Error('Late create failure'));
    await createWorkspaceFromInputIntoState(staleRejectedCreateContext);
    expect(staleRejectedCreateContext.setFeedback).not.toHaveBeenCalled();

    const failingCreateContext = makeWorkspaceContext({ workspaceInput: '/tmp/dataarm/fail' });
    api.createWorkspace.mockRejectedValueOnce(new Error('Create exploded'));
    await createWorkspaceFromInputIntoState(failingCreateContext);
    expect(failingCreateContext.setFeedback).toHaveBeenCalledWith('error', 'Create exploded');
  });

  it('updates notification settings and clears the feed across success, warning, stale, and error paths', async () => {
    const warningContext = makeNotificationContext();
    const warningSettings: NotificationSettings = {
      notifyWhen: 'changes_and_errors',
      delivery: 'system',
    };
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        notificationCenter: makeNotificationCenter({
          settings: warningSettings,
          permissionState: 'unknown',
        }),
      }),
    );
    await updateNotificationSettingsIntoState(warningContext, warningSettings);
    expect(warningContext.hydrateWorkspaceSnapshot).toHaveBeenCalled();
    expect(warningContext.setFeedback).toHaveBeenCalledWith(
      'warning',
      'System delivery is not ready on this runtime.',
    );

    const successContext = makeNotificationContext();
    const successSettings: NotificationSettings = {
      notifyWhen: 'all_completions',
      delivery: 'in_app',
    };
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        notificationCenter: makeNotificationCenter({
          settings: successSettings,
          permissionState: 'granted',
        }),
      }),
    );
    await updateNotificationSettingsIntoState(successContext, successSettings);
    expect(successContext.setFeedback).toHaveBeenCalledWith(
      'success',
      'Notification settings updated.',
    );

    const staleContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        notificationCenter: makeNotificationCenter({
          settings: successSettings,
          permissionState: 'granted',
        }),
      }),
    );
    await updateNotificationSettingsIntoState(staleContext, successSettings);
    expect(staleContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.updateNotificationSettings.mockResolvedValueOnce(
      makeWorkspaceSnapshot({
        notificationCenter: makeNotificationCenter({
          settings: successSettings,
          permissionState: 'granted',
        }),
      }),
    );
    await updateNotificationSettingsIntoState(staleAfterHydrateContext, successSettings);
    expect(staleAfterHydrateContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedNotificationContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.updateNotificationSettings.mockRejectedValueOnce(new Error('Late notification failure'));
    await updateNotificationSettingsIntoState(staleRejectedNotificationContext, successSettings);
    expect(staleRejectedNotificationContext.setFeedback).not.toHaveBeenCalled();

    const failingContext = makeNotificationContext();
    api.updateNotificationSettings.mockRejectedValueOnce(new Error('Notifications exploded'));
    await updateNotificationSettingsIntoState(failingContext, successSettings);
    expect(failingContext.setFeedback).toHaveBeenCalledWith('error', 'Notifications exploded');

    const clearContext = makeNotificationContext();
    api.clearNotificationFeed.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await clearNotificationFeedIntoState(clearContext);
    expect(clearContext.setFeedback).toHaveBeenCalledWith('info', 'Notification history cleared.');

    const staleClearContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.clearNotificationFeed.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await clearNotificationFeedIntoState(staleClearContext);
    expect(staleClearContext.setFeedback).not.toHaveBeenCalled();

    const staleAfterHydrateClearContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    });
    api.clearNotificationFeed.mockResolvedValueOnce(makeWorkspaceSnapshot());
    await clearNotificationFeedIntoState(staleAfterHydrateClearContext);
    expect(staleAfterHydrateClearContext.setFeedback).not.toHaveBeenCalled();

    const staleRejectedClearContext = makeNotificationContext({
      isCurrentWorkspaceUpdate: vi.fn(() => false),
    });
    api.clearNotificationFeed.mockRejectedValueOnce(new Error('Late clear failure'));
    await clearNotificationFeedIntoState(staleRejectedClearContext);
    expect(staleRejectedClearContext.setFeedback).not.toHaveBeenCalled();

    const failingClearContext = makeNotificationContext();
    api.clearNotificationFeed.mockRejectedValueOnce(new Error('Clear exploded'));
    await clearNotificationFeedIntoState(failingClearContext);
    expect(failingClearContext.setFeedback).toHaveBeenCalledWith('error', 'Clear exploded');
  });

  it('surfaces workspace-path open failures to the operator', async () => {
    const setFeedback = vi.fn();
    api.openWorkspacePath.mockRejectedValueOnce(new Error('Reveal exploded'));
    await openWorkspacePathIntoState(setFeedback);
    expect(setFeedback).toHaveBeenCalledWith('error', 'Reveal exploded');
  });
});
