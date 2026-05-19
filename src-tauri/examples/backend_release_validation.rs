#![allow(dead_code, unused_imports)]

#[path = "../src/logic/mod.rs"]
mod logic;
#[path = "../src/models.rs"]
mod models;

use crate::logic::{
    execute_target_run, execute_workspace_run, get_target_template_logic, persist_target_document,
    preview_target_logic,
};
use crate::models::{
    TargetDraftCanonicalizer, TargetDraftSession, TargetPreviewRequest, TargetSaveRequest,
};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};
use tempfile::{TempDir, tempdir};

type ReleaseValidationResult<T> = Result<T, String>;

struct ScenarioOutcome {
    name: &'static str,
    detail: String,
}

enum FixtureResponse {
    Html(&'static str),
    Redirect(&'static str),
}

fn main() {
    match run() {
        Ok(outcomes) => {
            for outcome in &outcomes {
                println!("PASS {:<28} {}", outcome.name, outcome.detail);
            }
            println!(
                "PASS summary                     {} scenario(s) passed",
                outcomes.len()
            );
        }
        Err(error) => {
            eprintln!("FAIL release validation          {error}");
            std::process::exit(1);
        }
    }
}

fn run() -> ReleaseValidationResult<Vec<ScenarioOutcome>> {
    let include_live_web = std::env::args().any(|argument| argument == "--live");
    let root =
        tempdir().map_err(|error| format!("Failed to create release-validation root: {error}"))?;
    let mut outcomes = Vec::new();

    run_scenario(&mut outcomes, "guided_file_css", || {
        scenario_guided_file_css(root.path())
    })?;
    run_scenario(&mut outcomes, "guided_css_nth", || {
        scenario_guided_css_nth(root.path())
    })?;
    run_scenario(&mut outcomes, "guided_delimiter", || {
        scenario_guided_delimiter_regex(root.path())
    })?;
    run_scenario(&mut outcomes, "http_redirect", || {
        scenario_http_redirect(root.path())
    })?;
    run_scenario(&mut outcomes, "batch_mixed", || {
        scenario_batch_mixed(root.path())
    })?;
    run_scenario(&mut outcomes, "operator_errors", scenario_operator_errors)?;

    if include_live_web {
        run_scenario(&mut outcomes, "live_web", || scenario_live_web(root.path()))?;
    }

    Ok(outcomes)
}

fn run_scenario<F>(
    outcomes: &mut Vec<ScenarioOutcome>,
    name: &'static str,
    scenario: F,
) -> ReleaseValidationResult<()>
where
    F: FnOnce() -> ReleaseValidationResult<String>,
{
    let detail = scenario().map_err(|error| format!("{name}: {error}"))?;
    outcomes.push(ScenarioOutcome { name, detail });
    Ok(())
}

fn scenario_guided_file_css(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "guided-file-css")?;
    let sources = workspace.path().join("sources");
    fs::create_dir_all(&sources)
        .map_err(|error| format!("Failed to create {}: {error}", sources.display()))?;
    let source = sources.join("release-notes.html");
    fs::write(
        &source,
        r#"<!doctype html><html><body><main><article class="release">Release 10.4.0
Node 26.1.0
</article></main></body></html>"#,
    )
    .map_err(|error| format!("Failed to write {}: {error}", source.display()))?;

    let mut session = file_template_session()?;
    session.draft.target_id = "guided_release_notes".to_owned();
    session.draft.display_name = "Guided release notes".to_owned();
    session.draft.source_locator = source.display().to_string();
    session.draft.selection_selector = Some(".release".to_owned());

    let preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(session),
        raw_toml: None,
    })?;
    let preview_snapshot = preview
        .preview_snapshot
        .as_ref()
        .ok_or_else(|| "Guided file preview did not produce a snapshot.".to_owned())?;
    ensure_contains(
        "guided file preview compare payload",
        preview_snapshot.compare_text.as_str(),
        "Release 10.4.0",
    )?;

    persist_guided_target(workspace.path(), None, preview.draft_session.clone())?;
    execute_target_run(workspace.path(), "guided_release_notes")?;
    ensure_contains(
        "guided file compare artifact",
        read_current_compare_text(workspace.path(), "guided_release_notes")?.as_str(),
        "Node 26.1.0",
    )?;

    Ok("previewed, saved, and ran a guided file target".to_owned())
}

