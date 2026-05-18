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
    let state_document =
        read_optional_state_document(&state_file, &mut Vec::new()).expect("typed state document");
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
fn execute_target_run_persists_runtime_artifacts_for_delimited_file_targets() {
    let workspace = tempdir().expect("tempdir");
    let source = workspace.path().join("release-delimited.html");
    fs::write(
        &source,
        "<main>IGNORE\nBEGIN PAYLOAD\nRelease 7.0.0\nESLint 10.4.0\nEND PAYLOAD\nIGNORE</main>",
    )
    .expect("write source html");
    persist_target_document(
        workspace.path(),
        &TargetSaveRequest {
            previous_directory_name: None,
            draft_session: None,
            raw_toml: Some(file_delimited_target_toml(
                "release_payload",
                "Release payload",
                &source,
                "BEGIN PAYLOAD",
                "END PAYLOAD",
            )),
        },
    )
    .expect("persist target");

    let (status_report, run_report) =
        execute_target_run(workspace.path(), "release_payload").expect("run target");

    assert_eq!(
        status_report["schema_name"],
        serde_json::Value::String("ffhn.status_report".to_owned())
    );
    assert_eq!(
        run_report["schema_name"],
        serde_json::Value::String("ffhn.run_report".to_owned())
    );

    let state_file = workspace.path().join("release_payload/state.json");
    let state_document =
        read_optional_state_document(&state_file, &mut Vec::new()).expect("typed state document");
    let artifact_history =
        load_target_artifact_history(&workspace.path().join("release_payload"), &state_document)
            .expect("artifact history");

    let current_snapshot = artifact_history.current_snapshot.expect("current snapshot");
    assert!(current_snapshot.compare_text.contains("Release 7.0.0"));
    assert!(current_snapshot.compare_text.contains("ESLint 10.4.0"));
    assert_eq!(
        current_snapshot.extraction_record["selection_kind"],
        serde_json::Value::String("delimiter_pair".to_owned())
    );
}

#[test]
fn persist_and_read_target_round_trip_preserves_guided_seed_for_delimited_targets() {
    let workspace = tempdir().expect("tempdir");
    let source = workspace.path().join("release-delimited.html");
    fs::write(
        &source,
        "<main>IGNORE\nBEGIN PAYLOAD\nRelease 7.0.0\nEND PAYLOAD\nIGNORE</main>",
    )
    .expect("write source html");
    let raw_toml = file_delimited_target_toml(
        "release_payload",
        "Release payload",
        &source,
        "BEGIN PAYLOAD",
        "END PAYLOAD",
    );

    persist_target_document(
        workspace.path(),
        &TargetSaveRequest {
            previous_directory_name: None,
            draft_session: None,
            raw_toml: Some(raw_toml.clone()),
        },
    )
    .expect("persist target");

    let record = read_target_from_workspace(workspace.path(), "release_payload")
        .expect("read target from workspace");

    assert_eq!(record.target_id.as_deref(), Some("release_payload"));
    assert_eq!(record.display_name.as_deref(), Some("Release payload"));
    assert_eq!(
        record.canonical_toml.as_deref(),
        Some(record.raw_toml.as_str())
    );
    assert!(record.raw_toml.contains("[storage]\nhistory_limit = 10\n"));
    assert_eq!(
        record
            .guided_session
            .as_ref()
            .map(|session| session.contract_seed_toml.as_str()),
        Some(record.raw_toml.as_str())
    );
    assert_eq!(
        record
            .guided_session
            .as_ref()
            .map(|session| session.draft.selection_kind.as_str()),
        Some("delimiter_pair")
    );
}

#[test]
fn execute_workspace_run_processes_every_runnable_target() {
    let workspace = tempdir().expect("tempdir");
    for (directory_name, selector) in [("release_notes", ".release"), ("status_board", ".card")] {
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
    let status_state_document = read_optional_state_document(&status_state_file, &mut Vec::new())
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

fn file_delimited_target_toml(
    target_id: &str,
    display_name: &str,
    file_path: &Path,
    start_delimiter: &str,
    end_delimiter: &str,
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
kind = "delimiter_pair"
start = "{start_delimiter}"
end = "{end_delimiter}"
mode = "literal"
include_start = false
include_end = false
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
