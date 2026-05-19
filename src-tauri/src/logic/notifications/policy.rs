use crate::models::{
    NotificationPermissionState, NotificationPolicy, NotificationScopeKind, NotificationTone,
    SkippedDirectory, TargetSummary, WorkspaceSnapshot,
};
use serde_json::Value;

pub(super) struct NotificationCandidate {
    pub(super) tone: NotificationTone,
    pub(super) scope_kind: NotificationScopeKind,
    pub(super) title: String,
    pub(super) body: String,
    pub(super) workspace_name: String,
    pub(super) target_display_name: Option<String>,
}

#[derive(Default)]
pub(super) struct BatchOutcomeCounts {
    pub(super) changed: usize,
    pub(super) initialized: usize,
    pub(super) unchanged: usize,
    pub(super) other: usize,
}

pub(super) fn build_target_run_candidate(
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
            title: format!("First check saved for {target_name}."),
            body: format!(
                "The first live run in {workspace_name} saved the starting reference for {target_name}."
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
                    "The live run in {workspace_name} matched the saved reference for {target_name}."
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

pub(super) fn build_target_failure_candidate(
    workspace: &WorkspaceSnapshot,
    target: Option<&TargetSummary>,
    directory_name: &str,
    error_message: &str,
) -> NotificationCandidate {
    let target_name = target
        .and_then(|entry| entry.display_name.clone())
        .unwrap_or_else(|| directory_name.to_owned());

    NotificationCandidate {
        tone: NotificationTone::Error,
        scope_kind: NotificationScopeKind::TargetRun,
        title: format!("Run failed for {target_name}."),
        body: format!(
            "{} could not finish the live run for {target_name}: {error_message}",
            workspace.summary.workspace_name
        ),
        workspace_name: workspace.summary.workspace_name.clone(),
        target_display_name: Some(target_name),
    }
}

pub(super) fn build_workspace_run_candidate(
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
                "All-watch check skipped 1 watch.".to_owned()
            } else {
                format!("All-watch check skipped {skipped} watches.")
            },
            body: format!(
                "{workspace_name} skipped {} because some saved watch files were invalid or unreadable.",
                pluralize(skipped, "watch")
            ),
            workspace_name,
            target_display_name: None,
        });
    }

    if changed_total > 0 && should_notify_change(policy) {
        let changed_phrase = if counts.changed > 0 {
            Some(pluralize(counts.changed, "changed watch"))
        } else {
            None
        };
        let initialized_phrase = if counts.initialized > 0 {
            Some(pluralize(counts.initialized, "new saved reference"))
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
            title: format!("All-watch check found {details}."),
            body: format!("{workspace_name} finished checking all watches with {details}."),
            workspace_name,
            target_display_name: None,
        });
    }

    if matches!(policy, NotificationPolicy::AllCompletions) {
        let title = if counts.unchanged > 0 && counts.other == 0 {
            "All-watch check completed with no changes.".to_owned()
        } else {
            "All-watch check completed.".to_owned()
        };
        let body = if counts.unchanged > 0 && counts.other == 0 {
            format!(
                "{workspace_name} checked {} and found no changes.",
                pluralize(counts.unchanged, "watch")
            )
        } else {
            format!(
                "{workspace_name} completed the full check across {}.",
                pluralize(
                    counts.changed + counts.initialized + counts.unchanged + counts.other,
                    "watch"
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

pub(super) fn run_outcome(value: &Value) -> Option<String> {
    value
        .get("result")
        .and_then(|result| result.get("kind"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

pub(super) fn batch_outcome_counts(batch_report: &Value) -> BatchOutcomeCounts {
    let mut counts = BatchOutcomeCounts::default();
    let Some(entries) = batch_report.get("entries").and_then(Value::as_array) else {
        return counts;
    };

    for entry in entries {
        match entry
            .get("run_report")
            .and_then(|report| report.get("result"))
            .and_then(|result| result.get("kind"))
            .and_then(Value::as_str)
        {
            Some("changed") => counts.changed += 1,
            Some("initialized") => counts.initialized += 1,
            Some("unchanged") => counts.unchanged += 1,
            Some(_) => counts.other += 1,
            None => counts.other += 1,
        }
    }

    counts
}

pub(super) fn permission_state_message(state: NotificationPermissionState) -> &'static str {
    match state {
        NotificationPermissionState::Granted => "System delivery is ready for this runtime.",
        NotificationPermissionState::Denied => "System delivery was denied by the platform.",
        NotificationPermissionState::Prompt => {
            "System delivery is waiting for a platform permission prompt."
        }
        NotificationPermissionState::PromptWithRationale => {
            "System delivery needs a platform permission prompt with rationale."
        }
        NotificationPermissionState::Unknown => "System delivery is unavailable on this runtime.",
    }
}

fn should_notify_change(policy: NotificationPolicy) -> bool {
    matches!(
        policy,
        NotificationPolicy::ChangesAndErrors | NotificationPolicy::AllCompletions
    )
}

fn pluralize(count: usize, singular: &str) -> String {
    if count == 1 {
        format!("1 {singular}")
    } else {
        format!("{count} {singular}s")
    }
}
