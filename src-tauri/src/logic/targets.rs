use super::runtime_artifacts::{
    load_current_snapshot_artifact_by_convention, load_target_artifact_history,
};
use super::workspace::{
    canonical_target_toml, current_workspace, direct_child_directory_name, inventory_targets,
    read_target_document, resolve_existing_target_directory, workspace_snapshot,
};
use crate::models::{
    AppState, SkippedDirectory, TargetDocumentRecord, TargetDraft, TargetDraftCanonicalizer,
    TargetDraftSession, TargetMutationResult, TargetPreview, TargetPreviewRequest,
    TargetSaveRequest, TargetTemplate, WorkspaceSnapshot,
};
use ffhn_core::{
    self, CompareBasis, DelimiterMode, HttpMethod, RegexFlag, SelectionKind, SelectionMatch,
    StateDocument, TargetDocument, TargetId, WhitespaceMode,
};
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

fn raw_toml_from_preview_request(request: &TargetPreviewRequest) -> Result<String, String> {
    raw_toml_from_optional_input(
        request.draft_session.as_ref(),
        request.raw_toml.as_deref(),
        "preview",
    )
}

fn raw_toml_from_save_request(request: &TargetSaveRequest) -> Result<String, String> {
    raw_toml_from_optional_input(
        request.draft_session.as_ref(),
        request.raw_toml.as_deref(),
        "save",
    )
}

fn raw_toml_from_optional_input(
    draft_session: Option<&TargetDraftSession>,
    raw_toml: Option<&str>,
    operation: &str,
) -> Result<String, String> {
    match (draft_session, raw_toml) {
        (Some(_), Some(_)) => Err(format!(
            "Target {operation} requests must choose guided draft input or raw TOML, not both."
        )),
        (Some(session), None) => build_raw_toml_from_session(session),
        (None, Some(raw_toml)) => Ok(raw_toml.to_owned()),
        (None, None) => Err(format!(
            "Target {operation} requests must provide guided draft input or raw TOML."
        )),
    }
}

fn target_draft_session(
    target: &TargetDocument,
    raw_toml: &str,
) -> Result<TargetDraftSession, String> {
    Ok(TargetDraftSession {
        draft: TargetDraft {
            kind: if target.source_url().is_some() {
                "http".to_owned()
            } else if target.file_path().is_some() {
                "file".to_owned()
            } else {
                return Err("Guided drafts require a file or HTTP source locator.".to_owned());
            },
            target_id: target.target_id().to_owned(),
            display_name: target.display_name().to_owned(),
            enabled: target.enabled(),
            source_locator: target
                .source_url()
                .map(|source| source.as_str().to_owned())
                .or_else(|| target.file_path().map(ToOwned::to_owned))
                .unwrap_or_default(),
            fetch_method: target.fetch_http_method().map(http_method_token),
            fetch_timeout_ms: target.fetch_timeout_ms(),
            fetch_max_bytes: target.fetch_max_bytes(),
            fetch_user_agent: target.fetch_user_agent().map(ToOwned::to_owned),
            fetch_follow_redirects: target.fetch_follow_redirects(),
            fetch_accept: target.fetch_accept().map(ToOwned::to_owned),
            selection_kind: selection_kind_token(target.selection_kind()).to_owned(),
            selection_match: selection_match_token(target.selection_match()).to_owned(),
            selection_index: target.selection_index(),
            selection_selector: target.selection_selector().map(ToOwned::to_owned),
            selection_start: target.selection_start().map(ToOwned::to_owned),
            selection_end: target.selection_end().map(ToOwned::to_owned),
            selection_delimiter_mode: target
                .selection_delimiter_mode()
                .map(delimiter_mode_token)
                .map(ToOwned::to_owned),
            selection_include_start: target.selection_include_start(),
            selection_include_end: target.selection_include_end(),
            selection_regex_flags: target
                .selection_regex_flags()
                .iter()
                .map(regex_flag_token)
                .map(ToOwned::to_owned)
                .collect(),
            compare_basis: compare_basis_token(target.compare_basis()).to_owned(),
            compare_whitespace: target
                .compare_whitespace()
                .map(whitespace_mode_token)
                .map(ToOwned::to_owned),
            compare_rewrite_urls: target.compare_rewrite_urls(),
            compare_canonicalizers: target
                .compare_canonicalization()
                .iter()
                .map(|canonicalizer| TargetDraftCanonicalizer {
                    kind: canonicalizer.kind().as_str().to_owned(),
                    pattern: canonicalizer.pattern().map(ToOwned::to_owned),
                    flags: canonicalizer
                        .flags()
                        .iter()
                        .map(regex_flag_token)
                        .map(ToOwned::to_owned)
                        .collect(),
                })
                .collect(),
            storage_history_limit: target.storage_history_limit(),
        },
        contract_seed: serde_json::to_value(parse_contract_seed(raw_toml)?)
            .map_err(|error| format!("Failed to encode guided target seed: {error}"))?,
    })
}

