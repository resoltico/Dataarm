#![allow(dead_code, unused_imports)]

#[path = "../src/logic/mod.rs"]
mod logic;
#[path = "../src/models.rs"]
mod models;

use crate::logic::{
    execute_target_run, execute_workspace_run, get_target_template_logic, inventory_targets,
    persist_target_document, preview_target_logic, read_target_from_workspace,
};
use crate::models::{
    DesktopAppInfo, TargetPreviewRequest, TargetSaveRequest, TargetTemplate, WorkspaceSnapshot,
    WorkspaceSource, WorkspaceSummary,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::Path;

#[derive(Deserialize)]
#[serde(tag = "method", content = "params", rename_all = "snake_case")]
enum BridgeRequest {
    AppInfo,
    InventoryWorkspace {
        workspace_path: String,
        workspace_source: WorkspaceSource,
    },
    ReadTarget {
        workspace_path: String,
        directory_name: String,
    },
    GetTargetTemplate {
        kind: String,
    },
    PreviewTarget {
        request: TargetPreviewRequest,
    },
    SaveTarget {
        workspace_path: String,
        request: TargetSaveRequest,
    },
    RunTarget {
        workspace_path: String,
        directory_name: String,
    },
    RunWorkspace {
        workspace_path: String,
        max_concurrency: Option<usize>,
    },
}

#[derive(Serialize)]
struct BridgeResponse {
    ok: bool,
    result: Option<Value>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InventoryPayload {
    summary: WorkspaceSummary,
    targets: Vec<models::TargetSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavePayload {
    directory_name: String,
    inventory: InventoryPayload,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunTargetPayload {
    directory_name: String,
    status_report: Value,
    run_report: Value,
    inventory: InventoryPayload,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunWorkspacePayload {
    batch_report: Value,
    skipped_directories: Vec<models::SkippedDirectory>,
    inventory: InventoryPayload,
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let response = match line {
            Ok(payload) if payload.trim().is_empty() => continue,
            Ok(payload) => handle_request(payload.as_str()),
            Err(error) => BridgeResponse {
                ok: false,
                result: None,
                error: Some(format!("Failed to read bridge input: {error}")),
            },
        };

        serde_json::to_writer(&mut stdout, &response).expect("serialize bridge response");
        stdout
            .write_all(b"\n")
            .expect("write bridge response newline");
        stdout.flush().expect("flush bridge response");
    }
}

fn handle_request(payload: &str) -> BridgeResponse {
    match serde_json::from_str::<BridgeRequest>(payload) {
        Ok(request) => match dispatch(request) {
            Ok(result) => BridgeResponse {
                ok: true,
                result: Some(result),
                error: None,
            },
            Err(error) => BridgeResponse {
                ok: false,
                result: None,
                error: Some(error),
            },
        },
        Err(error) => BridgeResponse {
            ok: false,
            result: None,
            error: Some(format!("Failed to decode bridge request: {error}")),
        },
    }
}

fn dispatch(request: BridgeRequest) -> Result<Value, String> {
    match request {
        BridgeRequest::AppInfo => encode(app_info()),
        BridgeRequest::InventoryWorkspace {
            workspace_path,
            workspace_source,
        } => encode(inventory_payload(
            Path::new(workspace_path.as_str()),
            workspace_source,
        )?),
        BridgeRequest::ReadTarget {
            workspace_path,
            directory_name,
        } => encode(read_target_from_workspace(
            Path::new(workspace_path.as_str()),
            directory_name.as_str(),
        )?),
        BridgeRequest::GetTargetTemplate { kind } => encode(get_target_template_logic(kind)?),
        BridgeRequest::PreviewTarget { request } => encode(preview_target_logic(request)?),
        BridgeRequest::SaveTarget {
            workspace_path,
            request,
        } => {
            let workspace = Path::new(workspace_path.as_str());
            let directory_name = persist_target_document(workspace, &request)?;
            encode(SavePayload {
                directory_name,
                inventory: inventory_payload(workspace, WorkspaceSource::User)?,
            })
        }
        BridgeRequest::RunTarget {
            workspace_path,
            directory_name,
        } => {
            let workspace = Path::new(workspace_path.as_str());
            let (status_report, run_report) =
                execute_target_run(workspace, directory_name.as_str())?;
            encode(RunTargetPayload {
                directory_name,
                status_report,
                run_report,
                inventory: inventory_payload(workspace, WorkspaceSource::User)?,
            })
        }
        BridgeRequest::RunWorkspace {
            workspace_path,
            max_concurrency,
        } => {
            let workspace = Path::new(workspace_path.as_str());
            let (batch_report, skipped_directories) =
                execute_workspace_run(workspace, max_concurrency)?;
            encode(RunWorkspacePayload {
                batch_report,
                skipped_directories,
                inventory: inventory_payload(workspace, WorkspaceSource::User)?,
            })
        }
    }
}

fn inventory_payload(
    workspace: &Path,
    workspace_source: WorkspaceSource,
) -> Result<InventoryPayload, String> {
    ensure_directory(workspace)?;
    let targets = inventory_targets(workspace)?;
    Ok(InventoryPayload {
        summary: WorkspaceSummary {
            workspace_name: workspace_name(workspace),
            workspace_path: workspace.display().to_string(),
            workspace_source,
            target_count: targets.len(),
            runnable_target_count: targets
                .iter()
                .filter(|target| target.runnable_target_id.is_some())
                .count(),
            issue_count: targets
                .iter()
                .filter(|target| {
                    target.error_message.is_some()
                        || matches!(
                            target.status_kind,
                            models::TargetStatusKind::InvalidConfig
                                | models::TargetStatusKind::UnavailableTarget
                                | models::TargetStatusKind::InvalidState
                                | models::TargetStatusKind::IncompatibleBaseline
                                | models::TargetStatusKind::IntegrityMismatch
                                | models::TargetStatusKind::DirectoryInvalid
                                | models::TargetStatusKind::StatusError
                                | models::TargetStatusKind::FailedPermanent
                                | models::TargetStatusKind::FailedTransient
                        )
                })
                .count(),
            last_run_count: targets
                .iter()
                .filter(|target| target.last_run_at.is_some())
                .count(),
        },
        targets,
    })
}

fn app_info() -> DesktopAppInfo {
    DesktopAppInfo {
        app_name: "Dataarm".to_owned(),
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        runtime_contract: "embedded-ffhn-core".to_owned(),
    }
}

fn ensure_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to read workspace {}: {error}", path.display()))?;
    if metadata.is_dir() {
        Ok(())
    } else {
        Err(format!("workspace {} is not a directory", path.display()))
    }
}

fn workspace_name(path: &Path) -> String {
    path.file_name()
        .map(|segment| segment.to_string_lossy().to_string())
        .filter(|segment| !segment.is_empty())
        .unwrap_or_else(|| "watch-root".to_owned())
}

fn encode<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value)
        .map_err(|error| format!("Failed to encode bridge response: {error}"))
}
