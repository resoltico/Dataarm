import type {
  BatchRunResult,
  DesktopBootstrap,
  NotificationSettings,
  SourceInspectionRequest,
  SourceInspectionResult,
  TargetDocumentRecord,
  TargetMutationResult,
  TargetPreview,
  TargetPreviewRequest,
  TargetRunResult,
  TargetSaveRequest,
  TargetTemplate,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../types';

const BROWSER_WORKBENCH_RPC_PATH = '/__dataarm/workbench/rpc';
const BROWSER_WORKBENCH_SESSION_STORAGE_KEY = 'dataarm.browserWorkbench.sessionId';
const BROWSER_WORKBENCH_SESSION_HEADER = 'x-dataarm-workbench-session';

let cachedSessionId: string | null = null;

function workbenchSessionId() {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(BROWSER_WORKBENCH_SESSION_STORAGE_KEY);
    if (stored) {
      cachedSessionId = stored;
      return cachedSessionId;
    }
  }

  const created = globalThis.crypto.randomUUID();
  cachedSessionId = created;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(BROWSER_WORKBENCH_SESSION_STORAGE_KEY, created);
  }
  return created;
}

async function callWorkbench<T>(method: string, params: Record<string, unknown> = {}) {
  const response = await fetch(BROWSER_WORKBENCH_RPC_PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [BROWSER_WORKBENCH_SESSION_HEADER]: workbenchSessionId(),
    },
    body: JSON.stringify({ sessionId: workbenchSessionId(), method, params }),
  });

  let payload: { ok?: boolean; result?: T; error?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Leave payload empty and fail below with the transport status if present.
  }

  if (!response.ok) {
    throw new Error(
      payload.error ??
        `Browser workbench request ${method} failed with HTTP ${String(response.status)}.`,
    );
  }

  if (!payload.ok) {
    throw new Error(payload.error ?? `Browser workbench request ${method} failed.`);
  }

  return payload.result as T;
}

export function bootstrapWorkbench(): Promise<DesktopBootstrap> {
  return callWorkbench('bootstrap');
}

export function openWorkspaceWorkbench(workspacePath?: string): Promise<WorkspaceSnapshot> {
  return callWorkbench('open_workspace', { workspacePath });
}

export function refreshWorkspaceWorkbench(): Promise<WorkspaceSnapshot> {
  return callWorkbench('refresh_workspace');
}

export function createWorkspaceWorkbench(workspacePath: string): Promise<WorkspaceSnapshot> {
  return callWorkbench('create_workspace', { workspacePath });
}

export function readTargetWorkbench(directoryName: string): Promise<TargetDocumentRecord> {
  return callWorkbench('read_target', { directoryName });
}

export function getTargetTemplateWorkbench(kind: TargetTemplateKind): Promise<TargetTemplate> {
  return callWorkbench('get_target_template', { kind });
}

export function inspectSourceWorkbench(
  request: SourceInspectionRequest,
): Promise<SourceInspectionResult> {
  return callWorkbench('inspect_source', { request });
}

export function previewTargetWorkbench(request: TargetPreviewRequest): Promise<TargetPreview> {
  return callWorkbench('preview_target', { request });
}

export function saveTargetWorkbench(request: TargetSaveRequest): Promise<TargetMutationResult> {
  return callWorkbench('save_target', { request });
}

export function updateNotificationSettingsWorkbench(
  settings: NotificationSettings,
): Promise<WorkspaceSnapshot> {
  return callWorkbench('update_notification_settings', { settings });
}

export function clearNotificationFeedWorkbench(): Promise<WorkspaceSnapshot> {
  return callWorkbench('clear_notification_feed');
}

export function deleteTargetWorkbench(directoryName: string): Promise<WorkspaceSnapshot> {
  return callWorkbench('delete_target', { directoryName });
}

export function runTargetWorkbench(directoryName: string): Promise<TargetRunResult> {
  return callWorkbench('run_target', { directoryName });
}

export function runWorkspaceWorkbench(maxConcurrency?: number): Promise<BatchRunResult> {
  return callWorkbench('run_workspace', { maxConcurrency });
}

export function openWorkspacePathWorkbench(): Promise<void> {
  return callWorkbench('open_workspace_path');
}

export function openTargetPathWorkbench(directoryName: string): Promise<void> {
  return callWorkbench('open_target_path', { directoryName });
}