fn scenario_guided_css_nth(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "guided-css-nth")?;
    let sources = workspace.path().join("sources");
    fs::create_dir_all(&sources)
        .map_err(|error| format!("Failed to create {}: {error}", sources.display()))?;
    let source = sources.join("status-cards.html");
    fs::write(
        &source,
        r#"<!doctype html><html><body><main>
<article class="entry">Alpha</article>
<article class="entry">Beta</article>
<article class="entry">Gamma</article>
</main></body></html>"#,
    )
    .map_err(|error| format!("Failed to write {}: {error}", source.display()))?;

    let mut session = file_template_session()?;
    session.draft.target_id = "guided_nth_entry".to_owned();
    session.draft.display_name = "Guided nth entry".to_owned();
    session.draft.source_locator = source.display().to_string();
    session.draft.selection_selector = Some(".entry".to_owned());
    session.draft.selection_match = "nth".to_owned();
    session.draft.selection_index = Some(2);
    session.draft.compare_canonicalizers = vec![trim_canonicalizer()];

    let preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(session),
        raw_toml: None,
    })?;
    let preview_snapshot = preview
        .preview_snapshot
        .as_ref()
        .ok_or_else(|| "Guided nth preview did not produce a snapshot.".to_owned())?;
    ensure_contains(
        "guided nth compare payload",
        preview_snapshot.compare_text.as_str(),
        "Beta",
    )?;
    ensure_not_contains(
        "guided nth compare payload",
        preview_snapshot.compare_text.as_str(),
        "Alpha",
    )?;

    persist_guided_target(workspace.path(), None, preview.draft_session.clone())?;
    execute_target_run(workspace.path(), "guided_nth_entry")?;
    ensure_contains(
        "guided nth persisted compare artifact",
        read_current_compare_text(workspace.path(), "guided_nth_entry")?.as_str(),
        "Beta",
    )?;

    Ok("selected the second CSS match through the 1-based guided nth contract".to_owned())
}

fn scenario_guided_delimiter_regex(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "guided-delimiter")?;
    let sources = workspace.path().join("sources");
    fs::create_dir_all(&sources)
        .map_err(|error| format!("Failed to create {}: {error}", sources.display()))?;
    let source = sources.join("delimiter-source.html");
    fs::write(
        &source,
        r#"<!doctype html><html><body><main>
Ignore this line.
BEGIN PAYLOAD
Build 26.1.0
ESLint 10.4.0
END PAYLOAD
Ignore this line too.
</main></body></html>"#,
    )
    .map_err(|error| format!("Failed to write {}: {error}", source.display()))?;

    let mut session = file_template_session()?;
    session.draft.target_id = "guided_delimiter_payload".to_owned();
    session.draft.display_name = "Guided delimiter payload".to_owned();
    session.draft.source_locator = source.display().to_string();
    session.draft.selection_kind = "delimiter_pair".to_owned();
    session.draft.selection_match = "first".to_owned();
    session.draft.selection_index = None;
    session.draft.selection_selector = None;
    session.draft.selection_start = Some("BEGIN\\s+PAYLOAD".to_owned());
    session.draft.selection_end = Some("END\\s+PAYLOAD".to_owned());
    session.draft.selection_delimiter_mode = Some("regex".to_owned());
    session.draft.selection_include_start = Some(false);
    session.draft.selection_include_end = Some(false);
    session.draft.selection_regex_flags =
        vec!["multi_line".to_owned(), "dot_matches_new_line".to_owned()];
    session.draft.compare_canonicalizers = vec![trim_canonicalizer()];

    let preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(session),
        raw_toml: None,
    })?;
    let preview_snapshot = preview
        .preview_snapshot
        .as_ref()
        .ok_or_else(|| "Guided delimiter preview did not produce a snapshot.".to_owned())?;
    ensure_contains(
        "guided delimiter compare payload",
        preview_snapshot.compare_text.as_str(),
        "Build 26.1.0",
    )?;
    ensure_contains(
        "guided delimiter compare payload",
        preview_snapshot.compare_text.as_str(),
        "ESLint 10.4.0",
    )?;

    persist_guided_target(workspace.path(), None, preview.draft_session.clone())?;
    execute_target_run(workspace.path(), "guided_delimiter_payload")?;
    ensure_contains(
        "guided delimiter persisted compare artifact",
        read_current_compare_text(workspace.path(), "guided_delimiter_payload")?.as_str(),
        "ESLint 10.4.0",
    )?;

    Ok("extracted a regex-delimited payload through the guided contract".to_owned())
}

