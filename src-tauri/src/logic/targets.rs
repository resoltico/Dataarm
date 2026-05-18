use super::runtime_artifacts::load_target_artifact_history;
use super::workspace::{
    canonical_target_toml, current_workspace, direct_child_directory_name, inventory_targets,
    read_target_document, resolve_existing_target_directory, workspace_snapshot,
};
use crate::models::{
    AppState, SkippedDirectory, TargetDocumentRecord, TargetMutationResult, TargetPreview,
    TargetSaveRequest, TargetTemplate, WorkspaceSnapshot,
};
use ffhn_core::{self, StateDocument, TargetDocument, TargetId};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, State};

pub(crate) fn read_target_logic(
    app: &AppHandle,
    state: &State<AppState>,
    directory_name: String,
) -> Result<TargetDocumentRecord, String> {
    let workspace = current_workspace(app, state)?;
    let target_directory = resolve_existing_target_directory(&workspace.path, &directory_name)?;
    let target_file = target_directory.join("target.toml");
    let raw_toml = fs::read_to_string(&target_file)
        .map_err(|error| format!("Failed to read {}: {error}", target_file.display()))?;
    let parsed_target = read_target_document(&raw_toml);
    let canonical_toml = parsed_target
        .as_ref()
        .ok()
        .map(canonical_target_toml)
        .transpose()?;
    let parsed_target_ref = parsed_target.as_ref().ok();
    let parsed_target_error = parsed_target.as_ref().err().cloned();
    let target_paths = ffhn_core::TargetPaths::try_new(&workspace.path, directory_name.as_str());
    let mut artifact_issues = Vec::new();

    let status_report = match &target_paths {
        Ok(paths) => match ffhn_core::status(paths) {
            Ok(report) => match serde_json::to_value(report) {
                Ok(value) => Some(value),
                Err(error) => {
                    artifact_issues.push(format!("Failed to encode status report: {error}"));
                    None
                }
            },
            Err(error) => {
                artifact_issues.push(format!("Failed to load status report: {error}"));
                None
            }
        },
        Err(_) => None,
    };

    let last_run_snapshot = read_optional_json_value(
        &target_directory.join("last_run.json"),
        &mut artifact_issues,
    );
    let state_document =
        read_optional_json_value(&target_directory.join("state.json"), &mut artifact_issues);
    let typed_state_document =
        read_optional_state_document(&target_directory.join("state.json"), &mut artifact_issues);
    let artifact_history = typed_state_document.as_ref().and_then(|document| {
        match load_target_artifact_history(&target_directory, document) {
            Ok(history) => Some(history),
            Err(error) => {
                artifact_issues.push(error);
                None
            }
        }
    });

    Ok(TargetDocumentRecord {
        directory_name,
        target_directory_path: target_directory.display().to_string(),
        target_file_path: target_file.display().to_string(),
        raw_toml,
        canonical_toml,
        target_id: parsed_target_ref.map(|target| target.target_id().to_owned()),
        display_name: parsed_target_ref.map(|target| target.display_name().to_owned()),
        enabled: parsed_target_ref.map(TargetDocument::enabled),
        status_report,
        last_run_snapshot,
        state_document,
        artifact_history,
        artifact_issues,
        error_message: match target_paths {
            Ok(_) => parsed_target_error,
            Err(error) => Some(error.to_string()),
        },
    })
}

pub(crate) fn get_target_template_logic(kind: String) -> Result<TargetTemplate, String> {
    let template = match kind.as_str() {
        "http" => TargetTemplate {
            kind,
            raw_toml: http_target_template(),
        },
        "file" => TargetTemplate {
            kind,
            raw_toml: file_target_template(),
        },
        other => return Err(format!("Unknown target template kind: {other}")),
    };
    Ok(template)
}

pub(crate) fn preview_target_logic(raw_toml: String) -> Result<TargetPreview, String> {
    let target = read_target_document(&raw_toml)?;
    let canonical_toml = canonical_target_toml(&target)?;
    let temp = tempfile::tempdir().map_err(|error| format!("Failed to create tempdir: {error}"))?;
    let paths = materialize_target_document(temp.path(), &target, &canonical_toml)?;
    let status_report = ffhn_core::status(&paths).map_err(|error| error.to_string())?;
    let dry_run_report = ffhn_core::run_once_dry_run(&paths).map_err(|error| error.to_string())?;

    Ok(TargetPreview {
        target_id: target.target_id().to_owned(),
        display_name: target.display_name().to_owned(),
        canonical_toml,
        status_report: serde_json::to_value(status_report)
            .map_err(|error| format!("Failed to encode status report: {error}"))?,
        dry_run_report: serde_json::to_value(dry_run_report)
            .map_err(|error| format!("Failed to encode dry-run report: {error}"))?,
    })
}

