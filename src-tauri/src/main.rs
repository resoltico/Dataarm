#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod logic;
mod models;

use crate::commands::*;
use crate::models::AppState;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .setup(|_app| {
            if let Ok(smoke_file) = std::env::var("DATAARM_NATIVE_SMOKE_FILE") {
                let smoke_path = PathBuf::from(smoke_file);
                if let Some(parent) = smoke_path.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!(
                            "Failed to create native smoke parent {}: {error}",
                            parent.display()
                        )
                    })?;
                }

                let payload = json!({
                    "appName": "Dataarm",
                    "appVersion": env!("CARGO_PKG_VERSION"),
                    "runtimeContract": "embedded-ffhn-core",
                });
                let encoded = serde_json::to_vec_pretty(&payload)
                    .map_err(|error| format!("Failed to encode native smoke payload: {error}"))?;
                fs::write(&smoke_path, encoded).map_err(|error| {
                    format!(
                        "Failed to write native smoke payload {}: {error}",
                        smoke_path.display()
                    )
                })?;
                std::process::exit(0);
            }

            Ok(())
        })
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
