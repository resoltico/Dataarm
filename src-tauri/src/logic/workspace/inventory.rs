use super::{
    ensure_directory, format_process_error, read_target_document, target_selection_label,
    target_source_locator,
};
use crate::logic::watch_profile::load_watch_profile;
use crate::models::{
    TargetBaselinePhase, TargetCompareBasis, TargetRunOutcome, TargetSelectionKind,
    TargetSourceKind, TargetStatusKind, TargetSummary,
};
use ffhn_core::{self, LastRunSnapshot, StatusReport, TargetDocument};
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn inventory_targets(workspace: &Path) -> Result<Vec<TargetSummary>, String> {
    ensure_directory(workspace, "workspace")?;
    let mut targets = Vec::new();

    for entry in fs::read_dir(workspace)
        .map_err(|error| format!("Failed to read workspace {}: {error}", workspace.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read workspace entry: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("Failed to inspect workspace entry: {error}"))?
            .is_dir()
        {
            continue;
        }

        let target_file = entry.path().join("target.toml");
        if !target_file.is_file() {
            continue;
        }

        targets.push(inventory_target_directory(workspace, entry.path())?);
    }

    targets.sort_by(target_sort_key);
    Ok(targets)
}

pub(super) fn target_requires_attention(target: &TargetSummary) -> bool {
    !matches!(
        target.status_kind,
        TargetStatusKind::Ready | TargetStatusKind::Pending
    )
}

fn inventory_target_directory(
    workspace: &Path,
    target_dir: PathBuf,
) -> Result<TargetSummary, String> {
    let directory_name = target_dir
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Invalid target directory name {}", target_dir.display()))?
        .to_owned();
    let target_file = target_dir.join("target.toml");
    let watch_profile = load_watch_profile(&target_dir)?;
    let raw_toml = fs::read_to_string(&target_file)
        .map_err(|error| format!("Failed to read {}: {error}", target_file.display()))?;
    let parsed_target = read_target_document(&raw_toml);
    let target_paths = ffhn_core::TargetPaths::try_new(workspace, directory_name.as_str());
    let current_compare_preview = read_current_compare_preview(&target_dir);

    let status_result = match &target_paths {
        Ok(paths) => Some(ffhn_core::status(paths)),
        Err(_) => None,
    };

    let last_run_snapshot = match &target_paths {
        Ok(paths) => read_last_run_snapshot(paths.last_run_file()),
        Err(_) => None,
    };

    let (runnable_target_id, status_kind, baseline_phase, error_message) =
        match (&target_paths, &status_result) {
            (Err(error), _) => (
                None,
                TargetStatusKind::DirectoryInvalid,
                None,
                Some(error.to_string()),
            ),
            (Ok(_), Some(Err(error))) => (
                Some(directory_name.clone()),
                TargetStatusKind::StatusError,
                None,
                Some(error.to_string()),
            ),
            (Ok(_), Some(Ok(report))) => (
                Some(report.target_id().to_owned()),
                TargetStatusKind::from_status_token(report.status().kind_str()),
                report
                    .baseline_phase()
                    .and_then(|value| TargetBaselinePhase::from_token(value.as_str())),
                report.error_detail().map(format_process_error),
            ),
            (Ok(_), None) => (
                Some(directory_name.clone()),
                TargetStatusKind::StatusError,
                None,
                Some("Target inventory could not load status.".to_owned()),
            ),
        };

    let parsed_target_ref = parsed_target.as_ref().ok();
    let parsed_target_error = parsed_target.as_ref().err().cloned();
    let declared_target_id = parsed_target_ref.map(|target| target.target_id().to_owned());
    let final_target_id = runnable_target_id.clone().or(declared_target_id);

    Ok(TargetSummary {
        directory_name,
        target_directory_path: target_dir.display().to_string(),
        target_id: final_target_id,
        runnable_target_id,
        display_name: parsed_target_ref
            .map(|target| target.display_name().to_owned())
            .or_else(|| status_result.as_ref().and_then(status_display_name)),
        enabled: parsed_target_ref
            .map(TargetDocument::enabled)
            .or_else(|| status_result.as_ref().and_then(status_enabled)),
        source_kind: parsed_target_ref.map(|target| {
            if target.source_url().is_some() {
                TargetSourceKind::Http
            } else {
                TargetSourceKind::File
            }
        }),
        source_locator: parsed_target_ref.and_then(target_source_locator),
        selection_kind: parsed_target_ref
            .map(|target| TargetSelectionKind::from_token(target.selection_kind().as_str()))
            .transpose()?,
        selection_label: parsed_target_ref.map(target_selection_label),
        compare_basis: parsed_target_ref
            .map(|target| TargetCompareBasis::from_token(target.compare_basis().as_str()))
            .transpose()?,
        status_kind,
        baseline_phase,
        last_run_outcome: last_run_snapshot.as_ref().and_then(|snapshot| {
            TargetRunOutcome::from_token(snapshot.run_report().run_outcome().as_str())
        }),
        last_run_at: last_run_snapshot
            .as_ref()
            .map(|snapshot| snapshot.run_report().run_started_at().to_owned()),
        current_compare_preview,
        watch_profile,
        error_message: error_message.or(parsed_target_error),
    })
}

fn read_current_compare_preview(target_dir: &Path) -> Option<String> {
    let compare_path = target_dir.join("snapshots/current/compare.txt");
    let compare_text = fs::read_to_string(compare_path).ok()?;
    let compact = compare_text.trim().replace('\n', " ");
    if compact.is_empty() {
        return None;
    }
    let preview = compact.chars().take(140).collect::<String>();
    Some(if compact.chars().count() > 140 {
        format!("{preview}…")
    } else {
        preview
    })
}

fn read_last_run_snapshot(path: PathBuf) -> Option<LastRunSnapshot> {
    if !path.is_file() {
        return None;
    }

    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn status_display_name(result: &Result<StatusReport, ffhn_core::CoreError>) -> Option<String> {
    result
        .as_ref()
        .ok()
        .and_then(|report| report.display_name().map(ToOwned::to_owned))
}

fn status_enabled(result: &Result<StatusReport, ffhn_core::CoreError>) -> Option<bool> {
    result.as_ref().ok().and_then(StatusReport::enabled)
}

fn target_sort_key(left: &TargetSummary, right: &TargetSummary) -> Ordering {
    let left_key = left
        .display_name
        .as_deref()
        .unwrap_or(&left.directory_name)
        .to_ascii_lowercase();
    let right_key = right
        .display_name
        .as_deref()
        .unwrap_or(&right.directory_name)
        .to_ascii_lowercase();

    left_key
        .cmp(&right_key)
        .then_with(|| left.directory_name.cmp(&right.directory_name))
}