fn scenario_http_redirect(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "http-redirect")?;
    let (base_url, handle) = start_http_fixture_server(BTreeMap::from([
        (
            "/redirect".to_owned(),
            FixtureResponse::Redirect("/release"),
        ),
        (
            "/release".to_owned(),
            FixtureResponse::Html(
                r#"<!doctype html><html><body><main><article class="release">HTTP Release 0.1.0</article></main></body></html>"#,
            ),
        ),
    ]));

    let result = (|| -> ReleaseValidationResult<String> {
        let mut session = http_template_session()?;
        session.draft.target_id = "redirected_http_release".to_owned();
        session.draft.display_name = "Redirected HTTP release".to_owned();
        session.draft.source_locator = format!("{base_url}redirect");
        session.draft.selection_selector = Some(".release".to_owned());
        session.draft.compare_basis = "outer_html".to_owned();
        session.draft.compare_whitespace = None;
        session.draft.compare_canonicalizers = vec![trim_canonicalizer()];

        let preview = preview_target_logic(TargetPreviewRequest {
            draft_session: Some(session),
            raw_toml: None,
        })?;
        let preview_snapshot = preview
            .preview_snapshot
            .as_ref()
            .ok_or_else(|| "HTTP redirect preview did not produce a snapshot.".to_owned())?;
        ensure_contains(
            "redirect preview compare payload",
            preview_snapshot.compare_text.as_str(),
            "article class=\"release\"",
        )?;

        persist_guided_target(workspace.path(), None, preview.draft_session.clone())?;
        execute_target_run(workspace.path(), "redirected_http_release")?;
        ensure_contains(
            "redirect compare artifact",
            read_current_compare_text(workspace.path(), "redirected_http_release")?.as_str(),
            "HTTP Release 0.1.0",
        )?;

        Ok("followed a local redirect and compared outer HTML".to_owned())
    })();

    handle
        .join()
        .map_err(|_| "HTTP fixture server thread panicked.".to_owned())?;
    result
}

