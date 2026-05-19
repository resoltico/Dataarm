mod demo;
mod inventory;
mod recents;
#[cfg(test)]
mod tests;

use super::notifications::notification_center_snapshot;
use super::workbench_fixtures::{
    demo_release_notes_html, demo_release_notes_target, demo_status_board_html,
    demo_status_board_target,
};
use crate::models::{
    AppState, DesktopAppInfo, DesktopBootstrap, WorkspaceSnapshot, WorkspaceSource,
    WorkspaceSummary,
};
use demo::{DEMO_WORKSPACE_VERSION, materialize_demo_workspace};
use ffhn_core::{self, ProcessErrorDetail, TargetDocument};
pub(crate) use inventory::inventory_targets;
use inventory::target_requires_attention;
use recents::{load_recent_workspaces, remember_recent_workspace};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum WorkspaceOrigin {
    Demo,
    User,
}

impl WorkspaceOrigin {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Demo => "demo",
            Self::User => "user",
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct ResolvedWorkspace {
    pub(crate) path: PathBuf,
    origin: WorkspaceOrigin,
}

pub(crate) fn bootstrap_logic(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<DesktopBootstrap, String> {
    let workspace = open_workspace_logic(app, state, None)?;
    Ok(DesktopBootstrap {
        app: app_info(),
        workspace,
    })
}

pub(crate) fn open_workspace_logic(
    app: &AppHandle,
    state: &State<AppState>,
    workspace_path: Option<String>,
) -> Result<WorkspaceSnapshot, String> {
    let resolved = resolve_workspace_request(app, workspace_path, false)?;
    set_current_workspace(state, &resolved)?;
    remember_recent_workspace(app, state, &resolved)?;
    workspace_snapshot(app, &resolved)
}

pub(crate) fn create_workspace_logic(
    app: &AppHandle,
    state: &State<AppState>,
    workspace_path: String,
) -> Result<WorkspaceSnapshot, String> {
    let resolved = resolve_workspace_request(app, Some(workspace_path), true)?;
    set_current_workspace(state, &resolved)?;
    remember_recent_workspace(app, state, &resolved)?;
    workspace_snapshot(app, &resolved)
}

pub(crate) fn refresh_workspace_logic(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<WorkspaceSnapshot, String> {
    let workspace = current_workspace(app, state)?;
    workspace_snapshot(app, &workspace)
}

pub(crate) fn current_workspace(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<ResolvedWorkspace, String> {
    let path = state
        .current_workspace_path()?
        .ok_or_else(|| "Open a workspace before using target commands.".to_owned())?;

    ensure_directory(&path, "workspace")?;
    Ok(ResolvedWorkspace {
        origin: workspace_origin(app, &path),
        path,
    })
}

pub(super) fn resolve_existing_target_directory(
    workspace: &Path,
    directory_name: &str,
) -> Result<PathBuf, String> {
    let direct_child = direct_child_directory_name(directory_name)?;
    let resolved = workspace
        .join(direct_child)
        .canonicalize()
        .map_err(|error| format!("Failed to open target directory {direct_child}: {error}"))?;

    ensure_directory(&resolved, "target directory")?;

    let expected_parent = workspace.canonicalize().map_err(|error| {
        format!(
            "Failed to resolve workspace {}: {error}",
            workspace.display()
        )
    })?;
    let actual_parent = resolved.parent().ok_or_else(|| {
        format!(
            "Target directory {} does not have a workspace parent.",
            resolved.display()
        )
    })?;

    if actual_parent != expected_parent {
        return Err(format!(
            "Target directory {direct_child} escapes the active workspace boundary."
        ));
    }

    Ok(resolved)
}

pub(super) fn direct_child_directory_name(directory_name: &str) -> Result<&str, String> {
    let path = Path::new(directory_name);
    let mut components = path.components();
    match (components.next(), components.next()) {
        (Some(std::path::Component::Normal(_)), None)
            if directory_name != "." && directory_name != ".." =>
        {
            Ok(directory_name)
        }
        _ => Err("Target directory must name a direct child of the active workspace.".to_owned()),
    }
}

pub(crate) fn workspace_snapshot(
    app: &AppHandle,
    workspace: &ResolvedWorkspace,
) -> Result<WorkspaceSnapshot, String> {
    let targets = inventory_targets(&workspace.path)?;
    let summary = WorkspaceSummary {
        workspace_name: workspace_name(&workspace.path),
        workspace_path: workspace.path.display().to_string(),
        workspace_source: WorkspaceSource::from_workspace_origin(workspace.origin.as_str())?,
        target_count: targets.len(),
        runnable_target_count: targets
            .iter()
            .filter(|target| target.runnable_target_id.is_some())
            .count(),
        issue_count: targets
            .iter()
            .filter(|target| target_requires_attention(target))
            .count(),
        last_run_count: targets
            .iter()
            .filter(|target| target.last_run_at.is_some())
            .count(),
    };

    Ok(WorkspaceSnapshot {
        summary,
        recent_workspaces: load_recent_workspaces(app)?,
        notification_center: notification_center_snapshot(app),
        targets,
    })
}

pub(super) fn read_target_document(raw_toml: &str) -> Result<TargetDocument, String> {
    toml::from_str(raw_toml).map_err(|error| error.to_string())
}

pub(super) fn canonical_target_toml(target: &TargetDocument) -> Result<String, String> {
    toml::to_string_pretty(target)
        .map_err(|error| format!("Failed to serialize target document: {error}"))
}

pub(super) fn target_selection_label(target: &TargetDocument) -> String {
    match target.selection_kind().as_str() {
        "css_selector" => format!(
            "{} ({})",
            target.selection_selector().unwrap_or("selector"),
            target.selection_match().as_str()
        ),
        "delimiter_pair" => format!(
            "{} … {} ({})",
            target.selection_start().unwrap_or("start"),
            target.selection_end().unwrap_or("end"),
            target.selection_match().as_str()
        ),
        _ => target.selection_kind().as_str().to_owned(),
    }
}

pub(super) fn target_source_locator(target: &TargetDocument) -> Option<String> {
    target
        .source_url()
        .map(|value| value.as_str().to_owned())
        .or_else(|| target.file_path().map(ToOwned::to_owned))
}

pub(super) fn format_process_error(detail: &ProcessErrorDetail) -> String {
    match detail.path() {
        Some(path) => format!("{} ({path})", detail.message()),
        None => detail.message().to_owned(),
    }
}

pub(super) fn workspace_origin(app: &AppHandle, path: &Path) -> WorkspaceOrigin {
    let demo_path = demo_workspace_root(app);
    if same_path(path, &demo_path) {
        WorkspaceOrigin::Demo
    } else {
        WorkspaceOrigin::User
    }
}

pub(super) fn demo_workspace_root(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("dataarm"))
        .join("demo-watch-root")
}

pub(super) fn default_workspace_root(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("dataarm"))
        .join("watch-library")
}

pub(super) fn ensure_directory(path: &Path, label: &str) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to read {label} {}: {error}", path.display()))?;
    if metadata.is_dir() {
        Ok(())
    } else {
        Err(format!("{label} {} is not a directory", path.display()))
    }
}

fn app_info() -> DesktopAppInfo {
    DesktopAppInfo {
        app_name: "Dataarm".to_owned(),
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        runtime_contract: "embedded-ffhn-core".to_owned(),
    }
}

fn resolve_workspace_request(
    app: &AppHandle,
    workspace_path: Option<String>,
    create_missing: bool,
) -> Result<ResolvedWorkspace, String> {
    match workspace_path {
        Some(path) => resolve_user_workspace(path, app, create_missing),
        None => ensure_default_workspace(app),
    }
}

fn resolve_user_workspace(
    workspace_path: String,
    app: &AppHandle,
    create_missing: bool,
) -> Result<ResolvedWorkspace, String> {
    let input = PathBuf::from(workspace_path);
    if create_missing {
        fs::create_dir_all(&input)
            .map_err(|error| format!("Failed to create workspace {}: {error}", input.display()))?;
    }

    let path = input
        .canonicalize()
        .map_err(|error| format!("Failed to open workspace {}: {error}", input.display()))?;
    ensure_directory(&path, "workspace")?;
    Ok(ResolvedWorkspace {
        origin: workspace_origin(app, &path),
        path,
    })
}

fn ensure_default_workspace(app: &AppHandle) -> Result<ResolvedWorkspace, String> {
    let root = default_workspace_root(app);
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create workspace {}: {error}", root.display()))?;
    ensure_default_examples(&root)?;
    Ok(ResolvedWorkspace {
        origin: WorkspaceOrigin::User,
        path: root,
    })
}

fn ensure_default_examples(workspace_root: &Path) -> Result<(), String> {
    let examples_root = workspace_root.join(".dataarm").join("examples");
    let version_file = examples_root.join(".examples-version");

    let refresh = match fs::read_to_string(&version_file) {
        Ok(version) => version.trim() != DEMO_WORKSPACE_VERSION,
        Err(_) => true,
    };

    if !refresh {
        return Ok(());
    }

    if examples_root.exists() {
        fs::remove_dir_all(&examples_root).map_err(|error| {
            format!(
                "Failed to reset example library {}: {error}",
                examples_root.display()
            )
        })?;
    }

    fs::create_dir_all(&examples_root).map_err(|error| {
        format!(
            "Failed to create example library {}: {error}",
            examples_root.display()
        )
    })?;
    materialize_demo_workspace(
        &examples_root,
        &demo_status_board_html(),
        &demo_release_notes_html(),
        &demo_status_board_target(&examples_root.display().to_string()),
        &demo_release_notes_target(&examples_root.display().to_string()),
    )?;
    fs::write(&version_file, DEMO_WORKSPACE_VERSION).map_err(|error| {
        format!(
            "Failed to persist example library version {}: {error}",
            version_file.display()
        )
    })
}

fn set_current_workspace(
    state: &State<AppState>,
    workspace: &ResolvedWorkspace,
) -> Result<(), String> {
    state.set_current_workspace_path(Some(workspace.path.clone()))
}

fn now_timestamp() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| format!("Failed to format current time: {error}"))
}

fn same_path(left: &Path, right: &Path) -> bool {
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

fn workspace_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| path.display().to_string())
}
