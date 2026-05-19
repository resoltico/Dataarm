use std::fs;
use std::path::Path;

pub(super) const DEMO_WORKSPACE_VERSION: &str = "2026-05-15.1";

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

fn write_demo_target(root: &Path, target_id: &str, toml: &str) -> Result<(), String> {
    let target_dir = root.join(target_id);
    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Failed to create {}: {error}", target_dir.display()))?;
    fs::write(target_dir.join("target.toml"), toml)
        .map_err(|error| format!("Failed to write demo target {target_id}: {error}"))
}