pub(crate) fn save_target_logic(
    app: &AppHandle,
    state: &State<AppState>,
    request: TargetSaveRequest,
) -> Result<TargetMutationResult, String> {
    let workspace = current_workspace(app, state)?;
    let next_directory_name = persist_target_document(&workspace.path, &request)?;

    Ok(TargetMutationResult {
        workspace: workspace_snapshot(app, &workspace)?,
        directory_name: next_directory_name,
    })
}

pub(crate) fn delete_target_logic(
    app: &AppHandle,
    state: &State<AppState>,
    directory_name: String,
) -> Result<WorkspaceSnapshot, String> {
    let workspace = current_workspace(app, state)?;
    let target_directory = resolve_existing_target_directory(&workspace.path, &directory_name)?;
    if target_directory.exists() {
        fs::remove_dir_all(&target_directory)
            .map_err(|error| format!("Failed to remove {}: {error}", target_directory.display()))?;
    }
    workspace_snapshot(app, &workspace)
}

pub(crate) fn execute_target_run(
    workspace: &Path,
    directory_name: &str,
) -> Result<(serde_json::Value, serde_json::Value), String> {
    direct_child_directory_name(directory_name)?;
    let paths = ffhn_core::TargetPaths::try_new(workspace, directory_name)
        .map_err(|error| error.to_string())?;
    let run_report = ffhn_core::run_once(&paths).map_err(|error| error.to_string())?;
    let status_report = ffhn_core::status(&paths).map_err(|error| error.to_string())?;

    Ok((
        serde_json::to_value(status_report)
            .map_err(|error| format!("Failed to encode status report: {error}"))?,
        serde_json::to_value(run_report)
            .map_err(|error| format!("Failed to encode run report: {error}"))?,
    ))
}

pub(crate) fn persist_target_document(
    workspace: &Path,
    request: &TargetSaveRequest,
) -> Result<String, String> {
    let target = read_target_document(&request.raw_toml)?;
    let canonical_toml = canonical_target_toml(&target)?;
    let next_directory_name = target.target_id().to_owned();
    let next_target_directory = workspace.join(&next_directory_name);

    if request.previous_directory_name.is_none() && next_target_directory.exists() {
        return Err(format!(
            "Target directory {} already exists.",
            next_target_directory.display()
        ));
    }

    if let Some(previous_directory_name) = request.previous_directory_name.as_deref()
        && previous_directory_name != next_directory_name
        && next_target_directory.exists()
    {
        return Err(format!(
            "Target directory {} already exists.",
            next_target_directory.display()
        ));
    }

    fs::create_dir_all(&next_target_directory).map_err(|error| {
        format!(
            "Failed to create target directory {}: {error}",
            next_target_directory.display()
        )
    })?;
    reset_target_runtime_artifacts(&next_target_directory)?;
    fs::write(next_target_directory.join("target.toml"), canonical_toml).map_err(|error| {
        format!(
            "Failed to write {}: {error}",
            next_target_directory.join("target.toml").display()
        )
    })?;

    if let Some(previous_directory_name) = request.previous_directory_name.as_deref()
        && previous_directory_name != next_directory_name
    {
        let previous_directory =
            workspace.join(direct_child_directory_name(previous_directory_name)?);
        if previous_directory.exists() {
            fs::remove_dir_all(&previous_directory).map_err(|error| {
                format!("Failed to remove {}: {error}", previous_directory.display())
            })?;
        }
    }

    Ok(next_directory_name)
}

