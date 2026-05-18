use crate::models::{
    AppState, NotificationCenterSnapshot, NotificationChannel, NotificationDelivery,
    NotificationPermissionState, NotificationPolicy, NotificationRecord, NotificationScopeKind,
    NotificationSettings, NotificationStateEnvelope, NotificationTone, SkippedDirectory,
    TargetSummary, WorkspaceSnapshot,
};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::{NotificationExt, PermissionState};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

const NOTIFICATION_STATE_SCHEMA_VERSION: u32 = 1;
const MAX_NOTIFICATION_ITEMS: usize = 24;

#[derive(Clone)]
struct NotificationCandidate {
    tone: NotificationTone,
    scope_kind: NotificationScopeKind,
    title: String,
    body: String,
    workspace_name: String,
    target_display_name: Option<String>,
}

#[derive(Default)]
struct BatchOutcomeCounts {
    changed: usize,
    initialized: usize,
    unchanged: usize,
    other: usize,
}

pub(crate) fn notification_center_snapshot(app: &AppHandle) -> NotificationCenterSnapshot {
    let document = load_notification_state(app).unwrap_or_else(|_| default_notification_state());

    NotificationCenterSnapshot {
        settings: document.settings,
        permission_state: current_permission_state(app),
        items: document.items,
    }
}

pub(crate) fn update_notification_settings_logic(
    app: &AppHandle,
    state: &State<AppState>,
    settings: NotificationSettings,
) -> Result<NotificationCenterSnapshot, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;
    document.settings = settings;

    if matches!(
        document.settings.delivery,
        NotificationDelivery::System | NotificationDelivery::Both
    ) {
        let _ = request_permission_state(app);
    }

    persist_notification_state(app, &document)?;
    Ok(notification_center_snapshot(app))
}

pub(crate) fn clear_notification_feed_logic(
    app: &AppHandle,
    state: &State<AppState>,
) -> Result<NotificationCenterSnapshot, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;
    document.items.clear();
    persist_notification_state(app, &document)?;
    Ok(notification_center_snapshot(app))
}

pub(crate) fn record_target_run_notification(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &WorkspaceSnapshot,
    directory_name: &str,
    run_report: &Value,
) -> Result<Option<NotificationRecord>, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;
    let target = workspace
        .targets
        .iter()
        .find(|target| target.directory_name == directory_name);

    let Some(candidate) =
        build_target_run_candidate(document.settings.notify_when, workspace, target, run_report)
    else {
        return Ok(None);
    };

    let permission_state = current_permission_state(app);
    let record =
        append_notification_entry(&mut document, permission_state, candidate, |candidate| {
            show_system_notification(app, candidate)
        })?;
    persist_notification_state(app, &document)?;
    Ok(Some(record))
}

pub(crate) fn record_target_run_failure_notification(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &WorkspaceSnapshot,
    directory_name: &str,
    error_message: &str,
) -> Result<Option<NotificationRecord>, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;

    if matches!(document.settings.notify_when, NotificationPolicy::Off) {
        return Ok(None);
    }

    let target = workspace
        .targets
        .iter()
        .find(|target| target.directory_name == directory_name);
    let Some(candidate) =
        build_target_failure_candidate(workspace, target, directory_name, error_message)
    else {
        return Ok(None);
    };

    let permission_state = current_permission_state(app);
    let record =
        append_notification_entry(&mut document, permission_state, candidate, |candidate| {
            show_system_notification(app, candidate)
        })?;
    persist_notification_state(app, &document)?;
    Ok(Some(record))
}

pub(crate) fn record_workspace_run_notification(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &WorkspaceSnapshot,
    batch_report: &Value,
    skipped_directories: &[SkippedDirectory],
) -> Result<Option<NotificationRecord>, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;
    let Some(candidate) = build_workspace_run_candidate(
        document.settings.notify_when,
        workspace,
        batch_report,
        skipped_directories,
    ) else {
        return Ok(None);
    };

    let permission_state = current_permission_state(app);
    let record =
        append_notification_entry(&mut document, permission_state, candidate, |candidate| {
            show_system_notification(app, candidate)
        })?;
    persist_notification_state(app, &document)?;
    Ok(Some(record))
}

