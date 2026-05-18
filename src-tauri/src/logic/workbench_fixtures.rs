const DEMO_PATH_TOKEN: &str = "__DATAARM_DEMO_PATH__";

const HTTP_TARGET_TEMPLATE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/http-target-template.toml"
));
const FILE_TARGET_TEMPLATE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/file-target-template.toml"
));
const DEMO_STATUS_BOARD_HTML: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/demo-status-board.html"
));
const DEMO_RELEASE_NOTES_HTML: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/demo-release-notes.html"
));
const DEMO_STATUS_BOARD_TARGET_TEMPLATE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/demo-status-board.target.toml"
));
const DEMO_RELEASE_NOTES_TARGET_TEMPLATE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../vendor/workbench-fixtures/demo-release-notes.target.toml"
));

pub(crate) fn http_target_template() -> String {
    format_fixture(HTTP_TARGET_TEMPLATE)
}

pub(crate) fn file_target_template() -> String {
    format_fixture(FILE_TARGET_TEMPLATE)
}

pub(crate) fn demo_status_board_html() -> String {
    format_fixture(DEMO_STATUS_BOARD_HTML)
}

pub(crate) fn demo_release_notes_html() -> String {
    format_fixture(DEMO_RELEASE_NOTES_HTML)
}

pub(crate) fn demo_status_board_target(demo_path: &str) -> String {
    DEMO_STATUS_BOARD_TARGET_TEMPLATE.replace(DEMO_PATH_TOKEN, demo_path)
}

pub(crate) fn demo_release_notes_target(demo_path: &str) -> String {
    DEMO_RELEASE_NOTES_TARGET_TEMPLATE.replace(DEMO_PATH_TOKEN, demo_path)
}

fn format_fixture(fixture: &str) -> String {
    let trimmed = fixture.trim_end_matches(['\r', '\n']);
    format!("{trimmed}\n")
}
