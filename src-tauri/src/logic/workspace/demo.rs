use super::{ResolvedWorkspace, WorkspaceOrigin, demo_workspace_root};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

pub(super) const DEMO_WORKSPACE_VERSION: &str = "2026-05-15.1";

pub(super) fn ensure_demo_workspace(
    app: &AppHandle,
    demo_status_board_html: &str,
    demo_release_notes_html: &str,
    demo_status_board_target: &str,
    demo_release_notes_target: &str,
) -> Result<ResolvedWorkspace, String> {
    let root = demo_workspace_root(app);
    let version_file = root.join(".demo-version");
    let refresh = version_needs_refresh(&version_file)?;

    if refresh && root.exists() {
        fs::remove_dir_all(&root).map_err(|error| {
            format!("Failed to reset demo workspace {}: {error}", root.display())
        })?;
    }

    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "Failed to create demo workspace {}: {error}",
            root.display()
        )
    })?;
    materialize_demo_workspace(
        &root,
        demo_status_board_html,
        demo_release_notes_html,
        demo_status_board_target,
        demo_release_notes_target,
    )?;
    fs::write(&version_file, DEMO_WORKSPACE_VERSION).map_err(|error| {
        format!(
            "Failed to persist demo workspace version {}: {error}",
            version_file.display()
        )
    })?;

    Ok(ResolvedWorkspace {
        path: root,
        origin: WorkspaceOrigin::Demo,
    })
}

pub(super) fn materialize_demo_workspace(
    root: &Path,
    demo_status_board_html: &str,
    demo_release_notes_html: &str,
    demo_status_board_target: &str,
    demo_release_notes_target: &str,
) -> Result<(), String> {
    let sources_dir = root.join("sources");
    fs::create_dir_all(&sources_dir)
        .map_err(|error| format!("Failed to create {}: {error}", sources_dir.display()))?;

    let status_board_path = sources_dir.join("status-board.html");
    let release_notes_path = sources_dir.join("release-notes.html");
    fs::write(&status_board_path, demo_status_board_html)
        .map_err(|error| format!("Failed to write {}: {error}", status_board_path.display()))?;
    fs::write(&release_notes_path, demo_release_notes_html)
        .map_err(|error| format!("Failed to write {}: {error}", release_notes_path.display()))?;

    write_demo_target(root, "status_board", demo_status_board_target)?;
    write_demo_target(root, "release_notes", demo_release_notes_target)?;

    Ok(())
}

pub(super) fn version_needs_refresh(version_file: &Path) -> Result<bool, String> {
    if !version_file.exists() {
        return Ok(true);
    }

    let version = fs::read_to_string(version_file)
        .map_err(|error| format!("Failed to read {}: {error}", version_file.display()))?;
    Ok(version.trim() != DEMO_WORKSPACE_VERSION)
}

fn write_demo_target(root: &Path, target_id: &str, toml: &str) -> Result<(), String> {
    let target_dir = root.join(target_id);
    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Failed to create {}: {error}", target_dir.display()))?;
    fs::write(target_dir.join("target.toml"), toml)
        .map_err(|error| format!("Failed to write demo target {target_id}: {error}"))
}
