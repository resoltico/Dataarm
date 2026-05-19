import type { ActionFeedback, TargetRunResult, TargetSummary } from '../types';
import { nextScheduledCheckAt } from '../lib/presentation';
import { createFeedback } from './dashboardState.helpers';

export type ScheduledWatchContext = {
  beginWorkspaceUpdate: () => number;
  isCurrentWorkspaceUpdate: (updateId: number) => boolean;
  scheduledRunsInFlight: Set<string>;
  runTargetCommand: (directoryName: string) => Promise<TargetRunResult>;
  hydrateWorkspaceSnapshot: (
    snapshot: TargetRunResult['workspace'],
    preferredDirectoryName: string | null,
    hydrationMode: 'preserve_view',
  ) => Promise<void>;
  selectedTargetDirectoryName: string | null;
  selectedDirectoryName: string | null;
  editorMode: 'existing' | 'http' | 'file';
  loadTargetDocument: (directoryName: string, loadMode: 'refresh_view') => Promise<void>;
  setActionFeedback: (feedback: ActionFeedback | null) => void;
};

export function activeScheduledWatchDirectoryName(
  editorMode: ScheduledWatchContext['editorMode'],
  selectedDirectoryName: string | null,
) {
  return editorMode === 'existing' ? selectedDirectoryName : null;
}

export async function runScheduledWatchIntoState(
  context: ScheduledWatchContext,
  directoryName: string,
) {
  if (context.scheduledRunsInFlight.has(directoryName)) {
    return;
  }
  context.scheduledRunsInFlight.add(directoryName);
  const updateId = context.beginWorkspaceUpdate();

  try {
    const result = await context.runTargetCommand(directoryName);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await context.hydrateWorkspaceSnapshot(
      result.workspace,
      context.selectedTargetDirectoryName,
      'preserve_view',
    );
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    if (context.selectedDirectoryName === directoryName && context.editorMode === 'existing') {
      await context.loadTargetDocument(directoryName, 'refresh_view');
    }
    if (result.notification?.deliveredChannels.includes('in_app')) {
      context.setActionFeedback(
        createFeedback(result.notification.tone, result.notification.title),
      );
    }
  } catch (error) {
    if (context.isCurrentWorkspaceUpdate(updateId)) {
      context.setActionFeedback(
        createFeedback('error', error instanceof Error ? error.message : String(error)),
      );
    }
  } finally {
    context.scheduledRunsInFlight.delete(directoryName);
  }
}

export function runDueScheduledWatches(
  context: ScheduledWatchContext,
  targets: TargetSummary[],
  now = Date.now(),
) {
  for (const target of targets) {
    const nextCheckAt = nextScheduledCheckAt(target);
    if (nextCheckAt == null) {
      continue;
    }
    const nextTimestamp = Date.parse(nextCheckAt);
    if (Number.isNaN(nextTimestamp) || nextTimestamp > now) {
      continue;
    }
    void runScheduledWatchIntoState(context, target.directoryName);
  }
}
