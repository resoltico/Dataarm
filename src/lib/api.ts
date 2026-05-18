import { invoke } from '@tauri-apps/api/core';
import {
  bootstrapWorkbench,
  clearNotificationFeedWorkbench,
  createWorkspaceWorkbench,
  deleteTargetWorkbench,
  getTargetTemplateWorkbench,
  openTargetPathWorkbench,
  openWorkspacePathWorkbench,
  openWorkspaceWorkbench,
  previewTargetWorkbench,
  readTargetWorkbench,
  refreshWorkspaceWorkbench,
  runTargetWorkbench,
  runWorkspaceWorkbench,
  saveTargetWorkbench,
  updateNotificationSettingsWorkbench,
} from './browserWorkbenchClient';
import type {
  BatchRunResult,
  DesktopBootstrap,
  NotificationSettings,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetSaveRequest,
  TargetRunResult,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../types';

const BROWSER_WORKBENCH_BACKEND = 'browser_workbench';

function shouldUseBrowserWorkbenchBackend() {
  if (typeof window === 'undefined') {
    return false;
  }

  if ('__TAURI_INTERNALS__' in window) {
    return false;
  }

  if (import.meta.env.VITE_DATAARM_BROWSER_BACKEND === BROWSER_WORKBENCH_BACKEND) {
    return true;
  }

  throw new Error(
    'Browser runtime requires VITE_DATAARM_BROWSER_BACKEND=browser_workbench. Use the maintained browser workbench commands instead of opening the app bundle directly in a generic browser.',
  );
}

export async function bootstrap(): Promise<DesktopBootstrap> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return bootstrapWorkbench();
  }
  return invoke('bootstrap');
}

export async function openWorkspace(workspacePath?: string): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return openWorkspaceWorkbench(workspacePath);
  }
  return invoke('open_workspace', { workspacePath });
}

export async function refreshWorkspace(): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return refreshWorkspaceWorkbench();
  }
  return invoke('refresh_workspace');
}

export async function createWorkspace(workspacePath: string): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return createWorkspaceWorkbench(workspacePath);
  }
  return invoke('create_workspace', { workspacePath });
}

export async function readTarget(directoryName: string): Promise<TargetDocumentRecord> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return readTargetWorkbench(directoryName);
  }
  return invoke('read_target', { directoryName });
}

export async function getTargetTemplate(kind: TargetTemplateKind): Promise<TargetTemplate> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return getTargetTemplateWorkbench(kind);
  }
  return invoke('get_target_template', { kind });
}

export async function previewTarget(request: TargetPreviewRequest): Promise<TargetPreview> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return previewTargetWorkbench(request);
  }
  return invoke('preview_target', { request });
}

export async function saveTarget(request: TargetSaveRequest): Promise<TargetMutationResult> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return saveTargetWorkbench(request);
  }
  return invoke('save_target', { request });
}

export async function updateNotificationSettings(
  settings: NotificationSettings,
): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return updateNotificationSettingsWorkbench(settings);
  }
  return invoke('update_notification_settings', { settings });
}

export async function clearNotificationFeed(): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return clearNotificationFeedWorkbench();
  }
  return invoke('clear_notification_feed');
}

export async function deleteTarget(directoryName: string): Promise<WorkspaceSnapshot> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return deleteTargetWorkbench(directoryName);
  }
  return invoke('delete_target', { directoryName });
}

export async function runTarget(directoryName: string): Promise<TargetRunResult> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return runTargetWorkbench(directoryName);
  }
  return invoke('run_target', { directoryName });
}

export async function runWorkspace(maxConcurrency?: number): Promise<BatchRunResult> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return runWorkspaceWorkbench(maxConcurrency);
  }
  return invoke('run_workspace', { maxConcurrency });
}

export async function openWorkspacePath(): Promise<void> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return openWorkspacePathWorkbench();
  }
  return invoke('open_workspace_path');
}

export async function openTargetPath(directoryName: string): Promise<void> {
  if (shouldUseBrowserWorkbenchBackend()) {
    return openTargetPathWorkbench(directoryName);
  }
  return invoke('open_target_path', { directoryName });
}