pub(crate) fn execute_workspace_run(
    workspace: &Path,
    max_concurrency: Option<usize>,
) -> Result<(serde_json::Value, Vec<SkippedDirectory>), String> {
    let targets = inventory_targets(workspace)?;
    let mut skipped_directories = Vec::new();
    let mut target_ids = Vec::new();

    for target in &targets {
        match &target.target_id {
            Some(target_id) => {
                target_ids
                    .push(TargetId::new(target_id.clone()).map_err(|error| error.to_string())?);
            }
            None => skipped_directories.push(SkippedDirectory {
                directory_name: target.directory_name.clone(),
                reason: target.error_message.clone().unwrap_or_else(|| {
                    "Directory name does not satisfy the ffhn-core target id contract.".to_owned()
                }),
            }),
        }
    }

    if target_ids.is_empty() {
        return Err("The workspace has no runnable targets.".to_owned());
    }

    let default_jobs = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(1)
        .min(target_ids.len())
        .max(1);
    let jobs = max_concurrency.unwrap_or(default_jobs);
    let batch_report = ffhn_core::run_batch(workspace, &target_ids, ffhn_core::RunMode::Live, jobs)
        .map_err(|error| error.to_string())?;

    Ok((
        serde_json::to_value(batch_report)
            .map_err(|error| format!("Failed to encode batch report: {error}"))?,
        skipped_directories,
    ))
}

fn http_target_template() -> String {
    r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "website_watch"
display_name = "Website watch"
enabled = true

[target]
kind = "http"
source_url = "https://example.com"

[fetch]
engine = "http"
method = "GET"
timeout_ms = 15000
max_bytes = 2000000
user_agent = "dataarm/template"
follow_redirects = true
accept = "text/html,application/xhtml+xml"

[selection]
kind = "css_selector"
selector = "main"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
"#
    .to_owned()
}

fn file_target_template() -> String {
    r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "file_watch"
display_name = "File watch"
enabled = true

[target]
kind = "file"
file_path = "/absolute/path/to/page.html"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = "main"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"

[[compare.canonicalization]]
kind = "collapse_whitespace"
"#
    .to_owned()
}

