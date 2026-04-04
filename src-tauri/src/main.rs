#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod logic;
mod commands;

use crate::models::*;
use crate::commands::*;

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_sidecar_health,
            get_bundle_manifest,
            get_bundle_hydration_status,
            get_runtime_readiness_status,
            get_project_status,
            run_ffhn_probe,
            open_workspace,
            create_workspace,
            create_target,
            delete_target,
            duplicate_target,
            toggle_target,
            list_targets,
            list_runs,
            get_run_detail,
            get_workspace_diagnostics,
            run_all_targets,
            run_target,
            list_recent_workspaces,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running FFHN Desktop");
}