pub(crate) fn record_workspace_run_failure_notification(
    app: &AppHandle,
    state: &State<AppState>,
    workspace: &WorkspaceSnapshot,
    error_message: &str,
) -> Result<Option<NotificationRecord>, String> {
    let _guard = state.notification_state_lock.lock().unwrap();
    let mut document = load_notification_state(app)?;

    if matches!(document.settings.notify_when, NotificationPolicy::Off) {
        return Ok(None);
    }

    let candidate = NotificationCandidate {
        tone: NotificationTone::Error,
        scope_kind: NotificationScopeKind::WorkspaceRun,
        title: "Workspace run failed.".to_owned(),
        body: format!(
            "{} could not finish the live workspace run: {}",
            workspace.summary.workspace_name, error_message
        ),
        workspace_name: workspace.summary.workspace_name.clone(),
        target_display_name: None,
    };

    let permission_state = current_permission_state(app);
    let record =
        append_notification_entry(&mut document, permission_state, candidate, |candidate| {
            show_system_notification(app, candidate)
        })?;
    persist_notification_state(app, &document)?;
    Ok(Some(record))
}

fn build_target_run_candidate(
    policy: NotificationPolicy,
    workspace: &WorkspaceSnapshot,
    target: Option<&TargetSummary>,
    run_report: &Value,
) -> Option<NotificationCandidate> {
    let target_name = target
        .and_then(|entry| entry.display_name.clone())
        .or_else(|| target.map(|entry| entry.directory_name.clone()))
        .unwrap_or_else(|| "Selected target".to_owned());
    let workspace_name = workspace.summary.workspace_name.clone();
    let outcome = run_outcome(run_report)?;

    match outcome.as_str() {
        "changed" if should_notify_change(policy) => Some(NotificationCandidate {
            tone: NotificationTone::Warning,
            scope_kind: NotificationScopeKind::TargetRun,
            title: format!("Change detected in {target_name}."),
            body: format!(
                "The live run in {workspace_name} recorded content changes for {target_name}."
            ),
            workspace_name,
            target_display_name: Some(target_name),
        }),
        "initialized" if should_notify_change(policy) => Some(NotificationCandidate {
            tone: NotificationTone::Success,
            scope_kind: NotificationScopeKind::TargetRun,
            title: format!("Baseline captured for {target_name}."),
            body: format!(
                "The first live run in {workspace_name} established a baseline for {target_name}."
            ),
            workspace_name,
            target_display_name: Some(target_name),
        }),
        "unchanged" if matches!(policy, NotificationPolicy::AllCompletions) => {
            Some(NotificationCandidate {
                tone: NotificationTone::Success,
                scope_kind: NotificationScopeKind::TargetRun,
                title: format!("No change in {target_name}."),
                body: format!(
                    "The live run in {workspace_name} matched the current baseline for {target_name}."
                ),
                workspace_name,
                target_display_name: Some(target_name),
            })
        }
        other if matches!(policy, NotificationPolicy::AllCompletions) => {
            Some(NotificationCandidate {
                tone: NotificationTone::Info,
                scope_kind: NotificationScopeKind::TargetRun,
                title: format!("Run completed for {target_name}."),
                body: format!(
                    "The live run in {workspace_name} finished for {target_name} with outcome {other}."
                ),
                workspace_name,
                target_display_name: Some(target_name),
            })
        }
        _ => None,
    }
}

fn build_target_failure_candidate(
    workspace: &WorkspaceSnapshot,
    target: Option<&TargetSummary>,
    directory_name: &str,
    error_message: &str,
) -> Option<NotificationCandidate> {
    let target_name = target
        .and_then(|entry| entry.display_name.clone())
        .unwrap_or_else(|| directory_name.to_owned());

    Some(NotificationCandidate {
        tone: NotificationTone::Error,
        scope_kind: NotificationScopeKind::TargetRun,
        title: format!("Run failed for {target_name}."),
        body: format!(
            "{} could not finish the live run for {target_name}: {error_message}",
            workspace.summary.workspace_name
        ),
        workspace_name: workspace.summary.workspace_name.clone(),
        target_display_name: Some(target_name),
    })
}

