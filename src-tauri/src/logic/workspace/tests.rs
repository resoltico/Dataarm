use super::*;
use crate::models::{TargetSourceKind, TargetStatusKind};
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
    assert_eq!(target.status_kind, TargetStatusKind::DirectoryInvalid);
    assert_eq!(target.display_name.as_deref(), Some("Good Target"));
    assert_eq!(target.source_kind, Some(TargetSourceKind::Http));
    assert!(target.error_message.is_some());
}

#[test]
fn resolve_existing_target_directory_accepts_a_direct_child() {
    let temp = tempdir().expect("tempdir");
    let target_dir = temp.path().join("release_notes");
    fs::create_dir_all(&target_dir).expect("create target dir");

    let resolved =
        resolve_existing_target_directory(temp.path(), "release_notes").expect("resolve target");

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
