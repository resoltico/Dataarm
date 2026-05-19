use ffhn_core::{self, StateDocument, TargetDocument};
use std::fs;
use std::path::Path;

pub(super) fn materialize_target_document(
    watch_root: &Path,
    target: &TargetDocument,
    canonical_toml: &str,
) -> Result<ffhn_core::TargetPaths, String> {
    let target_directory = watch_root.join(target.target_id());
    fs::create_dir_all(&target_directory).map_err(|error| {
        format!(
            "Failed to create target directory {}: {error}",
            target_directory.display()
        )
    })?;
    fs::write(target_directory.join("target.toml"), canonical_toml).map_err(|error| {
        format!(
            "Failed to write {}: {error}",
            target_directory.join("target.toml").display()
        )
    })?;
    ffhn_core::TargetPaths::try_new(watch_root, target.target_id())
        .map_err(|error| error.to_string())
}

pub(super) fn reset_target_runtime_artifacts(target_directory: &Path) -> Result<(), String> {
    remove_path_if_exists(&target_directory.join("state.json"))?;
    remove_path_if_exists(&target_directory.join("last_run.json"))?;
    remove_path_if_exists(&target_directory.join("lock"))?;
    remove_path_if_exists(&target_directory.join("snapshots"))?;
    Ok(())
}

pub(super) fn read_optional_json_value(
    path: &Path,
    issues: &mut Vec<String>,
) -> Option<serde_json::Value> {
    if !path.is_file() {
        return None;
    }

    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            issues.push(format!("Failed to read {}: {error}", path.display()));
            return None;
        }
    };

    match serde_json::from_str(&content) {
        Ok(value) => Some(value),
        Err(error) => {
            issues.push(format!("Failed to decode {}: {error}", path.display()));
            None
        }
    }
}

pub(super) fn read_optional_state_document(
    path: &Path,
    issues: &mut Vec<String>,
) -> Option<StateDocument> {
    if !path.is_file() {
        return None;
    }

    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            issues.push(format!("Failed to read {}: {error}", path.display()));
            return None;
        }
    };

    match serde_json::from_str::<StateDocument>(&content) {
        Ok(document) => match document.validate() {
            Ok(()) => Some(document),
            Err(error) => {
                issues.push(format!("Failed to validate {}: {error}", path.display()));
                None
            }
        },
        Err(error) => {
            issues.push(format!("Failed to decode {}: {error}", path.display()));
            None
        }
    }
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove {}: {error}", path.display()))
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove {}: {error}", path.display()))
    }
}
