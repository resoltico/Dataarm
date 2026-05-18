#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod logic;
mod models;

use crate::commands::*;
use crate::models::AppState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            open_workspace,
            refresh_workspace,
            create_workspace,
            read_target,
            get_target_template,
            preview_target,
            save_target,
            update_notification_settings,
            clear_notification_feed,
            delete_target,
            run_target,
            run_workspace,
            open_workspace_path,
            open_target_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dataarm");
}