fn scenario_batch_mixed(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "batch-mixed")?;
    let sources = workspace.path().join("sources");
    fs::create_dir_all(&sources)
        .map_err(|error| format!("Failed to create {}: {error}", sources.display()))?;
    let file_source = sources.join("release-batch.html");
    fs::write(
        &file_source,
        r#"<!doctype html><html><body><main><article class="release">Batch file release</article></main></body></html>"#,
    )
    .map_err(|error| format!("Failed to write {}: {error}", file_source.display()))?;
    let delimiter_source = sources.join("delimiter-batch.html");
    fs::write(
        &delimiter_source,
        r#"<!doctype html><html><body><main>BEGIN PAYLOAD
Batch delimiter payload
END PAYLOAD</main></body></html>"#,
    )
    .map_err(|error| format!("Failed to write {}: {error}", delimiter_source.display()))?;

    let (base_url, handle) = start_http_fixture_server(BTreeMap::from([(
        "/status".to_owned(),
        FixtureResponse::Html(
            r#"<!doctype html><html><body><main><article class="status-card">Batch HTTP status</article></main></body></html>"#,
        ),
    )]));

    let result = (|| -> ReleaseValidationResult<String> {
        let mut file_session = file_template_session()?;
        file_session.draft.target_id = "batch_file".to_owned();
        file_session.draft.display_name = "Batch file".to_owned();
        file_session.draft.source_locator = file_source.display().to_string();
        file_session.draft.selection_selector = Some(".release".to_owned());
        let file_preview = preview_target_logic(TargetPreviewRequest {
            draft_session: Some(file_session),
            raw_toml: None,
        })?;
        persist_guided_target(workspace.path(), None, file_preview.draft_session)?;

        let mut delimiter_session = file_template_session()?;
        delimiter_session.draft.target_id = "batch_delimiter".to_owned();
        delimiter_session.draft.display_name = "Batch delimiter".to_owned();
        delimiter_session.draft.source_locator = delimiter_source.display().to_string();
        delimiter_session.draft.selection_kind = "delimiter_pair".to_owned();
        delimiter_session.draft.selection_selector = None;
        delimiter_session.draft.selection_start = Some("BEGIN PAYLOAD".to_owned());
        delimiter_session.draft.selection_end = Some("END PAYLOAD".to_owned());
        delimiter_session.draft.selection_delimiter_mode = Some("literal".to_owned());
        delimiter_session.draft.selection_include_start = Some(false);
        delimiter_session.draft.selection_include_end = Some(false);
        delimiter_session.draft.compare_canonicalizers = vec![trim_canonicalizer()];
        let delimiter_preview = preview_target_logic(TargetPreviewRequest {
            draft_session: Some(delimiter_session),
            raw_toml: None,
        })?;
        persist_guided_target(workspace.path(), None, delimiter_preview.draft_session)?;

        let mut http_session = http_template_session()?;
        http_session.draft.target_id = "batch_http".to_owned();
        http_session.draft.display_name = "Batch HTTP".to_owned();
        http_session.draft.source_locator = format!("{base_url}status");
        http_session.draft.selection_selector = Some(".status-card".to_owned());
        let http_preview = preview_target_logic(TargetPreviewRequest {
            draft_session: Some(http_session),
            raw_toml: None,
        })?;
        persist_guided_target(workspace.path(), None, http_preview.draft_session)?;

        let broken_directory = workspace.path().join("broken_target");
        fs::create_dir_all(&broken_directory)
            .map_err(|error| format!("Failed to create {}: {error}", broken_directory.display()))?;
        fs::write(broken_directory.join("target.toml"), "not = [valid").map_err(|error| {
            format!(
                "Failed to write {}: {error}",
                broken_directory.join("target.toml").display()
            )
        })?;

        let invalid_directory = workspace.path().join("Bad-Target");
        fs::create_dir_all(&invalid_directory).map_err(|error| {
            format!("Failed to create {}: {error}", invalid_directory.display())
        })?;
        fs::write(
            invalid_directory.join("target.toml"),
            file_target_document(
                "invalid_directory_target",
                "Invalid directory target",
                &file_source,
                ".release",
            ),
        )
        .map_err(|error| {
            format!(
                "Failed to write {}: {error}",
                invalid_directory.join("target.toml").display()
            )
        })?;

        let (batch_report, skipped_directories) = execute_workspace_run(workspace.path(), Some(2))?;
        let entries = batch_report["entries"]
            .as_array()
            .ok_or_else(|| "Batch report entries were not an array.".to_owned())?;
        if entries.len() != 4 {
            return Err(format!(
                "Expected 4 runnable batch entries, got {}.",
                entries.len()
            ));
        }
        if skipped_directories.len() != 1 || skipped_directories[0].directory_name != "Bad-Target" {
            return Err(format!(
                "Expected one skipped invalid-directory target, got {:?}.",
                skipped_directories
                    .iter()
                    .map(|directory| directory.directory_name.as_str())
                    .collect::<Vec<_>>()
            ));
        }

        ensure_contains(
            "batch http compare artifact",
            read_current_compare_text(workspace.path(), "batch_http")?.as_str(),
            "Batch HTTP status",
        )?;
        ensure_contains(
            "broken target batch entry",
            &serde_json::to_string(entries)
                .map_err(|error| format!("Failed to encode batch entries: {error}"))?,
            "broken_target",
        )?;

        Ok(
            "ran a mixed workspace, kept the broken config as a failed batch entry, and skipped the invalid directory name"
                .to_owned(),
        )
    })();

    handle
        .join()
        .map_err(|_| "HTTP batch fixture server thread panicked.".to_owned())?;
    result
}

fn scenario_operator_errors() -> ReleaseValidationResult<String> {
    let session = file_template_session()?;
    let duplicate_input_error = match preview_target_logic(TargetPreviewRequest {
        draft_session: Some(session),
        raw_toml: Some("schema_name = \"ffhn.target\"".to_owned()),
    }) {
        Ok(_) => {
            return Err("Mixed guided and raw preview inputs unexpectedly succeeded.".to_owned());
        }
        Err(error) => error,
    };
    ensure_contains(
        "duplicate guided/raw preview error",
        duplicate_input_error.as_str(),
        "not both",
    )?;

    let mut nth_without_index = file_template_session()?;
    nth_without_index.draft.selection_match = "nth".to_owned();
    nth_without_index.draft.selection_index = None;
    let nth_error = match preview_target_logic(TargetPreviewRequest {
        draft_session: Some(nth_without_index),
        raw_toml: None,
    }) {
        Ok(_) => {
            return Err("Nth preview without selection index unexpectedly succeeded.".to_owned());
        }
        Err(error) => error,
    };
    ensure_contains(
        "nth without index error",
        nth_error.as_str(),
        "selectionIndex",
    )?;

    let mut nth_with_zero_index = file_template_session()?;
    nth_with_zero_index.draft.selection_match = "nth".to_owned();
    nth_with_zero_index.draft.selection_index = Some(0);
    let zero_index_error = match preview_target_logic(TargetPreviewRequest {
        draft_session: Some(nth_with_zero_index),
        raw_toml: None,
    }) {
        Ok(_) => return Err("Nth preview with zero index unexpectedly succeeded.".to_owned()),
        Err(error) => error,
    };
    ensure_contains("nth zero index error", zero_index_error.as_str(), "index")?;

    let traversal_error = execute_target_run(Path::new("/tmp"), "../escape_target")
        .expect_err("path traversal should fail");
    ensure_contains(
        "path traversal run error",
        traversal_error.as_str(),
        "direct child",
    )?;

    Ok("rejected mixed inputs, invalid 1-based nth indices, and traversal attempts".to_owned())
}

