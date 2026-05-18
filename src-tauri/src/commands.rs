use crate::logic::*;
use crate::models::*;
use tauri::{AppHandle, State};

#[tauri::command]
pub(crate) fn bootstrap(
    app: AppHandle,
    state: State<AppState>,
) -> Result<DesktopBootstrap, String> {
    bootstrap_logic(&app, &state)
}

#[tauri::command]
pub(crate) fn open_workspace(
    app: AppHandle,
    state: State<AppState>,
    workspace_path: Option<String>,
) -> Result<WorkspaceSnapshot, String> {
    open_workspace_logic(&app, &state, workspace_path)
}

#[tauri::command]
pub(crate) fn refresh_workspace(
    app: AppHandle,
    state: State<AppState>,
) -> Result<WorkspaceSnapshot, String> {
    refresh_workspace_logic(&app, &state)
}

#[tauri::command]
pub(crate) fn create_workspace(
    app: AppHandle,
    state: State<AppState>,
    workspace_path: String,
) -> Result<WorkspaceSnapshot, String> {
    create_workspace_logic(&app, &state, workspace_path)
}

#[tauri::command]
pub(crate) fn read_target(
    app: AppHandle,
    state: State<AppState>,
    directory_name: String,
) -> Result<TargetDocumentRecord, String> {
    read_target_logic(&app, &state, directory_name)
}

#[tauri::command]
pub(crate) fn get_target_template(kind: String) -> Result<TargetTemplate, String> {
    get_target_template_logic(kind)
}

#[tauri::command]
pub(crate) async fn preview_target(request: TargetPreviewRequest) -> Result<TargetPreview, String> {
    tauri::async_runtime::spawn_blocking(move || preview_target_logic(request))
        .await
        .map_err(|error| format!("Preview task failed: {error}"))?
}

#[tauri::command]
pub(crate) fn save_target(
    app: AppHandle,
    state: State<AppState>,
    request: TargetSaveRequest,
) -> Result<TargetMutationResult, String> {
    save_target_logic(&app, &state, request)
}

#[tauri::command]
pub(crate) fn update_notification_settings(
    app: AppHandle,
    state: State<AppState>,
    settings: NotificationSettings,
) -> Result<WorkspaceSnapshot, String> {
    update_notification_settings_logic(&app, &state, settings)?;
    refresh_workspace_logic(&app, &state)
}

#[tauri::command]
pub(crate) fn clear_notification_feed(
    app: AppHandle,
    state: State<AppState>,
) -> Result<WorkspaceSnapshot, String> {
    clear_notification_feed_logic(&app, &state)?;
    refresh_workspace_logic(&app, &state)
}

#[tauri::command]
pub(crate) fn delete_target(
    app: AppHandle,
    state: State<AppState>,
    directory_name: String,
) -> Result<WorkspaceSnapshot, String> {
    delete_target_logic(&app, &state, directory_name)
}

#[tauri::command]
pub(crate) async fn run_target(
    app: AppHandle,
    state: State<'_, AppState>,
    directory_name: String,
) -> Result<TargetRunResult, String> {
    let workspace = current_workspace(&app, &state)?;
    let workspace_path = workspace.path.clone();
    let directory_name_for_run = directory_name.clone();
    let run_result = tauri::async_runtime::spawn_blocking(move || {
        execute_target_run(&workspace_path, &directory_name_for_run)
    })
    .await
    .map_err(|error| format!("Run task failed: {error}"))?;

    let workspace_snapshot = workspace_snapshot(&app, &workspace)?;

    match run_result {
        Ok((status_report, run_report)) => {
            let notification = log_notification_failure(record_target_run_notification(
                &app,
                &state,
                &workspace_snapshot,
                &directory_name,
                &run_report,
            ));

            Ok(TargetRunResult {
                workspace: workspace_snapshot,
                directory_name,
                status_report,
                run_report,
                notification,
            })
        }
        Err(error) => {
            log_notification_failure(record_target_run_failure_notification(
                &app,
                &state,
                &workspace_snapshot,
                &directory_name,
                error.as_str(),
            ));
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) async fn run_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    max_concurrency: Option<usize>,
) -> Result<BatchRunResult, String> {
    let workspace = current_workspace(&app, &state)?;
    let workspace_path = workspace.path.clone();
    let batch_result = tauri::async_runtime::spawn_blocking(move || {
        execute_workspace_run(&workspace_path, max_concurrency)
    })
    .await
    .map_err(|error| format!("Batch run task failed: {error}"))?;

    let workspace_snapshot = workspace_snapshot(&app, &workspace)?;

    match batch_result {
        Ok((batch_report, skipped_directories)) => {
            let notification = log_notification_failure(record_workspace_run_notification(
                &app,
                &state,
                &workspace_snapshot,
                &batch_report,
                &skipped_directories,
            ));

            Ok(BatchRunResult {
                workspace: workspace_snapshot,
                batch_report,
                skipped_directories,
                notification,
            })
        }
        Err(error) => {
            log_notification_failure(record_workspace_run_failure_notification(
                &app,
                &state,
                &workspace_snapshot,
                error.as_str(),
            ));
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) fn open_workspace_path(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    open_workspace_path_logic(&app, &state)
}

#[tauri::command]
pub(crate) fn open_target_path(
    app: AppHandle,
    state: State<AppState>,
    directory_name: String,
) -> Result<(), String> {
    open_target_path_logic(&app, &state, directory_name)
}

fn log_notification_failure(
    notification: Result<Option<NotificationRecord>, String>,
) -> Option<NotificationRecord> {
    match notification {
        Ok(record) => record,
        Err(error) => {
            eprintln!("notification workflow degraded: {error}");
            None
        }
    }
}
