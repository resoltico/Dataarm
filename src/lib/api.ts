import { invoke } from '@tauri-apps/api/core';
import {
  bootstrapMock,
  clearNotificationFeedMock,
  createWorkspaceMock,
  deleteTargetMock,
  getTargetTemplateMock,
  openTargetPathMock,
  openWorkspacePathMock,
  openWorkspaceMock,
  previewTargetMock,
  readTargetMock,
  refreshWorkspaceMock,
  runTargetMock,
  runWorkspaceMock,
  saveTargetMock,
  updateNotificationSettingsMock,
} from './mockDesktop';
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

function shouldUseMockBackend() {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
}

export async function bootstrap(): Promise<DesktopBootstrap> {
  if (shouldUseMockBackend()) {
    return bootstrapMock();
  }
  return invoke('bootstrap');
}

export async function openWorkspace(workspacePath?: string): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return openWorkspaceMock(workspacePath);
  }
  return invoke('open_workspace', { workspacePath });
}

export async function refreshWorkspace(): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return refreshWorkspaceMock();
  }
  return invoke('refresh_workspace');
}

export async function createWorkspace(workspacePath: string): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return createWorkspaceMock(workspacePath);
  }
  return invoke('create_workspace', { workspacePath });
}

export async function readTarget(directoryName: string): Promise<TargetDocumentRecord> {
  if (shouldUseMockBackend()) {
    return readTargetMock(directoryName);
  }
  return invoke('read_target', { directoryName });
}

export async function getTargetTemplate(kind: TargetTemplateKind): Promise<TargetTemplate> {
  if (shouldUseMockBackend()) {
    return getTargetTemplateMock(kind);
  }
  return invoke('get_target_template', { kind });
}

export async function previewTarget(request: TargetPreviewRequest): Promise<TargetPreview> {
  if (shouldUseMockBackend()) {
    return previewTargetMock(request);
  }
  return invoke('preview_target', { request });
}

export async function saveTarget(request: TargetSaveRequest): Promise<TargetMutationResult> {
  if (shouldUseMockBackend()) {
    return saveTargetMock(request);
  }
  return invoke('save_target', { request });
}

export async function updateNotificationSettings(
  settings: NotificationSettings,
): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return updateNotificationSettingsMock(settings);
  }
  return invoke('update_notification_settings', { settings });
}

export async function clearNotificationFeed(): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return clearNotificationFeedMock();
  }
  return invoke('clear_notification_feed');
}

export async function deleteTarget(directoryName: string): Promise<WorkspaceSnapshot> {
  if (shouldUseMockBackend()) {
    return deleteTargetMock(directoryName);
  }
  return invoke('delete_target', { directoryName });
}

export async function runTarget(directoryName: string): Promise<TargetRunResult> {
  if (shouldUseMockBackend()) {
    return runTargetMock(directoryName);
  }
  return invoke('run_target', { directoryName });
}

export async function runWorkspace(maxConcurrency?: number): Promise<BatchRunResult> {
  if (shouldUseMockBackend()) {
    return runWorkspaceMock();
  }
  return invoke('run_workspace', { maxConcurrency });
}

export async function openWorkspacePath(): Promise<void> {
  if (shouldUseMockBackend()) {
    return openWorkspacePathMock();
  }
  return invoke('open_workspace_path');
}

export async function openTargetPath(directoryName: string): Promise<void> {
  if (shouldUseMockBackend()) {
    return openTargetPathMock(directoryName);
  }
  return invoke('open_target_path', { directoryName });
}
