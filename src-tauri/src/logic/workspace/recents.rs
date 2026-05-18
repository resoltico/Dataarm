use super::{ResolvedWorkspace, now_timestamp, same_path, workspace_name};
use crate::models::{AppState, RecentWorkspace, RecentWorkspaceEnvelope, WorkspaceSource};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

const RECENT_WORKSPACES_SCHEMA_VERSION: u32 = 1;
const MAX_RECENT_WORKSPACES: usize = 10;

pub(super) fn remember_recent_workspace(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &ResolvedWorkspace,
) -> Result<(), String> {
    let _guard = state.lock_recent_workspaces()?;
    let mut recents = load_recent_workspaces(app)?;
    recents.retain(|item| !same_path(Path::new(&item.workspace_path), &workspace.path));
    recents.insert(
        0,
        RecentWorkspace {
            workspace_name: workspace_name(&workspace.path),
            workspace_path: workspace.path.display().to_string(),
            workspace_source: WorkspaceSource::from_workspace_origin(workspace.origin.as_str())?,
            last_opened_at: now_timestamp()?,
        },
    );
    recents.truncate(MAX_RECENT_WORKSPACES);

    let state_file = recent_workspaces_file(app)?;
    if let Some(parent) = state_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }
    let payload = RecentWorkspaceEnvelope {
        schema_version: RECENT_WORKSPACES_SCHEMA_VERSION,
        items: recents,
    };
    let encoded = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Failed to encode recent workspaces: {error}"))?;
    fs::write(&state_file, encoded)
        .map_err(|error| format!("Failed to write {}: {error}", state_file.display()))
}

pub(super) fn load_recent_workspaces(app: &AppHandle) -> Result<Vec<RecentWorkspace>, String> {
    let state_file = recent_workspaces_file(app)?;
    if !state_file.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&state_file)
        .map_err(|error| format!("Failed to read {}: {error}", state_file.display()))?;
    let envelope: RecentWorkspaceEnvelope = serde_json::from_str(&content)
        .map_err(|error| format!("Failed to decode {}: {error}", state_file.display()))?;

    if envelope.schema_version != RECENT_WORKSPACES_SCHEMA_VERSION {
        return Ok(Vec::new());
    }

    Ok(envelope
        .items
        .into_iter()
        .filter(|item| Path::new(&item.workspace_path).is_dir())
        .collect())
}

fn recent_workspaces_file(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(root.join("desktop-state").join("recent-workspaces.json"))
}