fn materialize_target_document(
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

fn reset_target_runtime_artifacts(target_directory: &Path) -> Result<(), String> {
    remove_path_if_exists(&target_directory.join("state.json"))?;
    remove_path_if_exists(&target_directory.join("last_run.json"))?;
    remove_path_if_exists(&target_directory.join("lock"))?;
    remove_path_if_exists(&target_directory.join("snapshots"))?;
    Ok(())
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

fn read_optional_json_value(path: &Path, issues: &mut Vec<String>) -> Option<serde_json::Value> {
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

fn read_optional_state_document(path: &Path, issues: &mut Vec<String>) -> Option<StateDocument> {
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

#[cfg(test)]
mod tests {
    use super::super::runtime_artifacts::load_target_artifact_history;
    use super::*;
    use std::collections::BTreeMap;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;
    use std::time::{Duration, Instant};
    use tempfile::tempdir;

    #[test]
    fn save_resets_persisted_runtime_artifacts() {
        let temp = tempdir().expect("tempdir");
        let target_dir = temp.path().join("demo");
        fs::create_dir_all(target_dir.join("snapshots/history")).expect("create snapshot dir");
        fs::create_dir_all(target_dir.join("lock")).expect("create lock dir");
        fs::write(target_dir.join("state.json"), "{}").expect("write state");
        fs::write(target_dir.join("last_run.json"), "{}").expect("write last run");
        fs::write(target_dir.join("lock/run.lock"), "").expect("write lock");
        fs::write(target_dir.join("snapshots/history/old.txt"), "").expect("write snapshot");

        reset_target_runtime_artifacts(&target_dir).expect("reset artifacts");

        assert!(!target_dir.join("state.json").exists());
        assert!(!target_dir.join("last_run.json").exists());
        assert!(!target_dir.join("lock").exists());
        assert!(!target_dir.join("snapshots").exists());
    }

    #[test]
    fn persist_target_document_creates_target_file() {
        let workspace = tempdir().expect("tempdir");
        let request = TargetSaveRequest {
            previous_directory_name: None,
            raw_toml: file_target_toml(
                "release_notes",
                "Demo release notes",
                &workspace.path().join("source.html"),
                ".release",
            ),
        };

        let directory_name =
            persist_target_document(workspace.path(), &request).expect("persist target");

        assert_eq!(directory_name, "release_notes");
        assert!(workspace.path().join("release_notes/target.toml").is_file());
    }

    #[test]
    fn persist_target_document_renames_target_directory() {
        let workspace = tempdir().expect("tempdir");
        let old_request = TargetSaveRequest {
            previous_directory_name: None,
            raw_toml: file_target_toml(
                "old_target",
                "Old target",
                &workspace.path().join("old.html"),
                ".old",
            ),
        };
        persist_target_document(workspace.path(), &old_request).expect("persist old target");

        let renamed_request = TargetSaveRequest {
            previous_directory_name: Some("old_target".to_owned()),
            raw_toml: file_target_toml(
                "new_target",
                "New target",
                &workspace.path().join("new.html"),
                ".new",
            ),
        };

        let directory_name =
            persist_target_document(workspace.path(), &renamed_request).expect("rename target");

        assert_eq!(directory_name, "new_target");
        assert!(!workspace.path().join("old_target").exists());
        assert!(workspace.path().join("new_target/target.toml").is_file());
    }

    #[test]
    fn persist_target_document_rejects_duplicate_destination_on_rename() {
        let workspace = tempdir().expect("tempdir");
        persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: None,
                raw_toml: file_target_toml(
                    "old_target",
                    "Old target",
                    &workspace.path().join("old.html"),
                    ".old",
                ),
            },
        )
        .expect("persist old target");
        persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: None,
                raw_toml: file_target_toml(
                    "taken_target",
                    "Taken target",
                    &workspace.path().join("taken.html"),
                    ".taken",
                ),
            },
        )
        .expect("persist taken target");

        let error = persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: Some("old_target".to_owned()),
                raw_toml: file_target_toml(
                    "taken_target",
                    "Taken target",
                    &workspace.path().join("taken.html"),
                    ".taken",
                ),
            },
        )
        .expect_err("rename should fail");

        assert!(error.contains("already exists"));
    }

    #[test]
    #[cfg_attr(
        miri,
        ignore = "Miri does not support the nonblocking socket path used by HTTP previews."
    )]
    fn preview_target_supports_http_targets_against_a_local_fixture_server() {
        let (url, handle) = start_http_fixture_server(
            r#"<!doctype html><html><body><main>Preview me</main></body></html>"#,
        );

        let preview = preview_target_logic(http_target_toml(
            "website_watch",
            "Website watch",
            &url,
            "main",
        ))
        .expect("preview target");

        handle.join().expect("join http fixture server");

        assert_eq!(preview.target_id, "website_watch");
        assert_eq!(preview.display_name, "Website watch");
        assert_eq!(
            preview.status_report["schema_name"],
            serde_json::Value::String("ffhn.status_report".to_owned())
        );
        assert_eq!(
            preview.dry_run_report["schema_name"],
            serde_json::Value::String("ffhn.run_report".to_owned())
        );
    }

    #[test]
    #[cfg_attr(
        miri,
        ignore = "Miri does not support the nonblocking socket path used by HTTP previews."
    )]
    fn preview_target_surfaces_a_structured_failure_when_a_fragment_is_missing() {
        let (base_url, handle) = start_http_corpus_server([(
            "/status",
            r#"<!doctype html><html><body><main><article class="status-card">OK</article></main></body></html>"#,
        )]);

        let preview = preview_target_logic(http_target_toml(
            "website_watch",
            "Website watch",
            &format!("{base_url}status"),
            ".missing-fragment",
        ))
        .expect("preview target");

        handle.join().expect("join http corpus server");

        assert_eq!(
            preview.status_report["schema_name"],
            serde_json::Value::String("ffhn.status_report".to_owned())
        );
        assert_eq!(
            preview.dry_run_report["schema_name"],
            serde_json::Value::String("ffhn.run_report".to_owned())
        );
        assert_ne!(
            preview.dry_run_report["result"]["kind"],
            serde_json::Value::String("initialized".to_owned())
        );
    }

    #[test]
    fn execute_target_run_persists_runtime_artifacts_for_file_targets() {
        let workspace = tempdir().expect("tempdir");
        let source = workspace.path().join("release.html");
        fs::write(
            &source,
            "<main><article class=\"release\">Release 7.0.0</article></main>",
        )
        .expect("write source html");
        persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: None,
                raw_toml: file_target_toml("release_notes", "Release notes", &source, ".release"),
            },
        )
        .expect("persist target");

        let (status_report, run_report) =
            execute_target_run(workspace.path(), "release_notes").expect("run target");

        assert_eq!(
            status_report["schema_name"],
            serde_json::Value::String("ffhn.status_report".to_owned())
        );
        assert_eq!(
            run_report["schema_name"],
            serde_json::Value::String("ffhn.run_report".to_owned())
        );
        assert!(workspace.path().join("release_notes/state.json").is_file());
        assert!(
            workspace
                .path()
                .join("release_notes/last_run.json")
                .is_file()
        );

        let state_file = workspace.path().join("release_notes/state.json");
        let state_document = read_optional_state_document(&state_file, &mut Vec::new())
            .expect("typed state document");
        let artifact_history =
            load_target_artifact_history(&workspace.path().join("release_notes"), &state_document)
                .expect("artifact history");

        let current_snapshot = artifact_history.current_snapshot.expect("current snapshot");
        assert_eq!(artifact_history.snapshot_history.len(), 0);
        assert!(current_snapshot.compare_text.contains("Release 7.0.0"));
        assert_eq!(
            current_snapshot.extraction_record["schema_name"],
            serde_json::Value::String("ffhn.extraction_record".to_owned())
        );
    }

    #[test]
    fn execute_workspace_run_processes_every_runnable_target() {
        let workspace = tempdir().expect("tempdir");
        for (directory_name, selector) in [("release_notes", ".release"), ("status_board", ".card")]
        {
            let source = workspace.path().join(format!("{directory_name}.html"));
            fs::write(
                &source,
                format!(
                    "<main><div class=\"{}\">{directory_name}</div></main>",
                    selector.trim_start_matches('.')
                ),
            )
            .expect("write source html");
            persist_target_document(
                workspace.path(),
                &TargetSaveRequest {
                    previous_directory_name: None,
                    raw_toml: file_target_toml(directory_name, directory_name, &source, selector),
                },
            )
            .expect("persist target");
        }

        let (batch_report, skipped_directories) =
            execute_workspace_run(workspace.path(), Some(1)).expect("run workspace");

        assert!(skipped_directories.is_empty());
        let entries = batch_report["entries"]
            .as_array()
            .expect("batch report entries");
        assert_eq!(entries.len(), 2);
        assert!(
            workspace
                .path()
                .join("release_notes/last_run.json")
                .is_file()
        );
        assert!(
            workspace
                .path()
                .join("status_board/last_run.json")
                .is_file()
        );
    }

    #[test]
    #[cfg_attr(
        miri,
        ignore = "Miri does not support the nonblocking socket path used by HTTP previews."
    )]
    fn execute_workspace_run_processes_a_live_http_target_corpus() {
        let (base_url, handle) = start_http_corpus_server([
            (
                "/status",
                r#"<!doctype html><html><body><main><article class="status-card"><h2>All systems operational</h2><p>Last checked 09:55 UTC</p></article></main></body></html>"#,
            ),
            (
                "/pricing",
                r#"<!doctype html><html><body><main><section class="pricing-card"><h2>Professional plan</h2><p class="amount">$49</p></section></main></body></html>"#,
            ),
            (
                "/releases",
                r#"<!doctype html><html><body><main><article class="release"><ol><li>Added compare timeline</li><li>Fixed batch retries</li></ol></article></main></body></html>"#,
            ),
        ]);

        let workspace = tempdir().expect("tempdir");
        for (directory_name, display_name, path, selector) in [
            ("status_http", "Status HTTP", "status", ".status-card"),
            ("pricing_http", "Pricing HTTP", "pricing", ".pricing-card"),
            ("release_http", "Release HTTP", "releases", ".release"),
        ] {
            persist_target_document(
                workspace.path(),
                &TargetSaveRequest {
                    previous_directory_name: None,
                    raw_toml: http_target_toml(
                        directory_name,
                        display_name,
                        &format!("{base_url}{path}"),
                        selector,
                    ),
                },
            )
            .expect("persist http target");
        }

        let (batch_report, skipped_directories) =
            execute_workspace_run(workspace.path(), Some(1)).expect("run workspace");

        handle.join().expect("join http corpus server");

        assert!(skipped_directories.is_empty());
        let entries = batch_report["entries"]
            .as_array()
            .expect("batch report entries");
        assert_eq!(entries.len(), 3);

        for directory_name in ["status_http", "pricing_http", "release_http"] {
            assert!(
                workspace
                    .path()
                    .join(directory_name)
                    .join("state.json")
                    .is_file()
            );
            assert!(
                workspace
                    .path()
                    .join(directory_name)
                    .join("last_run.json")
                    .is_file()
            );
        }

        let status_state_file = workspace.path().join("status_http/state.json");
        let status_state_document =
            read_optional_state_document(&status_state_file, &mut Vec::new())
                .expect("typed state document");
        let status_history = load_target_artifact_history(
            &workspace.path().join("status_http"),
            &status_state_document,
        )
        .expect("status artifact history");
        let status_snapshot = status_history
            .current_snapshot
            .expect("status current snapshot");
        assert!(
            status_snapshot
                .compare_text
                .contains("All systems operational")
        );
    }

    #[test]
    fn invalid_state_json_is_reported_as_a_target_artifact_issue() {
        let temp = tempdir().expect("tempdir");
        let state_file = temp.path().join("state.json");
        fs::write(&state_file, "{not valid json").expect("write invalid state");
        let mut issues = Vec::new();

        let typed_state = read_optional_state_document(&state_file, &mut issues);

        assert!(typed_state.is_none());
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("Failed to decode"));
    }

    fn file_target_toml(
        target_id: &str,
        display_name: &str,
        file_path: &Path,
        selector: &str,
    ) -> String {
        format!(
            r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "{target_id}"
display_name = "{display_name}"
enabled = true

[target]
kind = "file"
file_path = "{file_path}"

[fetch]
engine = "file"
max_bytes = 2000000

[selection]
kind = "css_selector"
selector = "{selector}"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"
"#,
            file_path = file_path.display()
        )
    }

    fn http_target_toml(
        target_id: &str,
        display_name: &str,
        source_url: &str,
        selector: &str,
    ) -> String {
        format!(
            r#"schema_name = "ffhn.target"
schema_version = 4
target_id = "{target_id}"
display_name = "{display_name}"
enabled = true

[target]
kind = "http"
source_url = "{source_url}"

[fetch]
engine = "http"
method = "GET"
timeout_ms = 15000
max_bytes = 2000000
user_agent = "dataarm/test"
follow_redirects = true
accept = "text/html,application/xhtml+xml"

[selection]
kind = "css_selector"
selector = "{selector}"
match = "single"

[compare]
basis = "text"
whitespace = "normalize"
rewrite_urls = false

[[compare.canonicalization]]
kind = "trim"
"#
        )
    }

    fn start_http_fixture_server(body: &str) -> (String, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local fixture server");
        let address = listener.local_addr().expect("fixture server address");
        let response_body = body.to_owned();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept fixture request");
            let mut request_buffer = [0_u8; 2048];
            let _ = stream.read(&mut request_buffer);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write fixture response");
        });
        (format!("http://{address}/"), handle)
    }

    fn start_http_corpus_server<const N: usize>(
        routes: [(&str, &str); N],
    ) -> (String, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind http corpus server");
        listener
            .set_nonblocking(true)
            .expect("set nonblocking listener");
        let address = listener.local_addr().expect("http corpus server address");
        let routes = BTreeMap::from_iter(
            routes
                .into_iter()
                .map(|(path, body)| (path.to_owned(), body.to_owned())),
        );
        let handle = thread::spawn(move || {
            let mut idle_since = Instant::now();
            loop {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        idle_since = Instant::now();
                        stream
                            .set_nonblocking(false)
                            .expect("restore blocking corpus stream");
                        let mut request_buffer = [0_u8; 4096];
                        let bytes_read = stream.read(&mut request_buffer).expect("read request");
                        let request = String::from_utf8_lossy(&request_buffer[..bytes_read]);
                        let path = request
                            .lines()
                            .next()
                            .and_then(|line| line.split_whitespace().nth(1))
                            .unwrap_or("/");
                        if let Some(body) = routes.get(path) {
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                body.len(),
                                body
                            );
                            stream
                                .write_all(response.as_bytes())
                                .expect("write corpus response");
                        } else {
                            stream
                                .write_all(
                                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                                )
                                .expect("write 404 response");
                        }
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        if idle_since.elapsed() >= Duration::from_millis(300) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("accept http corpus request: {error}"),
                }
            }
        });
        (format!("http://{address}/"), handle)
    }
}