fn parse_contract_seed(raw_toml: &str) -> Result<toml::Table, String> {
    toml::from_str(raw_toml)
        .map_err(|error| format!("Failed to decode guided target seed: {error}"))
}

fn build_raw_toml_from_session(session: &TargetDraftSession) -> Result<String, String> {
    let mut contract_seed = serde_json::from_value::<toml::Table>(session.contract_seed.clone())
        .map_err(|error| format!("Failed to decode guided target seed: {error}"))?;
    apply_draft_to_contract_seed(&mut contract_seed, &session.draft)?;
    toml::to_string_pretty(&contract_seed)
        .map_err(|error| format!("Failed to serialize guided target draft: {error}"))
}

fn apply_draft_to_contract_seed(seed: &mut toml::Table, draft: &TargetDraft) -> Result<(), String> {
    seed.insert("schema_name".to_owned(), toml_string("ffhn.target"));
    seed.insert("schema_version".to_owned(), toml_integer(4));
    seed.insert(
        "target_id".to_owned(),
        toml_string(draft.target_id.as_str()),
    );
    seed.insert(
        "display_name".to_owned(),
        toml_string(draft.display_name.as_str()),
    );
    seed.insert("enabled".to_owned(), toml_boolean(draft.enabled));

    let mut target_table = match (
        read_nested_string(seed.get("target"), "kind"),
        draft.kind.as_str(),
    ) {
        (Some(existing_kind), next_kind) if existing_kind == next_kind => {
            cloned_table(seed.get("target"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(&mut target_table, &["kind", "source_url", "file_path"]);
    target_table.insert("kind".to_owned(), toml_string(draft.kind.as_str()));
    match draft.kind.as_str() {
        "http" => target_table.insert(
            "source_url".to_owned(),
            toml_string(draft.source_locator.as_str()),
        ),
        "file" => target_table.insert(
            "file_path".to_owned(),
            toml_string(draft.source_locator.as_str()),
        ),
        other => return Err(format!("Unsupported guided target kind: {other}")),
    };
    seed.insert("target".to_owned(), toml::Value::Table(target_table));

    let mut fetch_table = match (
        read_nested_string(seed.get("fetch"), "engine"),
        draft.kind.as_str(),
    ) {
        (Some(existing_engine), next_engine) if existing_engine == next_engine => {
            cloned_table(seed.get("fetch"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(
        &mut fetch_table,
        &[
            "engine",
            "method",
            "timeout_ms",
            "max_bytes",
            "user_agent",
            "follow_redirects",
            "accept",
        ],
    );
    fetch_table.insert("engine".to_owned(), toml_string(draft.kind.as_str()));
    fetch_table.insert(
        "max_bytes".to_owned(),
        toml_integer(draft.fetch_max_bytes as i64),
    );
    if draft.kind == "http" {
        fetch_table.insert(
            "method".to_owned(),
            toml_string(draft.fetch_method.as_deref().unwrap_or("GET")),
        );
        fetch_table.insert(
            "timeout_ms".to_owned(),
            toml_integer(draft.fetch_timeout_ms.unwrap_or(15_000) as i64),
        );
        fetch_table.insert(
            "user_agent".to_owned(),
            toml_string(
                draft
                    .fetch_user_agent
                    .as_deref()
                    .unwrap_or("dataarm/template"),
            ),
        );
        fetch_table.insert(
            "follow_redirects".to_owned(),
            toml_boolean(draft.fetch_follow_redirects.unwrap_or(true)),
        );
        fetch_table.insert(
            "accept".to_owned(),
            toml_string(
                draft
                    .fetch_accept
                    .as_deref()
                    .unwrap_or("text/html,application/xhtml+xml"),
            ),
        );
    }
    seed.insert("fetch".to_owned(), toml::Value::Table(fetch_table));

    let mut selection_table = match (
        read_nested_string(seed.get("selection"), "kind"),
        draft.selection_kind.as_str(),
    ) {
        (Some(existing_kind), next_kind) if existing_kind == next_kind => {
            cloned_table(seed.get("selection"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(
        &mut selection_table,
        &[
            "kind",
            "match",
            "index",
            "selector",
            "start",
            "end",
            "mode",
            "include_start",
            "include_end",
            "flags",
        ],
    );
    selection_table.insert(
        "kind".to_owned(),
        toml_string(draft.selection_kind.as_str()),
    );
    selection_table.insert(
        "match".to_owned(),
        toml_string(draft.selection_match.as_str()),
    );
    if draft.selection_match == "nth" {
        let selection_index = draft
            .selection_index
            .ok_or_else(|| "Guided nth-match targets must include selectionIndex.".to_owned())?;
        selection_table.insert("index".to_owned(), toml_integer(selection_index as i64));
    }
    match draft.selection_kind.as_str() {
        "css_selector" => {
            selection_table.insert(
                "selector".to_owned(),
                toml_string(draft.selection_selector.as_deref().unwrap_or("main")),
            );
        }
        "delimiter_pair" => {
            selection_table.insert(
                "start".to_owned(),
                toml_string(draft.selection_start.as_deref().unwrap_or("<main>")),
            );
            selection_table.insert(
                "end".to_owned(),
                toml_string(draft.selection_end.as_deref().unwrap_or("</main>")),
            );
            selection_table.insert(
                "mode".to_owned(),
                toml_string(
                    draft
                        .selection_delimiter_mode
                        .as_deref()
                        .unwrap_or("literal"),
                ),
            );
            selection_table.insert(
                "include_start".to_owned(),
                toml_boolean(draft.selection_include_start.unwrap_or(false)),
            );
            selection_table.insert(
                "include_end".to_owned(),
                toml_boolean(draft.selection_include_end.unwrap_or(false)),
            );
            if !draft.selection_regex_flags.is_empty() {
                selection_table.insert(
                    "flags".to_owned(),
                    toml::Value::Array(
                        draft
                            .selection_regex_flags
                            .iter()
                            .map(|flag| toml_string(flag.as_str()))
                            .collect(),
                    ),
                );
            }
        }
        other => return Err(format!("Unsupported guided selection kind: {other}")),
    }
    seed.insert("selection".to_owned(), toml::Value::Table(selection_table));

    let mut compare_table = cloned_table(seed.get("compare"));
    remove_keys(
        &mut compare_table,
        &["basis", "whitespace", "rewrite_urls", "canonicalization"],
    );
    compare_table.insert(
        "basis".to_owned(),
        toml_string(draft.compare_basis.as_str()),
    );
    compare_table.insert(
        "rewrite_urls".to_owned(),
        toml_boolean(draft.compare_rewrite_urls),
    );
    if draft.compare_basis == "text" {
        compare_table.insert(
            "whitespace".to_owned(),
            toml_string(draft.compare_whitespace.as_deref().unwrap_or("normalize")),
        );
    }
    compare_table.insert(
        "canonicalization".to_owned(),
        toml::Value::Array(
            draft
                .compare_canonicalizers
                .iter()
                .map(|canonicalizer| {
                    let mut table = toml::Table::new();
                    table.insert("kind".to_owned(), toml_string(canonicalizer.kind.as_str()));
                    if let Some(pattern) = &canonicalizer.pattern {
                        table.insert("pattern".to_owned(), toml_string(pattern.as_str()));
                    }
                    if !canonicalizer.flags.is_empty() {
                        table.insert(
                            "flags".to_owned(),
                            toml::Value::Array(
                                canonicalizer
                                    .flags
                                    .iter()
                                    .map(|flag| toml_string(flag.as_str()))
                                    .collect(),
                            ),
                        );
                    }
                    toml::Value::Table(table)
                })
                .collect(),
        ),
    );
    seed.insert("compare".to_owned(), toml::Value::Table(compare_table));

    let mut storage_table = cloned_table(seed.get("storage"));
    remove_keys(&mut storage_table, &["history_limit"]);
    storage_table.insert(
        "history_limit".to_owned(),
        toml_integer(draft.storage_history_limit as i64),
    );
    seed.insert("storage".to_owned(), toml::Value::Table(storage_table));

    Ok(())
}

fn cloned_table(value: Option<&toml::Value>) -> toml::Table {
    match value {
        Some(toml::Value::Table(table)) => table.clone(),
        _ => toml::Table::new(),
    }
}

fn read_nested_string<'a>(value: Option<&'a toml::Value>, key: &str) -> Option<&'a str> {
    match value {
        Some(toml::Value::Table(table)) => table.get(key).and_then(toml::Value::as_str),
        _ => None,
    }
}

fn remove_keys(table: &mut toml::Table, keys: &[&str]) {
    for key in keys {
        table.remove(*key);
    }
}

fn toml_string(value: &str) -> toml::Value {
    toml::Value::String(value.to_owned())
}

fn toml_integer(value: i64) -> toml::Value {
    toml::Value::Integer(value)
}

fn toml_boolean(value: bool) -> toml::Value {
    toml::Value::Boolean(value)
}

fn http_method_token(method: HttpMethod) -> String {
    match method {
        HttpMethod::GET => "GET".to_owned(),
        other => format!("{other:?}"),
    }
}

fn selection_kind_token(kind: SelectionKind) -> &'static str {
    match kind {
        SelectionKind::CssSelector => "css_selector",
        SelectionKind::DelimiterPair => "delimiter_pair",
        _ => "css_selector",
    }
}

fn selection_match_token(selection_match: SelectionMatch) -> &'static str {
    match selection_match {
        SelectionMatch::Single => "single",
        SelectionMatch::First => "first",
        SelectionMatch::Nth => "nth",
        _ => "single",
    }
}

fn delimiter_mode_token(mode: DelimiterMode) -> &'static str {
    match mode {
        DelimiterMode::Literal => "literal",
        DelimiterMode::Regex => "regex",
        _ => "literal",
    }
}

fn regex_flag_token(flag: &RegexFlag) -> &'static str {
    match flag {
        RegexFlag::CaseInsensitive => "case_insensitive",
        RegexFlag::MultiLine => "multi_line",
        RegexFlag::DotMatchesNewLine => "dot_matches_new_line",
        RegexFlag::SwapGreed => "swap_greed",
        RegexFlag::IgnoreWhitespace => "ignore_whitespace",
        _ => "case_insensitive",
    }
}

fn compare_basis_token(basis: CompareBasis) -> &'static str {
    match basis {
        CompareBasis::Text => "text",
        CompareBasis::InnerHtml => "inner_html",
        CompareBasis::OuterHtml => "outer_html",
        _ => "text",
    }
}

fn whitespace_mode_token(mode: WhitespaceMode) -> &'static str {
    match mode {
        WhitespaceMode::Preserve => "preserve",
        WhitespaceMode::Normalize => "normalize",
        _ => "normalize",
    }
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
            draft_session: None,
            raw_toml: Some(file_target_toml(
                "release_notes",
                "Demo release notes",
                &workspace.path().join("source.html"),
                ".release",
            )),
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
            draft_session: None,
            raw_toml: Some(file_target_toml(
                "old_target",
                "Old target",
                &workspace.path().join("old.html"),
                ".old",
            )),
        };
        persist_target_document(workspace.path(), &old_request).expect("persist old target");

        let renamed_request = TargetSaveRequest {
            previous_directory_name: Some("old_target".to_owned()),
            draft_session: None,
            raw_toml: Some(file_target_toml(
                "new_target",
                "New target",
                &workspace.path().join("new.html"),
                ".new",
            )),
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
                draft_session: None,
                raw_toml: Some(file_target_toml(
                    "old_target",
                    "Old target",
                    &workspace.path().join("old.html"),
                    ".old",
                )),
            },
        )
        .expect("persist old target");
        persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: None,
                draft_session: None,
                raw_toml: Some(file_target_toml(
                    "taken_target",
                    "Taken target",
                    &workspace.path().join("taken.html"),
                    ".taken",
                )),
            },
        )
        .expect("persist taken target");

        let error = persist_target_document(
            workspace.path(),
            &TargetSaveRequest {
                previous_directory_name: Some("old_target".to_owned()),
                draft_session: None,
                raw_toml: Some(file_target_toml(
                    "taken_target",
                    "Taken target",
                    &workspace.path().join("taken.html"),
                    ".taken",
                )),
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
        let (url, handle) = start_http_corpus_server([(
            "/",
            r#"<!doctype html><html><body><main>Preview me</main></body></html>"#,
        )]);

        let preview = preview_target_logic(TargetPreviewRequest {
            draft_session: None,
            raw_toml: Some(http_target_toml(
                "website_watch",
                "Website watch",
                &url,
                "main",
            )),
        })
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
        assert_eq!(
            preview
                .preview_snapshot
                .as_ref()
                .map(|snapshot| snapshot.compare_text.as_str()),
            Some("Preview me")
        );
    }

    #[test]
    fn preview_target_materializes_a_snapshot_for_guided_file_targets() {
        let workspace = tempdir().expect("tempdir");
        let source = workspace.path().join("guided-preview.html");
        fs::write(
            &source,
            "<main><article class=\"release\">Guided preview payload</article></main>",
        )
        .expect("write source html");

        let mut session = get_target_template_logic("file".to_owned())
            .expect("file template")
            .draft_session;
        session.draft.target_id = "guided_preview".to_owned();
        session.draft.display_name = "Guided preview".to_owned();
        session.draft.source_locator = source.display().to_string();
        session.draft.selection_selector = Some(".release".to_owned());

        let preview = preview_target_logic(TargetPreviewRequest {
            draft_session: Some(session),
            raw_toml: None,
        })
        .expect("preview target");

        assert_eq!(
            preview
                .preview_snapshot
                .as_ref()
                .map(|snapshot| snapshot.compare_text.as_str()),
            Some("Guided preview payload")
        );
        assert!(preview.preview_artifact_issues.is_empty());
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

        let preview = preview_target_logic(TargetPreviewRequest {
            draft_session: None,
            raw_toml: Some(http_target_toml(
                "website_watch",
                "Website watch",
                &format!("{base_url}status"),
                ".missing-fragment",
            )),
        })
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
                draft_session: None,
                raw_toml: Some(file_target_toml(
                    "release_notes",
                    "Release notes",
                    &source,
                    ".release",
                )),
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
                    draft_session: None,
                    raw_toml: Some(file_target_toml(
                        directory_name,
                        directory_name,
                        &source,
                        selector,
                    )),
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
    fn execute_workspace_run_skips_invalid_directory_ids_and_keeps_valid_targets() {
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
                draft_session: None,
                raw_toml: Some(file_target_toml(
                    "release_notes",
                    "Release notes",
                    &source,
                    ".release",
                )),
            },
        )
        .expect("persist target");

        let invalid_directory = workspace.path().join("Bad-Target");
        fs::create_dir_all(&invalid_directory).expect("create invalid directory");
        fs::write(
            invalid_directory.join("target.toml"),
            file_target_toml("bad_target", "Bad target", &source, ".release"),
        )
        .expect("write invalid directory target");

        let (batch_report, skipped_directories) =
            execute_workspace_run(workspace.path(), Some(1)).expect("run workspace");

        let entries = batch_report["entries"]
            .as_array()
            .expect("batch report entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(skipped_directories.len(), 1);
        assert_eq!(skipped_directories[0].directory_name, "Bad-Target");
        assert!(
            workspace
                .path()
                .join("release_notes/last_run.json")
                .is_file()
        );
        assert!(!invalid_directory.join("last_run.json").is_file());
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
                    draft_session: None,
                    raw_toml: Some(http_target_toml(
                        directory_name,
                        display_name,
                        &format!("{base_url}{path}"),
                        selector,
                    )),
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