fn build_workspace_run_candidate(
    policy: NotificationPolicy,
    workspace: &WorkspaceSnapshot,
    batch_report: &Value,
    skipped_directories: &[SkippedDirectory],
) -> Option<NotificationCandidate> {
    let workspace_name = workspace.summary.workspace_name.clone();
    let counts = batch_outcome_counts(batch_report);
    let changed_total = counts.changed + counts.initialized;

    if !skipped_directories.is_empty() && !matches!(policy, NotificationPolicy::Off) {
        let skipped = skipped_directories.len();
        return Some(NotificationCandidate {
            tone: NotificationTone::Error,
            scope_kind: NotificationScopeKind::WorkspaceRun,
            title: if skipped == 1 {
                "Workspace run skipped 1 directory.".to_owned()
            } else {
                format!("Workspace run skipped {skipped} directories.")
            },
            body: format!(
                "{workspace_name} skipped {} because durable target ids were invalid or unreadable.",
                pluralize(skipped, "directory")
            ),
            workspace_name,
            target_display_name: None,
        });
    }

    if changed_total > 0 && should_notify_change(policy) {
        let changed_phrase = if counts.changed > 0 {
            Some(pluralize(counts.changed, "changed target"))
        } else {
            None
        };
        let initialized_phrase = if counts.initialized > 0 {
            Some(pluralize(counts.initialized, "new baseline"))
        } else {
            None
        };
        let details = [changed_phrase, initialized_phrase]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" and ");

        return Some(NotificationCandidate {
            tone: NotificationTone::Warning,
            scope_kind: NotificationScopeKind::WorkspaceRun,
            title: format!("Workspace run found {details}."),
            body: format!("{workspace_name} finished a live batch run with {details}."),
            workspace_name,
            target_display_name: None,
        });
    }

    if matches!(policy, NotificationPolicy::AllCompletions) {
        let title = if counts.unchanged > 0 && counts.other == 0 {
            "Workspace run completed with no changes.".to_owned()
        } else {
            "Workspace run completed.".to_owned()
        };
        let body = if counts.unchanged > 0 && counts.other == 0 {
            format!(
                "{workspace_name} checked {} and found no changes.",
                pluralize(counts.unchanged, "target")
            )
        } else {
            format!(
                "{workspace_name} completed the live batch run across {}.",
                pluralize(
                    counts.changed + counts.initialized + counts.unchanged + counts.other,
                    "target"
                )
            )
        };

        return Some(NotificationCandidate {
            tone: NotificationTone::Success,
            scope_kind: NotificationScopeKind::WorkspaceRun,
            title,
            body,
            workspace_name,
            target_display_name: None,
        });
    }

    None
}

fn append_notification_entry(
    document: &mut NotificationStateEnvelope,
    permission_state: NotificationPermissionState,
    candidate: NotificationCandidate,
    mut deliver_system: impl FnMut(&NotificationCandidate) -> Result<(), String>,
) -> Result<NotificationRecord, String> {
    let mut delivered_channels = Vec::new();
    let mut delivery_error = None;

    if matches!(
        document.settings.delivery,
        NotificationDelivery::InApp | NotificationDelivery::Both
    ) {
        delivered_channels.push(NotificationChannel::InApp);
    }

    if matches!(
        document.settings.delivery,
        NotificationDelivery::System | NotificationDelivery::Both
    ) {
        if matches!(permission_state, NotificationPermissionState::Granted) {
            match deliver_system(&candidate) {
                Ok(()) => delivered_channels.push(NotificationChannel::System),
                Err(error) => delivery_error = Some(error),
            }
        } else {
            delivery_error = Some(permission_state_message(permission_state).to_owned());
        }
    }

    let record = NotificationRecord {
        id: format!("alert-{}", OffsetDateTime::now_utc().unix_timestamp_nanos()),
        created_at: now_timestamp()?,
        tone: candidate.tone,
        scope_kind: candidate.scope_kind,
        title: candidate.title,
        body: candidate.body,
        workspace_name: candidate.workspace_name,
        target_display_name: candidate.target_display_name,
        delivered_channels,
        delivery_error,
    };

    document.items.insert(0, record.clone());
    document.items.truncate(MAX_NOTIFICATION_ITEMS);
    Ok(record)
}

fn load_notification_state(app: &AppHandle) -> Result<NotificationStateEnvelope, String> {
    let state_file = notification_state_file(app)?;
    if !state_file.exists() {
        return Ok(default_notification_state());
    }

    let content = match fs::read_to_string(&state_file) {
        Ok(content) => content,
        Err(error) => {
            return Err(format!(
                "Failed to read notification state {}: {error}",
                state_file.display()
            ));
        }
    };
    let envelope: NotificationStateEnvelope = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(_) => return Ok(default_notification_state()),
    };

    if envelope.schema_version != NOTIFICATION_STATE_SCHEMA_VERSION {
        return Ok(default_notification_state());
    }

    Ok(envelope)
}

