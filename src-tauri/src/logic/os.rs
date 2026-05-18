use super::workspace::{current_workspace, resolve_existing_target_directory};
use crate::models::AppState;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, State};

pub(crate) fn open_workspace_path_logic(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<(), String> {
    let workspace = current_workspace(app, state)?;
    spawn_open_command(&workspace.path)
}

pub(crate) fn open_target_path_logic(
    app: &AppHandle,
    state: &State<AppState>,
    directory_name: String,
) -> Result<(), String> {
    let workspace = current_workspace(app, state)?;
    let target_directory = resolve_existing_target_directory(&workspace.path, &directory_name)?;
    spawn_open_command(&target_directory)
}

fn spawn_open_command(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("Failed to open path {}: {error}", path.display()))?;
    Ok(())
}
