use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) recent_workspaces_lock: Mutex<()>,
    pub(crate) notification_state_lock: Mutex<()>,
    pub(crate) current_workspace_path: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub(crate) fn lock_recent_workspaces(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.recent_workspaces_lock
            .lock()
            .map_err(|_| "Recent-workspace state is poisoned.".to_owned())
    }

    pub(crate) fn lock_notification_state(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.notification_state_lock
            .lock()
            .map_err(|_| "Notification state is poisoned.".to_owned())
    }

    pub(crate) fn current_workspace_path(&self) -> Result<Option<PathBuf>, String> {
        self.current_workspace_path
            .lock()
            .map_err(|_| "Current-workspace state is poisoned.".to_owned())
            .map(|path| path.clone())
    }

    pub(crate) fn set_current_workspace_path(&self, path: Option<PathBuf>) -> Result<(), String> {
        let mut guard = self
            .current_workspace_path
            .lock()
            .map_err(|_| "Current-workspace state is poisoned.".to_owned())?;
        *guard = path;
        Ok(())
    }
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

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceSource {
    Demo,
    User,
}

impl WorkspaceSource {
    pub(crate) fn from_workspace_origin(value: &str) -> Result<Self, String> {
        match value {
            "demo" => Ok(Self::Demo),
            "user" => Ok(Self::User),
            other => Err(format!("Unknown workspace source {other}.")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetSourceKind {
    Http,
    File,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetSelectionKind {
    CssSelector,
    DelimiterPair,
}

impl TargetSelectionKind {
    pub(crate) fn from_token(value: &str) -> Result<Self, String> {
        match value {
            "css_selector" => Ok(Self::CssSelector),
            "delimiter_pair" => Ok(Self::DelimiterPair),
            other => Err(format!("Unknown target selection kind {other}.")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetCompareBasis {
    Text,
    InnerHtml,
    OuterHtml,
}

impl TargetCompareBasis {
    pub(crate) fn from_token(value: &str) -> Result<Self, String> {
        match value {
            "text" => Ok(Self::Text),
            "inner_html" => Ok(Self::InnerHtml),
            "outer_html" => Ok(Self::OuterHtml),
            other => Err(format!("Unknown target compare basis {other}.")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetStatusKind {
    Ready,
    Pending,
    Changed,
    SkippedDisabled,
    InvalidConfig,
    UnavailableTarget,
    InvalidState,
    IncompatibleBaseline,
    IntegrityMismatch,
    DirectoryInvalid,
    StatusError,
    FailedPermanent,
    FailedTransient,
}

impl TargetStatusKind {
    pub(crate) fn from_status_token(value: &str) -> Self {
        match value {
            "ready" => Self::Ready,
            "pending" => Self::Pending,
            "changed" => Self::Changed,
            "skipped_disabled" => Self::SkippedDisabled,
            "invalid_config" => Self::InvalidConfig,
            "unavailable_target" => Self::UnavailableTarget,
            "invalid_state" => Self::InvalidState,
            "incompatible_baseline" => Self::IncompatibleBaseline,
            "integrity_mismatch" => Self::IntegrityMismatch,
            "directory_invalid" => Self::DirectoryInvalid,
            "status_error" => Self::StatusError,
            "failed_permanent" => Self::FailedPermanent,
            "failed_transient" => Self::FailedTransient,
            _ => Self::StatusError,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetBaselinePhase {
    NeverSucceeded,
    HasBaseline,
}

impl TargetBaselinePhase {
    pub(crate) fn from_token(value: &str) -> Option<Self> {
        match value {
            "never_succeeded" => Some(Self::NeverSucceeded),
            "has_baseline" => Some(Self::HasBaseline),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TargetRunOutcome {
    Unchanged,
    Changed,
    Initialized,
}

impl TargetRunOutcome {
    pub(crate) fn from_token(value: &str) -> Option<Self> {
        match value {
            "unchanged" => Some(Self::Unchanged),
            "changed" => Some(Self::Changed),
            "initialized" => Some(Self::Initialized),
            _ => None,
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSummary {
    pub(crate) workspace_name: String,
    pub(crate) workspace_path: String,
    pub(crate) workspace_source: WorkspaceSource,
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
    pub(crate) workspace_source: WorkspaceSource,
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
    pub(crate) source_kind: Option<TargetSourceKind>,
    pub(crate) source_locator: Option<String>,
    pub(crate) selection_kind: Option<TargetSelectionKind>,
    pub(crate) selection_label: Option<String>,
    pub(crate) compare_basis: Option<TargetCompareBasis>,
    pub(crate) status_kind: TargetStatusKind,
    pub(crate) baseline_phase: Option<TargetBaselinePhase>,
    pub(crate) last_run_outcome: Option<TargetRunOutcome>,
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
    pub(crate) contract_seed_toml: String,
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
