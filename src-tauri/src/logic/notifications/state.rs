use crate::models::{NotificationPermissionState, NotificationStateEnvelope};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::{NotificationExt, PermissionState};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

pub(super) const NOTIFICATION_STATE_SCHEMA_VERSION: u32 = 1;
pub(super) const MAX_NOTIFICATION_ITEMS: usize = 24;

pub(super) fn load_notification_state(
    app: &AppHandle,
) -> Result<NotificationStateEnvelope, String> {
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

pub(super) fn persist_notification_state(
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

pub(super) fn default_notification_state() -> NotificationStateEnvelope {
    NotificationStateEnvelope {
        schema_version: NOTIFICATION_STATE_SCHEMA_VERSION,
        settings: crate::models::NotificationSettings::default(),
        items: Vec::new(),
    }
}

pub(super) fn current_permission_state(app: &AppHandle) -> NotificationPermissionState {
    app.notification()
        .permission_state()
        .map(map_permission_state)
        .unwrap_or(NotificationPermissionState::Unknown)
}

pub(super) fn request_permission_state(app: &AppHandle) -> NotificationPermissionState {
    app.notification()
        .request_permission()
        .map(map_permission_state)
        .unwrap_or(NotificationPermissionState::Unknown)
}

pub(super) fn show_system_notification(
    app: &AppHandle,
    title: &str,
    body: &str,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title.to_owned())
        .body(body.to_owned())
        .show()
        .map_err(|error| format!("System notification delivery failed: {error}"))
}

pub(super) fn now_timestamp() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| format!("Failed to format current time: {error}"))
}

fn notification_state_file(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(root.join("desktop-state").join("notification-state.json"))
}

fn map_permission_state(state: PermissionState) -> NotificationPermissionState {
    match state {
        PermissionState::Granted => NotificationPermissionState::Granted,
        PermissionState::Denied => NotificationPermissionState::Denied,
        PermissionState::Prompt => NotificationPermissionState::Prompt,
        PermissionState::PromptWithRationale => NotificationPermissionState::PromptWithRationale,
    }
}