fn scenario_live_web(root: &Path) -> ReleaseValidationResult<String> {
    let workspace = fresh_workspace(root, "live-web")?;

    let mut example_session = http_template_session()?;
    example_session.draft.target_id = "example_domain_live".to_owned();
    example_session.draft.display_name = "Example Domain live".to_owned();
    example_session.draft.source_locator = "https://example.com/".to_owned();
    example_session.draft.selection_selector = Some("h1".to_owned());
    example_session.draft.fetch_timeout_ms = Some(30_000);
    example_session.draft.compare_canonicalizers = vec![trim_canonicalizer()];

    let example_preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(example_session),
        raw_toml: None,
    })?;
    let example_snapshot = example_preview
        .preview_snapshot
        .as_ref()
        .ok_or_else(|| "Example Domain preview did not produce a snapshot.".to_owned())?;
    ensure_contains(
        "Example Domain preview payload",
        example_snapshot.compare_text.as_str(),
        "Example Domain",
    )?;
    persist_guided_target(workspace.path(), None, example_preview.draft_session)?;

    let mut rust_session = http_template_session()?;
    rust_session.draft.target_id = "rust_home_live".to_owned();
    rust_session.draft.display_name = "Rust home live".to_owned();
    rust_session.draft.source_locator = "https://www.rust-lang.org/".to_owned();
    rust_session.draft.selection_selector = Some("h1".to_owned());
    rust_session.draft.fetch_timeout_ms = Some(30_000);
    rust_session.draft.compare_canonicalizers = vec![trim_canonicalizer()];

    let rust_preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(rust_session),
        raw_toml: None,
    })?;
    let rust_snapshot = rust_preview
        .preview_snapshot
        .as_ref()
        .ok_or_else(|| "Rust homepage preview did not produce a snapshot.".to_owned())?;
    ensure_contains(
        "Rust homepage preview payload",
        rust_snapshot.compare_text.as_str(),
        "Rust",
    )?;
    persist_guided_target(workspace.path(), None, rust_preview.draft_session)?;

    let mut wrong_selector_session = http_template_session()?;
    wrong_selector_session.draft.target_id = "iana_wrong_selector".to_owned();
    wrong_selector_session.draft.display_name = "IANA wrong selector".to_owned();
    wrong_selector_session.draft.source_locator =
        "https://www.iana.org/domains/reserved".to_owned();
    wrong_selector_session.draft.selection_selector =
        Some(".definitely-missing-fragment".to_owned());
    wrong_selector_session.draft.fetch_timeout_ms = Some(30_000);

    let wrong_selector_preview = preview_target_logic(TargetPreviewRequest {
        draft_session: Some(wrong_selector_session),
        raw_toml: None,
    })?;
    if wrong_selector_preview.dry_run_report["result"]["kind"]
        == serde_json::Value::String("initialized".to_owned())
    {
        return Err("Wrong-selector live preview unexpectedly initialized cleanly.".to_owned());
    }

    let (batch_report, skipped_directories) = execute_workspace_run(workspace.path(), Some(2))?;
    if !skipped_directories.is_empty() {
        return Err(format!(
            "Expected no skipped live targets, got {:?}.",
            skipped_directories
                .iter()
                .map(|directory| directory.directory_name.as_str())
                .collect::<Vec<_>>()
        ));
    }
    let entries = batch_report["entries"]
        .as_array()
        .ok_or_else(|| "Live batch entries were not an array.".to_owned())?;
    if entries.len() != 2 {
        return Err(format!(
            "Expected 2 live batch entries, got {}.",
            entries.len()
        ));
    }

    ensure_contains(
        "Example Domain live compare artifact",
        read_current_compare_text(workspace.path(), "example_domain_live")?.as_str(),
        "Example Domain",
    )?;
    ensure_contains(
        "Rust live compare artifact",
        read_current_compare_text(workspace.path(), "rust_home_live")?.as_str(),
        "Rust",
    )?;

    Ok(
        "previewed and ran two live web targets, and surfaced a wrong-selector failure cleanly"
            .to_owned(),
    )
}

