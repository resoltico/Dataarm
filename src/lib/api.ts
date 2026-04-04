import { invoke } from '@tauri-apps/api/core';
import type {
  BundleHydrationStatus,
  BundleManifest,
  DesktopAppInfo,
  ProbeResult,
  ProjectStatus,
  RecentWorkspace,
  RunDetail,
  RunRecord,
  SidecarHealth,
  TargetRecord,
  RuntimeReadinessStatus,
  WorkspaceDiagnostics,
  WorkspaceSummary,
} from '../types';

/** Returns desktop identity and current execution mode. */
export async function getAppInfo(): Promise<DesktopAppInfo> {
  return invoke('get_app_info');
}

/** Returns current sidecar resolution facts for the host. */
export async function getSidecarHealth(): Promise<SidecarHealth> {
  return invoke('get_sidecar_health');
}

/** Returns the active machine-readable bundle contract. */
export async function getBundleManifest(): Promise<BundleManifest> {
  return invoke('get_bundle_manifest');
}

/** Returns current bundle input presence and executability. */
export async function getBundleHydrationStatus(): Promise<BundleHydrationStatus> {
  return invoke('get_bundle_hydration_status');
}

/** Returns host-local runtime availability for the bundled sidecar pair. */
export async function getRuntimeReadinessStatus(): Promise<RuntimeReadinessStatus> {
  return invoke('get_runtime_readiness_status');
}

/** Returns the compact maintainer-facing project status surface. */
export async function getProjectStatus(): Promise<ProjectStatus> {
  return invoke('get_project_status');
}

/** Runs a one-shot FFHN probe against the current runtime posture. */
export async function runFfhnProbe(): Promise<ProbeResult> {
  return invoke('run_ffhn_probe');
}

/** Opens a workspace or falls back to the committed sample workspace. */
export async function openWorkspace(workspacePath?: string): Promise<WorkspaceSummary> {
  return invoke('open_workspace', { workspacePath });
}

/** Creates a workspace layout if needed and opens it. */
export async function createWorkspace(workspacePath: string): Promise<WorkspaceSummary> {
  return invoke('create_workspace', { workspacePath });
}

/** Lists targets visible in the current workspace. */
export async function listTargets(workspacePath?: string): Promise<TargetRecord[]> {
  return invoke('list_targets', { workspacePath });
}

/** Explicitly creates or updates a target record in the current workspace. */
export async function createTarget(target: TargetRecord, workspacePath?: string): Promise<void> {
  return invoke('create_target', { target, workspacePath });
}

/** Permanently removes a target from the current workspace. */
export async function deleteTarget(targetId: string, workspacePath?: string): Promise<void> {
  return invoke('delete_target', { targetId, workspacePath });
}

/** Creates a copy of an existing target in the current workspace. */
export async function duplicateTarget(
  targetId: string,
  workspacePath?: string,
): Promise<TargetRecord> {
  return invoke('duplicate_target', { targetId, workspacePath });
}

/** Inverts the enabled/disabled state of a given target. */
export async function toggleTargetState(
  targetId: string,
  workspacePath?: string,
): Promise<TargetRecord> {
  return invoke('toggle_target', { targetId, workspacePath });
}

/** Lists run history visible in the current workspace. */
export async function listRuns(workspacePath?: string): Promise<RunRecord[]> {
  return invoke('list_runs', { workspacePath });
}

/** Returns the persisted or derived detail for a selected run. */
export async function getRunDetail(runId: string, workspacePath?: string): Promise<RunDetail> {
  return invoke('get_run_detail', { runId, workspacePath });
}

/** Returns diagnostics that explain the current runtime behavior. */
export async function getWorkspaceDiagnostics(
  workspacePath?: string,
): Promise<WorkspaceDiagnostics> {
  return invoke('get_workspace_diagnostics', { workspacePath });
}

/** Runs all targets through either live FFHN or the explicit mock fallback. */
export async function runAllTargets(workspacePath?: string): Promise<RunRecord[]> {
  return invoke('run_all_targets', { workspacePath });
}

/** Runs a single target through either live FFHN or the explicit mock fallback. */
export async function runTarget(targetId: string, workspacePath?: string): Promise<RunRecord> {
  return invoke('run_target', { targetId, workspacePath });
}

/** Returns desktop-local recently opened workspaces. */
export async function listRecentWorkspaces(): Promise<RecentWorkspace[]> {
  return invoke('list_recent_workspaces');
}

/** Opens the OS native explorer for the given path. */
export async function openPath(path: string): Promise<void> {
  return invoke('open_path', { path });
}
