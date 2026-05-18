use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) recent_workspaces_lock: Mutex<()>,
    pub(crate) notification_state_lock: Mutex<()>,
    pub(crate) current_workspace_path: Mutex<Option<PathBuf>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopBootstrap {
    pub(crate) app: DesktopAppInfo,
    pub(crate) workspace: WorkspaceSnapshot,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopAppInfo {
    pub(crate) app_name: String,
    pub(crate) app_version: String,
    pub(crate) runtime_contract: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSnapshot {
    pub(crate) summary: WorkspaceSummary,
    pub(crate) recent_workspaces: Vec<RecentWorkspace>,
    pub(crate) notification_center: NotificationCenterSnapshot,
    pub(crate) targets: Vec<TargetSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationPolicy {
    Off,
    ErrorsOnly,
    #[default]
    ChangesAndErrors,
    AllCompletions,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationDelivery {
    #[default]
    InApp,
    System,
    Both,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationPermissionState {
    Granted,
    Denied,
    Prompt,
    PromptWithRationale,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationChannel {
    InApp,
    System,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationScopeKind {
    TargetRun,
    WorkspaceRun,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum NotificationTone {
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationSettings {
    pub(crate) notify_when: NotificationPolicy,
    pub(crate) delivery: NotificationDelivery,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationCenterSnapshot {
    pub(crate) settings: NotificationSettings,
    pub(crate) permission_state: NotificationPermissionState,
    pub(crate) items: Vec<NotificationRecord>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationRecord {
    pub(crate) id: String,
    pub(crate) created_at: String,
    pub(crate) tone: NotificationTone,
    pub(crate) scope_kind: NotificationScopeKind,
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) workspace_name: String,
    pub(crate) target_display_name: Option<String>,
    pub(crate) delivered_channels: Vec<NotificationChannel>,
    pub(crate) delivery_error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSummary {
    pub(crate) workspace_name: String,
    pub(crate) workspace_path: String,
    pub(crate) workspace_source: String,
    pub(crate) target_count: usize,
    pub(crate) runnable_target_count: usize,
    pub(crate) issue_count: usize,
    pub(crate) last_run_count: usize,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentWorkspace {
    pub(crate) workspace_name: String,
    pub(crate) workspace_path: String,
    pub(crate) workspace_source: String,
    pub(crate) last_opened_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetSummary {
    pub(crate) directory_name: String,
    pub(crate) target_directory_path: String,
    pub(crate) target_id: Option<String>,
    pub(crate) runnable_target_id: Option<String>,
    pub(crate) display_name: Option<String>,
    pub(crate) enabled: Option<bool>,
    pub(crate) source_kind: Option<String>,
    pub(crate) source_locator: Option<String>,
    pub(crate) selection_kind: Option<String>,
    pub(crate) selection_label: Option<String>,
    pub(crate) compare_basis: Option<String>,
    pub(crate) status_kind: String,
    pub(crate) baseline_phase: Option<String>,
    pub(crate) last_run_outcome: Option<String>,
    pub(crate) last_run_at: Option<String>,
    pub(crate) error_message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetDocumentRecord {
    pub(crate) directory_name: String,
    pub(crate) target_directory_path: String,
    pub(crate) target_file_path: String,
    pub(crate) raw_toml: String,
    pub(crate) canonical_toml: Option<String>,
    pub(crate) guided_session: Option<TargetDraftSession>,
    pub(crate) target_id: Option<String>,
    pub(crate) display_name: Option<String>,
    pub(crate) enabled: Option<bool>,
    pub(crate) status_report: Option<Value>,
    pub(crate) last_run_snapshot: Option<Value>,
    pub(crate) state_document: Option<Value>,
    pub(crate) artifact_history: Option<TargetArtifactHistory>,
    pub(crate) artifact_issues: Vec<String>,
    pub(crate) error_message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SnapshotArtifactSlot {
    Current,
    History,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SnapshotArtifactRecord {
    pub(crate) slot: SnapshotArtifactSlot,
    pub(crate) captured_at: String,
    pub(crate) compare_digest_sha256: String,
    pub(crate) outer_html_sha256: String,
    pub(crate) compare_path: String,
    pub(crate) outer_html_path: String,
    pub(crate) extraction_path: String,
    pub(crate) compare_text: String,
    pub(crate) outer_html: String,
    pub(crate) extraction_record: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetArtifactHistory {
    pub(crate) monitoring_contract_digest_sha256: String,
    pub(crate) current_snapshot: Option<SnapshotArtifactRecord>,
    pub(crate) snapshot_history: Vec<SnapshotArtifactRecord>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetDraftCanonicalizer {
    pub(crate) kind: String,
    pub(crate) pattern: Option<String>,
    pub(crate) flags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetDraft {
    pub(crate) kind: String,
    pub(crate) target_id: String,
    pub(crate) display_name: String,
    pub(crate) enabled: bool,
    pub(crate) source_locator: String,
    pub(crate) fetch_method: Option<String>,
    pub(crate) fetch_timeout_ms: Option<u64>,
    pub(crate) fetch_max_bytes: usize,
    pub(crate) fetch_user_agent: Option<String>,
    pub(crate) fetch_follow_redirects: Option<bool>,
    pub(crate) fetch_accept: Option<String>,
    pub(crate) selection_kind: String,
    pub(crate) selection_match: String,
    pub(crate) selection_index: Option<usize>,
    pub(crate) selection_selector: Option<String>,
    pub(crate) selection_start: Option<String>,
    pub(crate) selection_end: Option<String>,
    pub(crate) selection_delimiter_mode: Option<String>,
    pub(crate) selection_include_start: Option<bool>,
    pub(crate) selection_include_end: Option<bool>,
    pub(crate) selection_regex_flags: Vec<String>,
    pub(crate) compare_basis: String,
    pub(crate) compare_whitespace: Option<String>,
    pub(crate) compare_rewrite_urls: bool,
    pub(crate) compare_canonicalizers: Vec<TargetDraftCanonicalizer>,
    pub(crate) storage_history_limit: usize,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetDraftSession {
    pub(crate) draft: TargetDraft,
    pub(crate) contract_seed: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetTemplate {
    pub(crate) kind: String,
    pub(crate) draft_session: TargetDraftSession,
    pub(crate) canonical_toml: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetPreviewRequest {
    pub(crate) draft_session: Option<TargetDraftSession>,
    pub(crate) raw_toml: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetPreview {
    pub(crate) target_id: String,
    pub(crate) display_name: String,
    pub(crate) canonical_toml: String,
    pub(crate) status_report: Value,
    pub(crate) dry_run_report: Value,
    pub(crate) draft_session: TargetDraftSession,
    pub(crate) preview_snapshot: Option<SnapshotArtifactRecord>,
    pub(crate) preview_artifact_issues: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetMutationResult {
    pub(crate) workspace: WorkspaceSnapshot,
    pub(crate) directory_name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetRunResult {
    pub(crate) workspace: WorkspaceSnapshot,
    pub(crate) directory_name: String,
    pub(crate) status_report: Value,
    pub(crate) run_report: Value,
    pub(crate) notification: Option<NotificationRecord>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchRunResult {
    pub(crate) workspace: WorkspaceSnapshot,
    pub(crate) batch_report: Value,
    pub(crate) skipped_directories: Vec<SkippedDirectory>,
    pub(crate) notification: Option<NotificationRecord>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkippedDirectory {
    pub(crate) directory_name: String,
    pub(crate) reason: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetSaveRequest {
    pub(crate) previous_directory_name: Option<String>,
    pub(crate) draft_session: Option<TargetDraftSession>,
    pub(crate) raw_toml: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationStateEnvelope {
    pub(crate) schema_version: u32,
    pub(crate) settings: NotificationSettings,
    pub(crate) items: Vec<NotificationRecord>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentWorkspaceEnvelope {
    pub(crate) schema_version: u32,
    pub(crate) items: Vec<RecentWorkspace>,
}
