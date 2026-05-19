import { makeNotificationRecord, makeTarget, makeWatchProfile } from './fixtures';
import {
  activeScheduledWatchDirectoryName,
  runDueScheduledWatches,
  runScheduledWatchIntoState,
  type ScheduledWatchContext,
} from '../../src/hooks/dashboardState.scheduler';

function makeContext(overrides: Partial<ScheduledWatchContext> = {}): ScheduledWatchContext & {
  runTargetCommand: ReturnType<typeof vi.fn>;
  hydrateWorkspaceSnapshot: ReturnType<typeof vi.fn>;
  loadTargetDocument: ReturnType<typeof vi.fn>;
  setActionFeedback: ReturnType<typeof vi.fn>;
} {
  const runTargetCommand = vi.fn();
  const hydrateWorkspaceSnapshot = vi.fn(() => Promise.resolve());
  const loadTargetDocument = vi.fn(() => Promise.resolve());
  const setActionFeedback = vi.fn();

  return {
    beginWorkspaceUpdate: () => 1,
    isCurrentWorkspaceUpdate: () => true,
    scheduledRunsInFlight: new Set<string>(),
    runTargetCommand,
    hydrateWorkspaceSnapshot,
    selectedTargetDirectoryName: 'alpha',
    selectedDirectoryName: 'alpha',
    editorMode: 'existing',
    loadTargetDocument,
    setActionFeedback,
    ...overrides,
  };
}

describe('dashboardState scheduler helpers', () => {
  it('reports the active scheduled watch only for an open saved watch document', () => {
    expect(activeScheduledWatchDirectoryName('existing', 'alpha')).toBe('alpha');
    expect(activeScheduledWatchDirectoryName('http', 'alpha')).toBeNull();
    expect(activeScheduledWatchDirectoryName('file', null)).toBeNull();
  });

  it('skips duplicate scheduled runs that are already in flight', async () => {
    const context = makeContext({
      scheduledRunsInFlight: new Set(['alpha']),
    });

    await runScheduledWatchIntoState(context, 'alpha');
    expect(context.runTargetCommand).not.toHaveBeenCalled();
  });

  it('stops cleanly when a newer workspace update replaces the scheduled run before hydration', async () => {
    const context = makeContext({
      isCurrentWorkspaceUpdate: () => false,
    });
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [] },
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: null,
    });

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.hydrateWorkspaceSnapshot).not.toHaveBeenCalled();
    expect(context.scheduledRunsInFlight.size).toBe(0);
  });

  it('stops cleanly when a newer workspace update arrives after hydration', async () => {
    const freshness = vi
      .fn(() => true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const context = makeContext({
      isCurrentWorkspaceUpdate: freshness,
    });
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [] },
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: makeNotificationRecord({
        title: 'Should not surface',
        deliveredChannels: ['in_app'],
      }),
    });

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.hydrateWorkspaceSnapshot).toHaveBeenCalledWith(
      { targets: [] },
      'alpha',
      'preserve_view',
    );
    expect(context.loadTargetDocument).not.toHaveBeenCalled();
    expect(context.setActionFeedback).not.toHaveBeenCalled();
  });

  it('refreshes the selected saved watch and reports in-app notification outcomes', async () => {
    const context = makeContext();
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [makeTarget({ directoryName: 'alpha' })] },
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
      notification: makeNotificationRecord({
        title: 'Scheduled change detected.',
        deliveredChannels: ['in_app'],
      }),
    });

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.hydrateWorkspaceSnapshot).toHaveBeenCalled();
    expect(context.loadTargetDocument).toHaveBeenCalledWith('alpha', 'refresh_view');
    expect(context.setActionFeedback).toHaveBeenCalledWith({
      tone: 'warning',
      message: 'Scheduled change detected.',
    });
    expect(context.scheduledRunsInFlight.size).toBe(0);
  });

  it('does not reopen the editor or push in-app feedback when the scheduled watch is not the active document', async () => {
    const context = makeContext({
      selectedDirectoryName: 'bravo',
      editorMode: 'file',
    });
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [makeTarget({ directoryName: 'alpha' })] },
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
      notification: makeNotificationRecord({
        deliveredChannels: ['system'],
      }),
    });

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.hydrateWorkspaceSnapshot).toHaveBeenCalled();
    expect(context.loadTargetDocument).not.toHaveBeenCalled();
    expect(context.setActionFeedback).not.toHaveBeenCalled();
  });

  it('reports scheduled-run failures through the action feedback surface', async () => {
    const context = makeContext();
    context.runTargetCommand.mockRejectedValue(new Error('Scheduled run failed'));

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.setActionFeedback).toHaveBeenCalledWith({
      tone: 'error',
      message: 'Scheduled run failed',
    });
    expect(context.scheduledRunsInFlight.size).toBe(0);
  });

  it('drops scheduled-run errors when the workspace update is already stale', async () => {
    const context = makeContext({
      isCurrentWorkspaceUpdate: () => false,
    });
    context.runTargetCommand.mockRejectedValue(new Error('Too late'));

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.setActionFeedback).not.toHaveBeenCalled();
    expect(context.scheduledRunsInFlight.size).toBe(0);
  });

  it('surfaces non-Error scheduled-run failures as readable feedback text', async () => {
    const context = makeContext();
    context.runTargetCommand.mockRejectedValue('scheduler exploded');

    await runScheduledWatchIntoState(context, 'alpha');

    expect(context.setActionFeedback).toHaveBeenCalledWith({
      tone: 'error',
      message: 'scheduler exploded',
    });
  });

  it('runs only due scheduled watches and skips paused, manual, invalid, and future checks', () => {
    const context = makeContext();
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [] },
      directoryName: 'due',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: null,
    });

    runDueScheduledWatches(
      context,
      [
        makeTarget({
          directoryName: 'due',
          lastRunAt: '2026-05-18T00:00:00Z',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'every_15_minutes', customExpression: null },
          }),
        }),
        makeTarget({
          directoryName: 'paused',
          lastRunAt: '2026-05-18T00:00:00Z',
          watchProfile: makeWatchProfile({
            paused: true,
            schedule: { preset: 'every_15_minutes', customExpression: null },
          }),
        }),
        makeTarget({
          directoryName: 'manual',
          lastRunAt: '2026-05-18T00:00:00Z',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'manual_only', customExpression: null },
          }),
        }),
        makeTarget({
          directoryName: 'future',
          lastRunAt: '2999-01-01T00:00:00Z',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'every_15_minutes', customExpression: null },
          }),
        }),
        makeTarget({
          directoryName: 'invalid',
          lastRunAt: 'not-a-date',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'every_15_minutes', customExpression: null },
          }),
        }),
      ],
      Date.parse('2026-05-19T12:00:00Z'),
    );

    expect(context.runTargetCommand).toHaveBeenCalledTimes(1);
    expect(context.runTargetCommand).toHaveBeenCalledWith('due');
  });

  it('uses the current clock when no explicit scheduler timestamp is provided', () => {
    const context = makeContext();
    context.runTargetCommand.mockResolvedValue({
      workspace: { targets: [] },
      directoryName: 'due-now',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: null,
    });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-19T12:00:00Z'));

    runDueScheduledWatches(context, [
      makeTarget({
        directoryName: 'due-now',
        lastRunAt: '2026-05-19T11:40:00Z',
        watchProfile: makeWatchProfile({
          schedule: { preset: 'every_15_minutes', customExpression: null },
        }),
      }),
    ]);

    expect(context.runTargetCommand).toHaveBeenCalledWith('due-now');
  });
});