fn persist_notification_state(
    app: &AppHandle,
    document: &NotificationStateEnvelope,
) -> Result<(), String> {
    let state_file = notification_state_file(app)?;
    if let Some(parent) = state_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    let encoded = serde_json::to_string_pretty(document)
        .map_err(|error| format!("Failed to encode notification state: {error}"))?;
    fs::write(&state_file, encoded)
        .map_err(|error| format!("Failed to write {}: {error}", state_file.display()))
}

fn notification_state_file(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(root.join("desktop-state").join("notification-state.json"))
}

fn default_notification_state() -> NotificationStateEnvelope {
    NotificationStateEnvelope {
        schema_version: NOTIFICATION_STATE_SCHEMA_VERSION,
        settings: NotificationSettings::default(),
        items: Vec::new(),
    }
}

fn current_permission_state(app: &AppHandle) -> NotificationPermissionState {
    app.notification()
        .permission_state()
        .map(map_permission_state)
        .unwrap_or(NotificationPermissionState::Unknown)
}

fn request_permission_state(app: &AppHandle) -> NotificationPermissionState {
    app.notification()
        .request_permission()
        .map(map_permission_state)
        .unwrap_or(NotificationPermissionState::Unknown)
}

fn map_permission_state(state: PermissionState) -> NotificationPermissionState {
    match state {
        PermissionState::Granted => NotificationPermissionState::Granted,
        PermissionState::Denied => NotificationPermissionState::Denied,
        PermissionState::Prompt => NotificationPermissionState::Prompt,
        PermissionState::PromptWithRationale => NotificationPermissionState::PromptWithRationale,
    }
}

fn show_system_notification(
    app: &AppHandle,
    candidate: &NotificationCandidate,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(candidate.title.clone())
        .body(candidate.body.clone())
        .show()
        .map_err(|error| format!("System notification delivery failed: {error}"))
}

fn run_outcome(value: &Value) -> Option<String> {
    value
        .get("result")
        .and_then(|result| result.get("outcome"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            value
                .get("outcome")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
}

fn batch_outcome_counts(batch_report: &Value) -> BatchOutcomeCounts {
    let mut counts = BatchOutcomeCounts::default();

    for entry in batch_report
        .get("entries")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        match run_outcome(entry).as_deref() {
            Some("changed") => counts.changed += 1,
            Some("initialized") => counts.initialized += 1,
            Some("unchanged") => counts.unchanged += 1,
            Some(_) | None => counts.other += 1,
        }
    }

    counts
}

fn should_notify_change(policy: NotificationPolicy) -> bool {
    matches!(
        policy,
        NotificationPolicy::ChangesAndErrors | NotificationPolicy::AllCompletions
    )
}

fn permission_state_message(state: NotificationPermissionState) -> &'static str {
    match state {
        NotificationPermissionState::Granted => "System delivery is ready.",
        NotificationPermissionState::Denied => "System delivery was denied by the platform.",
        NotificationPermissionState::Prompt => {
            "System delivery is waiting for platform permission."
        }
        NotificationPermissionState::PromptWithRationale => {
            "System delivery needs a platform permission prompt."
        }
        NotificationPermissionState::Unknown => "System delivery is unavailable on this runtime.",
    }
}

fn pluralize(count: usize, singular: &str) -> String {
    if count == 1 {
        format!("{count} {singular}")
    } else {
        format!("{count} {singular}s")
    }
}

