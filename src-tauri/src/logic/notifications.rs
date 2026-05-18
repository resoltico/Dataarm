mod policy;
mod state;
#[cfg(test)]
mod tests;

use crate::models::{
    AppState, NotificationCenterSnapshot, NotificationChannel, NotificationDelivery,
    NotificationPermissionState, NotificationPolicy, NotificationRecord, NotificationScopeKind,
    NotificationSettings, NotificationStateEnvelope, NotificationTone, SkippedDirectory,
    WorkspaceSnapshot,
};
use policy::{
    NotificationCandidate, build_target_failure_candidate, build_target_run_candidate,
    build_workspace_run_candidate, permission_state_message,
};
use serde_json::Value;
use state::{
    MAX_NOTIFICATION_ITEMS, current_permission_state, default_notification_state,
    load_notification_state, now_timestamp, persist_notification_state, request_permission_state,
    show_system_notification,
};
use tauri::{AppHandle, State};
use time::OffsetDateTime;

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
    let _guard = state.lock_notification_state()?;
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
    let _guard = state.lock_notification_state()?;
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
    let _guard = state.lock_notification_state()?;
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
            show_system_notification(app, candidate.title.as_str(), candidate.body.as_str())
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
    let _guard = state.lock_notification_state()?;
    let mut document = load_notification_state(app)?;

    if matches!(document.settings.notify_when, NotificationPolicy::Off) {
        return Ok(None);
    }

    let target = workspace
        .targets
        .iter()
        .find(|target| target.directory_name == directory_name);
    let candidate =
        build_target_failure_candidate(workspace, target, directory_name, error_message);

    let permission_state = current_permission_state(app);
    let record =
        append_notification_entry(&mut document, permission_state, candidate, |candidate| {
            show_system_notification(app, candidate.title.as_str(), candidate.body.as_str())
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
    let _guard = state.lock_notification_state()?;
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
            show_system_notification(app, candidate.title.as_str(), candidate.body.as_str())
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
    let _guard = state.lock_notification_state()?;
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
            show_system_notification(app, candidate.title.as_str(), candidate.body.as_str())
        })?;
    persist_notification_state(app, &document)?;
    Ok(Some(record))
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
