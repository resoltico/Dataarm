mod drafts;
mod storage;

use super::runtime_artifacts::{
    load_current_snapshot_artifact_by_convention, load_target_artifact_history,
};
use super::watch_profile::{default_watch_profile, load_watch_profile, persist_watch_profile};
use super::workbench_fixtures::{file_target_template, http_target_template};
use super::workspace::{
    canonical_target_toml, current_workspace, direct_child_directory_name, inventory_targets,
    read_target_document, resolve_existing_target_directory, workspace_snapshot,
};
use crate::models::{
    AppState, SkippedDirectory, SourceInspectionRequest, SourceInspectionResult,
    TargetDocumentRecord, TargetMutationResult, TargetPreview, TargetPreviewRequest,
    TargetSaveRequest, TargetTemplate, WorkspaceSnapshot,
};
use drafts::{raw_toml_from_preview_request, raw_toml_from_save_request, target_draft_session};
use ffhn_core::{self, TargetDocument, TargetId};
use std::fs;
use std::path::Path;
use std::time::Duration;
use storage::{
    materialize_target_document, read_optional_json_value, read_optional_state_document,
    reset_target_runtime_artifacts,
};
use tauri::{AppHandle, State};

pub(crate) fn read_target_logic(
    app: &AppHandle,
    state: &State<AppState>,
    directory_name: String,
) -> Result<TargetDocumentRecord, String> {
    let workspace = current_workspace(app, state)?;
    read_target_from_workspace(&workspace.path, directory_name.as_str())
}

pub(crate) fn read_target_from_workspace(
    workspace: &Path,
    directory_name: &str,
) -> Result<TargetDocumentRecord, String> {
    let target_directory = resolve_existing_target_directory(workspace, directory_name)?;
    let target_file = target_directory.join("target.toml");
    let watch_profile = load_watch_profile(&target_directory)?;
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
    let target_paths = ffhn_core::TargetPaths::try_new(workspace, directory_name);
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
        directory_name: directory_name.to_owned(),
        target_directory_path: target_directory.display().to_string(),
        target_file_path: target_file.display().to_string(),
        raw_toml: raw_toml.clone(),
        canonical_toml,
        guided_session: parsed_target_ref
            .map(|target| target_draft_session(target, &raw_toml))
            .transpose()?,
        target_id: parsed_target_ref.map(|target| target.target_id().to_owned()),
        display_name: parsed_target_ref.map(|target| target.display_name().to_owned()),
        enabled: parsed_target_ref.map(TargetDocument::enabled),
        status_report,
        last_run_snapshot,
        state_document,
        artifact_history,
        artifact_issues,
        watch_profile,
        error_message: match target_paths {
            Ok(_) => parsed_target_error,
            Err(error) => Some(error.to_string()),
        },
    })
}

pub(crate) fn get_target_template_logic(kind: String) -> Result<TargetTemplate, String> {
    let raw_toml = match kind.as_str() {
        "http" => http_target_template(),
        "file" => file_target_template(),
        other => return Err(format!("Unknown target template kind: {other}")),
    };
    let target = read_target_document(&raw_toml)?;
    let template = TargetTemplate {
        kind,
        draft_session: target_draft_session(&target, &raw_toml)?,
        canonical_toml: canonical_target_toml(&target)?,
    };
    Ok(template)
}

pub(crate) fn preview_target_logic(request: TargetPreviewRequest) -> Result<TargetPreview, String> {
    let raw_toml = raw_toml_from_preview_request(&request)?;
    let target = read_target_document(&raw_toml)?;
    let canonical_toml = canonical_target_toml(&target)?;
    let temp = tempfile::tempdir().map_err(|error| format!("Failed to create tempdir: {error}"))?;
    let paths = materialize_target_document(temp.path(), &target, &canonical_toml)?;
    let status_report = ffhn_core::status(&paths).map_err(|error| error.to_string())?;
    let dry_run_report = ffhn_core::run_once_dry_run(&paths).map_err(|error| error.to_string())?;
    let mut preview_artifact_issues = Vec::new();
    let preview_snapshot = match load_preview_snapshot_artifact(&paths) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            preview_artifact_issues.push(error);
            None
        }
    };

    Ok(TargetPreview {
        target_id: target.target_id().to_owned(),
        display_name: target.display_name().to_owned(),
        canonical_toml,
        draft_session: target_draft_session(&target, &raw_toml)?,
        status_report: serde_json::to_value(status_report)
            .map_err(|error| format!("Failed to encode status report: {error}"))?,
        dry_run_report: serde_json::to_value(dry_run_report)
            .map_err(|error| format!("Failed to encode dry-run report: {error}"))?,
        preview_snapshot,
        preview_artifact_issues,
    })
}

