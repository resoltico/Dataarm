import {
  bootstrap,
  clearNotificationFeed,
  createWorkspace,
  openWorkspace,
  openWorkspacePath,
  updateNotificationSettings,
} from '../lib/api';
import type { ActionFeedback, AsyncState, NotificationSettings, WorkspaceSnapshot } from '../types';
import type { TargetDocumentLoadMode } from './dashboardState.editor';
import { errorMessage } from './dashboardState.helpers';

type Tone = ActionFeedback['tone'];
export type WorkspaceHydrationMode = 'reset_view' | 'preserve_view';

type WorkspaceStateContext = {
  beginWorkspaceUpdate: () => number;
  isCurrentWorkspaceUpdate: (updateId: number) => boolean;
  setWorkspace: (state: AsyncState<WorkspaceSnapshot>) => void;
  setSelectedDirectoryName: (directoryName: string | null) => void;
  selectedDirectoryName: string | null;
  setWorkspaceInput: (value: string) => void;
  setOpeningWorkspace: (opening: boolean) => void;
  setFeedback: (tone: Tone, message: string) => void;
  setActionFeedback: (feedback: ActionFeedback | null) => void;
  confirmDiscardDraft: () => boolean;
  clearEditor: () => void;
  loadTargetDocument: (directoryName: string, loadMode: TargetDocumentLoadMode) => Promise<void>;
};

type WorkspaceNotificationContext = {
  beginWorkspaceUpdate: () => number;
  isCurrentWorkspaceUpdate: (updateId: number) => boolean;
  hydrateWorkspaceSnapshot: (
    snapshot: WorkspaceSnapshot,
    preferredDirectoryName: string | null,
    hydrationMode: WorkspaceHydrationMode,
  ) => Promise<void>;
  selectedTargetDirectoryName: string | null;
  setFeedback: (tone: Tone, message: string) => void;
};

function defaultTargetDirectoryName(snapshot: WorkspaceSnapshot) {
  return [...snapshot.targets]
    .sort((left, right) => {
      const leftRun = left.lastRunAt ?? '';
      const rightRun = right.lastRunAt ?? '';
      if (leftRun !== rightRun) {
        return rightRun.localeCompare(leftRun);
      }

      const leftName = (left.displayName ?? left.directoryName).toLocaleLowerCase();
      const rightName = (right.displayName ?? right.directoryName).toLocaleLowerCase();
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }

      return left.directoryName.localeCompare(right.directoryName);
    })
    .at(0)?.directoryName;
}

export function applyWorkspaceSnapshotToState(
  context: Pick<WorkspaceStateContext, 'setWorkspace' | 'setSelectedDirectoryName'>,
  snapshot: WorkspaceSnapshot,
  preferredDirectoryName: string | null,
) {
  context.setWorkspace({ loading: false, error: null, data: snapshot });
  const nextDirectoryName =
    snapshot.targets.find((target) => target.directoryName === preferredDirectoryName)
      ?.directoryName ??
    defaultTargetDirectoryName(snapshot) ??
    null;

  context.setSelectedDirectoryName(nextDirectoryName);
  return nextDirectoryName;
}

export async function hydrateWorkspaceSnapshotIntoState(
  context: WorkspaceStateContext,
  snapshot: WorkspaceSnapshot,
  preferredDirectoryName: string | null,
  hydrationMode: WorkspaceHydrationMode = 'reset_view',
) {
  const nextDirectoryName = applyWorkspaceSnapshotToState(
    context,
    snapshot,
    preferredDirectoryName,
  );
  if (nextDirectoryName) {
    const loadMode: TargetDocumentLoadMode =
      hydrationMode === 'preserve_view' && nextDirectoryName === preferredDirectoryName
        ? 'refresh_view'
        : 'replace_view';
    await context.loadTargetDocument(nextDirectoryName, loadMode);
  } else {
    if (hydrationMode === 'preserve_view') {
      return;
    }
    context.clearEditor();
  }
}

export async function bootstrapWorkspaceIntoState(
  context: WorkspaceStateContext,
  isActive: () => boolean,
) {
  const updateId = context.beginWorkspaceUpdate();
  try {
    const payload = await bootstrap();
    if (!isActive() || !context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }

    await hydrateWorkspaceSnapshotIntoState(
      context,
      payload.workspace,
      context.selectedDirectoryName,
    );
  } catch (error) {
    if (!isActive() || !context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }

    const message = errorMessage(error);
    context.setWorkspace({ loading: false, error: message, data: null });
    context.setFeedback('error', message);
  }
}

export async function openWorkspaceRequestIntoState(context: WorkspaceStateContext, path?: string) {
  if (!context.confirmDiscardDraft()) {
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  context.setOpeningWorkspace(true);

  try {
    const snapshot = await openWorkspace(path);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await hydrateWorkspaceSnapshotIntoState(context, snapshot, context.selectedDirectoryName);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setWorkspaceInput('');
    context.setFeedback('success', 'Library loaded.');
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    const message = errorMessage(error);
    context.setFeedback('error', message);
  } finally {
    context.setOpeningWorkspace(false);
  }
}

export async function createWorkspaceFromInputIntoState(
  context: WorkspaceStateContext & { workspaceInput: string },
) {
  if (!context.confirmDiscardDraft()) {
    return;
  }
  const path = context.workspaceInput.trim();
  if (!path) {
    context.setFeedback('warning', 'Enter a library folder path first.');
    return;
  }

  const updateId = context.beginWorkspaceUpdate();
  context.setOpeningWorkspace(true);

  try {
    const snapshot = await createWorkspace(path);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await hydrateWorkspaceSnapshotIntoState(context, snapshot, context.selectedDirectoryName);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setWorkspaceInput('');
    context.setFeedback('success', 'Library created.');
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('error', errorMessage(error));
  } finally {
    context.setOpeningWorkspace(false);
  }
}

export async function updateNotificationSettingsIntoState(
  context: WorkspaceNotificationContext,
  settings: NotificationSettings,
) {
  const updateId = context.beginWorkspaceUpdate();
  try {
    const snapshot = await updateNotificationSettings(settings);
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await context.hydrateWorkspaceSnapshot(
      snapshot,
      context.selectedTargetDirectoryName,
      'preserve_view',
    );
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    const permissionState = snapshot.notificationCenter.permissionState;
    if (
      (settings.delivery === 'system' || settings.delivery === 'both') &&
      permissionState !== 'granted'
    ) {
      context.setFeedback('warning', 'System delivery is not ready on this runtime.');
      return;
    }
    context.setFeedback('success', 'Notification settings updated.');
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('error', errorMessage(error));
  }
}

export async function clearNotificationFeedIntoState(context: WorkspaceNotificationContext) {
  const updateId = context.beginWorkspaceUpdate();
  try {
    const snapshot = await clearNotificationFeed();
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    await context.hydrateWorkspaceSnapshot(
      snapshot,
      context.selectedTargetDirectoryName,
      'preserve_view',
    );
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('info', 'Notification history cleared.');
  } catch (error) {
    if (!context.isCurrentWorkspaceUpdate(updateId)) {
      return;
    }
    context.setFeedback('error', errorMessage(error));
  }
}

export async function openWorkspacePathIntoState(
  setFeedback: (tone: Tone, message: string) => void,
) {
  try {
    await openWorkspacePath();
  } catch (error) {
    setFeedback('error', errorMessage(error));
  }
}
