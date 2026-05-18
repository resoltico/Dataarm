use super::notifications::notification_center_snapshot;
use crate::models::{
    AppState, DesktopAppInfo, DesktopBootstrap, RecentWorkspace, RecentWorkspaceEnvelope,
    TargetSummary, WorkspaceSnapshot, WorkspaceSummary,
};
use ffhn_core::{self, LastRunSnapshot, ProcessErrorDetail, StatusReport, TargetDocument};
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

const DEMO_WORKSPACE_VERSION: &str = "2026-05-15.1";
const RECENT_WORKSPACES_SCHEMA_VERSION: u32 = 1;
const MAX_RECENT_WORKSPACES: usize = 10;

const DEMO_STATUS_BOARD_HTML: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Dataarm Demo Status Board</title>
  </head>
  <body>
    <main>
      <h1>Service Status</h1>
      <section class="status-board">
        <article class="status-card">
          <h2>Desktop runtime</h2>
          <p class="state">Green</p>
          <p class="note">Embedded ffhn-core path active.</p>
        </article>
      </section>
    </main>
  </body>
</html>
"#;

const DEMO_RELEASE_NOTES_HTML: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Dataarm Demo Release Notes</title>
  </head>
  <body>
    <article class="release">
      <h1>Release 7.0.0</h1>
      <p class="summary">Dataarm now runs the embedded runtime directly in process.</p>
      <ul>
        <li>Canonical watch-root targets</li>
        <li>Dry-run previews from ffhn-core</li>
        <li>Batch execution without sidecars</li>
      </ul>
    </article>
  </body>
</html>
"#;

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
    set_current_workspace(state, &resolved);
    remember_recent_workspace(app, state, &resolved)?;
    workspace_snapshot(app, &resolved)
}