fn load_preview_snapshot_artifact(
    paths: &ffhn_core::TargetPaths,
) -> Result<Option<crate::models::SnapshotArtifactRecord>, String> {
    let preview_snapshot = load_current_snapshot_artifact_by_convention(&paths.target_dir())?;
    if preview_snapshot.is_some() {
        return Ok(preview_snapshot);
    }

    // FFHN dry-run is contractually non-persisting, so Dataarm materializes one disposable live
    // run inside the temp preview workspace when the inspection workbench needs concrete artifacts.
    let _ = ffhn_core::run_once(paths)
        .map_err(|error| format!("Failed to materialize preview snapshot artifacts: {error}"))?;
    load_current_snapshot_artifact_by_convention(&paths.target_dir())
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
    let raw_toml = raw_toml_from_save_request(request)?;
    let target = read_target_document(&raw_toml)?;
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
    persist_watch_profile(
        &next_target_directory,
        request
            .watch_profile
            .as_ref()
            .unwrap_or(&default_watch_profile()),
    )?;

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

pub(crate) fn inspect_source_logic(
    request: SourceInspectionRequest,
) -> Result<SourceInspectionResult, String> {
    let locator = request.source_locator.trim();
    if locator.is_empty() {
        return Err("Source inspection requires a page URL or file path.".to_owned());
    }

    match request.kind.as_str() {
        "file" => {
            let html = fs::read_to_string(locator)
                .map_err(|error| format!("Failed to read source file {locator}: {error}"))?;
            Ok(SourceInspectionResult {
                final_url: None,
                content_type: Some("text/html".to_owned()),
                html,
            })
        }
        "http" => inspect_http_source(&request, locator),
        other => Err(format!("Unsupported source inspection kind: {other}")),
    }
}

pub(crate) fn execute_workspace_run(
    workspace: &Path,
    max_concurrency: Option<usize>,
) -> Result<(serde_json::Value, Vec<SkippedDirectory>), String> {
    let targets = inventory_targets(workspace)?;
    let mut skipped_directories = Vec::new();
    let mut target_ids = Vec::new();

    for target in &targets {
        match &target.runnable_target_id {
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

#[cfg(test)]
mod tests;

fn inspect_http_source(
    request: &SourceInspectionRequest,
    locator: &str,
) -> Result<SourceInspectionResult, String> {
    let method = request.fetch_method.as_deref().unwrap_or("GET");
    if method != "GET" {
        return Err(format!(
            "Source inspection currently supports GET requests only, not {method}."
        ));
    }

    let redirect = if request.fetch_follow_redirects.unwrap_or(true) {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };

    let client = reqwest::blocking::Client::builder()
        .redirect(redirect)
        .timeout(Duration::from_millis(
            request.fetch_timeout_ms.unwrap_or(15_000),
        ))
        .user_agent(
            request
                .fetch_user_agent
                .as_deref()
                .unwrap_or("Dataarm/source-inspector"),
        )
        .build()
        .map_err(|error| format!("Failed to build the source-inspection client: {error}"))?;

    let mut request_builder = client.get(locator);
    if let Some(accept) = request
        .fetch_accept
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        request_builder = request_builder.header(reqwest::header::ACCEPT, accept);
    }

    let response = request_builder
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("Failed to fetch {locator}: {error}"))?;
    let final_url = Some(response.url().as_str().to_owned());
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let html = response
        .text()
        .map_err(|error| format!("Failed to read {locator}: {error}"))?;

    Ok(SourceInspectionResult {
        final_url,
        content_type,
        html,
    })
}