fn now_timestamp() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| format!("Failed to format current time: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(
        policy: NotificationPolicy,
        delivery: NotificationDelivery,
    ) -> NotificationSettings {
        NotificationSettings {
            notify_when: policy,
            delivery,
        }
    }

    fn workspace(name: &str) -> WorkspaceSnapshot {
        WorkspaceSnapshot {
            summary: crate::models::WorkspaceSummary {
                workspace_name: name.to_owned(),
                workspace_path: format!("/tmp/{name}"),
                workspace_source: "user".to_owned(),
                target_count: 1,
                runnable_target_count: 1,
                issue_count: 0,
                last_run_count: 0,
            },
            recent_workspaces: Vec::new(),
            notification_center: NotificationCenterSnapshot {
                settings: NotificationSettings::default(),
                permission_state: NotificationPermissionState::Granted,
                items: Vec::new(),
            },
            targets: vec![TargetSummary {
                directory_name: "release_notes".to_owned(),
                target_directory_path: format!("/tmp/{name}/release_notes"),
                target_id: Some("release_notes".to_owned()),
                display_name: Some("Release notes".to_owned()),
                enabled: Some(true),
                source_kind: Some("file".to_owned()),
                source_locator: Some("/tmp/source.html".to_owned()),
                selection_kind: Some("css_selector".to_owned()),
                selection_label: Some(".release (single, text)".to_owned()),
                compare_basis: Some("text".to_owned()),
                status_kind: "pending".to_owned(),
                baseline_phase: Some("never_succeeded".to_owned()),
                last_run_outcome: None,
                last_run_at: None,
                error_message: None,
            }],
        }
    }

    fn run_report(outcome: &str) -> Value {
        serde_json::json!({
            "schema_name": "ffhn.run_report",
            "result": { "outcome": outcome }
        })
    }

    #[test]
    fn appends_changed_target_run_notifications_for_changes_and_errors_policy() {
        let mut document = NotificationStateEnvelope {
            schema_version: NOTIFICATION_STATE_SCHEMA_VERSION,
            settings: settings(
                NotificationPolicy::ChangesAndErrors,
                NotificationDelivery::Both,
            ),
            items: Vec::new(),
        };
        let snapshot = workspace("demo-watch-root");
        let candidate = build_target_run_candidate(
            document.settings.notify_when,
            &snapshot,
            snapshot.targets.first(),
            &run_report("changed"),
        )
        .expect("candidate");

        let mut delivered = 0;
        let record = append_notification_entry(
            &mut document,
            NotificationPermissionState::Granted,
            candidate,
            |_| {
                delivered += 1;
                Ok(())
            },
        )
        .expect("append notification");

        assert_eq!(delivered, 1);
        assert_eq!(
            record.delivered_channels,
            vec![NotificationChannel::InApp, NotificationChannel::System]
        );
        assert!(record.title.contains("Change detected"));
        assert_eq!(document.items.len(), 1);
    }

    #[test]
    fn suppresses_unchanged_target_run_notifications_unless_all_completions_is_enabled() {
        let snapshot = workspace("demo-watch-root");

        let suppressed = build_target_run_candidate(
            NotificationPolicy::ChangesAndErrors,
            &snapshot,
            snapshot.targets.first(),
            &run_report("unchanged"),
        );
        assert!(suppressed.is_none());

        let enabled = build_target_run_candidate(
            NotificationPolicy::AllCompletions,
            &snapshot,
            snapshot.targets.first(),
            &run_report("unchanged"),
        );
        assert!(enabled.is_some());
    }

    #[test]
    fn logs_delivery_errors_when_system_notifications_are_denied() {
        let mut document = NotificationStateEnvelope {
            schema_version: NOTIFICATION_STATE_SCHEMA_VERSION,
            settings: settings(NotificationPolicy::ErrorsOnly, NotificationDelivery::System),
            items: Vec::new(),
        };
        let record = append_notification_entry(
            &mut document,
            NotificationPermissionState::Denied,
            NotificationCandidate {
                tone: NotificationTone::Error,
                scope_kind: NotificationScopeKind::TargetRun,
                title: "Run failed.".to_owned(),
                body: "The run failed.".to_owned(),
                workspace_name: "demo-watch-root".to_owned(),
                target_display_name: Some("Release notes".to_owned()),
            },
            |_| Ok(()),
        )
        .expect("append notification");

        assert!(record.delivered_channels.is_empty());
        assert_eq!(
            record.delivery_error.as_deref(),
            Some("System delivery was denied by the platform.")
        );
    }

    #[test]
    fn promotes_workspace_skip_failures_to_attention_notifications() {
        let snapshot = workspace("demo-watch-root");
        let candidate = build_workspace_run_candidate(
            NotificationPolicy::ErrorsOnly,
            &snapshot,
            &serde_json::json!({
                "schema_name": "ffhn.batch_run_report",
                "entries": []
            }),
            &[SkippedDirectory {
                directory_name: "bad-target".to_owned(),
                reason: "Invalid durable target id".to_owned(),
            }],
        )
        .expect("candidate");

        assert_eq!(candidate.tone, NotificationTone::Error);
        assert!(candidate.title.contains("skipped 1 directory"));
    }
}
