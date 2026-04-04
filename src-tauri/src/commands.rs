use tauri::State;
use serde_json::Value;

use crate::models::*;
use crate::logic::*;

#[tauri::command]
fn get_app_info() -> DesktopAppInfo {
    get_app_info_state()
}

#[tauri::command]
fn get_sidecar_health() -> SidecarHealth {
    get_sidecar_health_state()
}

#[tauri::command]
fn get_bundle_manifest() -> Result<BundleManifest, String> {
    load_bundle_manifest().ok_or_else(|| "Missing vendor/bundle-manifest.json".to_string())
}

#[tauri::command]
fn get_bundle_hydration_status() -> BundleHydrationStatus {
    get_bundle_hydration_state()
}

#[tauri::command]
fn get_runtime_readiness_status() -> RuntimeReadinessStatus {
    get_runtime_readiness_state()
}

#[tauri::command]
fn get_project_status() -> Result<ProjectStatus, String> {
    get_project_status_state()
}

#[tauri::command]
fn run_ffhn_probe() -> Result<ProbeResult, String> {
    run_ffhn_probe_state()
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    open_path_logic(path)
}

#[tauri::command]
fn open_workspace(state: State<AppState>, workspace_path: Option<String>) -> WorkspaceSummary {
    open_workspace_logic(&state, workspace_path)
}

#[tauri::command]
fn create_workspace(state: State<AppState>, workspace_path: String) -> WorkspaceSummary {
    open_workspace_logic(&state, Some(workspace_path))
}

#[tauri::command]
fn create_target(target: TargetRecord, workspace_path: Option<String>) -> Result<(), String> {
    create_target_logic(target, workspace_path)
}

#[tauri::command]
fn delete_target(target_id: String, workspace_path: Option<String>) -> Result<(), String> {
    delete_target_logic(target_id, workspace_path)
}

#[tauri::command]
fn duplicate_target(
    target_id: String,
    workspace_path: Option<String>,
) -> Result<TargetRecord, String> {
    duplicate_target_logic(target_id, workspace_path)
}

#[tauri::command]
fn toggle_target(
    target_id: String,
    workspace_path: Option<String>,
) -> Result<TargetRecord, String> {
    toggle_target_logic(target_id, workspace_path)
}

#[tauri::command]
fn list_targets(workspace_path: Option<String>) -> Vec<TargetRecord> {
    load_targets_from_workspace(&resolve_workspace_path(workspace_path))
}

#[tauri::command]
fn list_runs(state: State<AppState>, workspace_path: Option<String>) -> Vec<RunRecord> {
    let records = load_runs_from_workspace(&resolve_workspace_path(workspace_path));
    let mut state_runs = state.runs.lock().unwrap();
    *state_runs = records.clone();
    records
}

#[tauri::command]
fn get_run_detail(
    state: State<AppState>,
    run_id: String,
    workspace_path: Option<String>,
) -> Result<RunDetail, String> {
    get_run_detail_logic(&state, run_id, workspace_path)
}

#[tauri::command]
fn get_workspace_diagnostics(workspace_path: Option<String>) -> WorkspaceDiagnostics {
    get_workspace_diagnostics_state(workspace_path)
}

#[tauri::command]
fn run_all_targets(
    state: State<AppState>,
    workspace_path: Option<String>,
) -> Result<Vec<RunRecord>, String> {
    run_all_targets_logic(&state, workspace_path)
}

#[tauri::command]
fn run_target(
    state: State<AppState>,
    target_id: String,
    workspace_path: Option<String>,
) -> Result<RunRecord, String> {
    run_target_logic(&state, target_id, workspace_path)
}

#[tauri::command]
fn list_recent_workspaces(state: State<AppState>) -> Vec<RecentWorkspace> {
    list_recent_workspaces_logic(&state)
}