pub(crate) fn create_workspace_logic(
    app: &AppHandle,
    state: &State<AppState>,
    workspace_path: String,
) -> Result<WorkspaceSnapshot, String> {
    let resolved = resolve_workspace_request(app, Some(workspace_path), true)?;
    set_current_workspace(state, &resolved);
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
        .current_workspace_path
        .lock()
        .unwrap()
        .clone()
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
        workspace_source: workspace.origin.as_str().to_owned(),
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

pub(super) fn inventory_targets(workspace: &Path) -> Result<Vec<TargetSummary>, String> {
    ensure_directory(workspace, "workspace")?;
    let mut targets = Vec::new();

    for entry in fs::read_dir(workspace)
        .map_err(|error| format!("Failed to read workspace {}: {error}", workspace.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read workspace entry: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("Failed to inspect workspace entry: {error}"))?
            .is_dir()
        {
            continue;
        }

        let target_file = entry.path().join("target.toml");
        if !target_file.is_file() {
            continue;
        }

        targets.push(inventory_target_directory(workspace, entry.path())?);
    }

    targets.sort_by(target_sort_key);
    Ok(targets)
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
        .unwrap_or_else(|_| std::env::temp_dir().join("ffhn"))
        .join("demo-watch-root")
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
        None => ensure_demo_workspace(app),
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

fn ensure_demo_workspace(app: &AppHandle) -> Result<ResolvedWorkspace, String> {
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
    materialize_demo_workspace(&root)?;
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

fn version_needs_refresh(version_file: &Path) -> Result<bool, String> {
    if !version_file.exists() {
        return Ok(true);
    }

    let version = fs::read_to_string(version_file)
        .map_err(|error| format!("Failed to read {}: {error}", version_file.display()))?;
    Ok(version.trim() != DEMO_WORKSPACE_VERSION)
}

fn materialize_demo_workspace(root: &Path) -> Result<(), String> {
    let sources_dir = root.join("sources");
    fs::create_dir_all(&sources_dir)
        .map_err(|error| format!("Failed to create {}: {error}", sources_dir.display()))?;

    let status_board_path = sources_dir.join("status-board.html");
    let release_notes_path = sources_dir.join("release-notes.html");
    fs::write(&status_board_path, DEMO_STATUS_BOARD_HTML)
        .map_err(|error| format!("Failed to write {}: {error}", status_board_path.display()))?;
    fs::write(&release_notes_path, DEMO_RELEASE_NOTES_HTML)
        .map_err(|error| format!("Failed to write {}: {error}", release_notes_path.display()))?;

    write_demo_target(
        root,
        "status_board",
        &format!(
            r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "status_board"
display_name = "Demo status board"
enabled = true

[target]
kind = "file"
file_path = "{}"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = ".status-card"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
"#,
            status_board_path.display()
        ),
    )?;

    write_demo_target(
        root,
        "release_notes",
        &format!(
            r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "release_notes"
display_name = "Demo release notes"
enabled = true

[target]
kind = "file"
file_path = "{}"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = ".release"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
"#,
            release_notes_path.display()
        ),
    )?;

    Ok(())
}

fn write_demo_target(root: &Path, target_id: &str, toml: &str) -> Result<(), String> {
    let target_dir = root.join(target_id);
    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Failed to create {}: {error}", target_dir.display()))?;
    fs::write(target_dir.join("target.toml"), toml)
        .map_err(|error| format!("Failed to write demo target {target_id}: {error}"))
}

fn remember_recent_workspace(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &ResolvedWorkspace,
) -> Result<(), String> {
    let _guard = state.recent_workspaces_lock.lock().unwrap();
    let mut recents = load_recent_workspaces(app)?;
    recents.retain(|item| !same_path(Path::new(&item.workspace_path), &workspace.path));
    recents.insert(
        0,
        RecentWorkspace {
            workspace_name: workspace_name(&workspace.path),
            workspace_path: workspace.path.display().to_string(),
            workspace_source: workspace.origin.as_str().to_owned(),
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

fn set_current_workspace(state: &State<AppState>, workspace: &ResolvedWorkspace) {
    *state.current_workspace_path.lock().unwrap() = Some(workspace.path.clone());
}

fn load_recent_workspaces(app: &AppHandle) -> Result<Vec<RecentWorkspace>, String> {
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

fn inventory_target_directory(
    workspace: &Path,
    target_dir: PathBuf,
) -> Result<TargetSummary, String> {
    let directory_name = target_dir
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Invalid target directory name {}", target_dir.display()))?
        .to_owned();
    let target_file = target_dir.join("target.toml");
    let raw_toml = fs::read_to_string(&target_file)
        .map_err(|error| format!("Failed to read {}: {error}", target_file.display()))?;
    let parsed_target = read_target_document(&raw_toml);
    let target_paths = ffhn_core::TargetPaths::try_new(workspace, directory_name.as_str());

    let status_result = match &target_paths {
        Ok(paths) => Some(ffhn_core::status(paths)),
        Err(_) => None,
    };

    let last_run_snapshot = match &target_paths {
        Ok(paths) => read_last_run_snapshot(paths.last_run_file()),
        Err(_) => None,
    };

    let (runnable_target_id, status_kind, baseline_phase, error_message) =
        match (&target_paths, &status_result) {
            (Err(error), _) => (
                None,
                "directory_invalid".to_owned(),
                None,
                Some(error.to_string()),
            ),
            (Ok(_), Some(Err(error))) => (
                Some(directory_name.clone()),
                "status_error".to_owned(),
                None,
                Some(error.to_string()),
            ),
            (Ok(_), Some(Ok(report))) => (
                Some(report.target_id().to_owned()),
                report.status().kind_str().to_owned(),
                report
                    .baseline_phase()
                    .map(|value| value.as_str().to_owned()),
                report.error_detail().map(format_process_error),
            ),
            (Ok(_), None) => (
                Some(directory_name.clone()),
                "status_error".to_owned(),
                None,
                Some("Target inventory could not load status.".to_owned()),
            ),
        };

    let parsed_target_ref = parsed_target.as_ref().ok();
    let parsed_target_error = parsed_target.as_ref().err().cloned();
    let declared_target_id = parsed_target_ref.map(|target| target.target_id().to_owned());
    let final_target_id = runnable_target_id.clone().or(declared_target_id);

    Ok(TargetSummary {
        directory_name,
        target_directory_path: target_dir.display().to_string(),
        target_id: final_target_id,
        runnable_target_id,
        display_name: parsed_target_ref
            .map(|target| target.display_name().to_owned())
            .or_else(|| status_result.as_ref().and_then(status_display_name)),
        enabled: parsed_target_ref
            .map(TargetDocument::enabled)
            .or_else(|| status_result.as_ref().and_then(status_enabled)),
        source_kind: parsed_target_ref.map(|target| {
            if target.source_url().is_some() {
                "http".to_owned()
            } else {
                "file".to_owned()
            }
        }),
        source_locator: parsed_target_ref.and_then(target_source_locator),
        selection_kind: parsed_target_ref.map(|target| target.selection_kind().as_str().to_owned()),
        selection_label: parsed_target_ref.map(target_selection_label),
        compare_basis: parsed_target_ref.map(|target| target.compare_basis().as_str().to_owned()),
        status_kind,
        baseline_phase,
        last_run_outcome: last_run_snapshot
            .as_ref()
            .map(|snapshot| snapshot.run_report().run_outcome().as_str().to_owned()),
        last_run_at: last_run_snapshot
            .as_ref()
            .map(|snapshot| snapshot.run_report().run_started_at().to_owned()),
        error_message: error_message.or(parsed_target_error),
    })
}

fn read_last_run_snapshot(path: PathBuf) -> Option<LastRunSnapshot> {
    if !path.is_file() {
        return None;
    }

    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn status_display_name(result: &Result<StatusReport, ffhn_core::CoreError>) -> Option<String> {
    result
        .as_ref()
        .ok()
        .and_then(|report| report.display_name().map(ToOwned::to_owned))
}

fn status_enabled(result: &Result<StatusReport, ffhn_core::CoreError>) -> Option<bool> {
    result.as_ref().ok().and_then(StatusReport::enabled)
}

fn target_sort_key(left: &TargetSummary, right: &TargetSummary) -> Ordering {
    let left_key = left
        .display_name
        .as_deref()
        .unwrap_or(&left.directory_name)
        .to_ascii_lowercase();
    let right_key = right
        .display_name
        .as_deref()
        .unwrap_or(&right.directory_name)
        .to_ascii_lowercase();

    left_key
        .cmp(&right_key)
        .then_with(|| left.directory_name.cmp(&right.directory_name))
}

fn target_requires_attention(target: &TargetSummary) -> bool {
    !matches!(target.status_kind.as_str(), "ready" | "pending")
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn inventory_marks_invalid_directory_ids_without_hiding_target_details() {
        let temp = tempdir().expect("tempdir");
        let target_dir = temp.path().join("Bad-Target");
        fs::create_dir_all(&target_dir).expect("create target dir");
        fs::write(
            target_dir.join("target.toml"),
            r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "good_target"
display_name = "Good Target"
enabled = true

[target]
kind = "http"
source_url = "https://example.com"

[fetch]
engine = "http"
method = "GET"
timeout_ms = 15000
max_bytes = 2000000
user_agent = "ffhn/test"
follow_redirects = true
accept = "text/html"

[selection]
kind = "css_selector"
selector = "body"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"
"#,
        )
        .expect("write target");

        let targets = inventory_targets(temp.path()).expect("inventory");
        assert_eq!(targets.len(), 1);
        let target = &targets[0];
        assert_eq!(target.status_kind, "directory_invalid");
        assert_eq!(target.display_name.as_deref(), Some("Good Target"));
        assert_eq!(target.source_kind.as_deref(), Some("http"));
        assert!(target.error_message.is_some());
    }

    #[test]
    fn resolve_existing_target_directory_accepts_a_direct_child() {
        let temp = tempdir().expect("tempdir");
        let target_dir = temp.path().join("release_notes");
        fs::create_dir_all(&target_dir).expect("create target dir");

        let resolved = resolve_existing_target_directory(temp.path(), "release_notes")
            .expect("resolve target");

        assert_eq!(
            resolved,
            target_dir.canonicalize().expect("canonical target dir")
        );
    }

    #[test]
    fn resolve_existing_target_directory_rejects_traversal() {
        let temp = tempdir().expect("tempdir");
        fs::create_dir_all(temp.path().join("release_notes")).expect("create target dir");

        let error = resolve_existing_target_directory(temp.path(), "../escape")
            .expect_err("traversal should fail");

        assert!(error.contains("direct child"));
    }
}