fn fresh_workspace(root: &Path, name: &str) -> ReleaseValidationResult<TempDir> {
    let workspace_root = root.join(name);
    fs::create_dir_all(&workspace_root).map_err(|error| {
        format!(
            "Failed to create release-validation workspace root {}: {error}",
            workspace_root.display()
        )
    })?;
    tempfile::tempdir_in(&workspace_root).map_err(|error| {
        format!(
            "Failed to create temp workspace in {}: {error}",
            workspace_root.display()
        )
    })
}

fn file_template_session() -> ReleaseValidationResult<TargetDraftSession> {
    get_target_template_logic("file".to_owned()).map(|template| template.draft_session)
}

fn http_template_session() -> ReleaseValidationResult<TargetDraftSession> {
    get_target_template_logic("http".to_owned()).map(|template| template.draft_session)
}

fn trim_canonicalizer() -> TargetDraftCanonicalizer {
    TargetDraftCanonicalizer {
        kind: "trim".to_owned(),
        pattern: None,
        flags: Vec::new(),
    }
}

fn file_target_document(
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

fn persist_guided_target(
    workspace: &Path,
    previous_directory_name: Option<&str>,
    draft_session: TargetDraftSession,
) -> ReleaseValidationResult<String> {
    persist_target_document(
        workspace,
        &TargetSaveRequest {
            previous_directory_name: previous_directory_name.map(ToOwned::to_owned),
            draft_session: Some(draft_session),
            raw_toml: None,
        },
    )
}

fn read_current_compare_text(
    workspace: &Path,
    directory_name: &str,
) -> ReleaseValidationResult<String> {
    let path = workspace
        .join(directory_name)
        .join("snapshots/current/compare.txt");
    fs::read_to_string(&path).map_err(|error| format!("Failed to read {}: {error}", path.display()))
}

fn ensure_contains(label: &str, actual: &str, expected: &str) -> ReleaseValidationResult<()> {
    if actual.contains(expected) {
        Ok(())
    } else {
        Err(format!(
            "{label} did not contain {expected:?}. Actual payload: {actual:?}"
        ))
    }
}

fn ensure_not_contains(label: &str, actual: &str, forbidden: &str) -> ReleaseValidationResult<()> {
    if actual.contains(forbidden) {
        Err(format!(
            "{label} unexpectedly contained {forbidden:?}. Actual payload: {actual:?}"
        ))
    } else {
        Ok(())
    }
}

fn start_http_fixture_server(
    routes: BTreeMap<String, FixtureResponse>,
) -> (String, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind fixture server");
    listener
        .set_nonblocking(true)
        .expect("set nonblocking fixture listener");
    let address = listener.local_addr().expect("fixture server address");
    let handle = thread::spawn(move || {
        let mut idle_since = Instant::now();
        loop {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    idle_since = Instant::now();
                    stream
                        .set_nonblocking(false)
                        .expect("restore blocking fixture stream");
                    let mut request_buffer = [0_u8; 4096];
                    let bytes_read = stream.read(&mut request_buffer).expect("read request");
                    let request = String::from_utf8_lossy(&request_buffer[..bytes_read]);
                    let path = request
                        .lines()
                        .next()
                        .and_then(|line| line.split_whitespace().nth(1))
                        .unwrap_or("/");

                    match routes.get(path) {
                        Some(FixtureResponse::Html(body)) => {
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                body.len(),
                                body
                            );
                            stream
                                .write_all(response.as_bytes())
                                .expect("write fixture response");
                        }
                        Some(FixtureResponse::Redirect(location)) => {
                            let response = format!(
                                "HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                            );
                            stream
                                .write_all(response.as_bytes())
                                .expect("write fixture redirect");
                        }
                        None => {
                            stream
                                .write_all(
                                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                                )
                                .expect("write fixture 404");
                        }
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if idle_since.elapsed() >= Duration::from_millis(500) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("accept fixture request: {error}"),
            }
        }
    });
    (format!("http://{address}/"), handle)
}
