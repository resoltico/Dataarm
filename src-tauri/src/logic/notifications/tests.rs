use super::state::NOTIFICATION_STATE_SCHEMA_VERSION;
use super::*;
use crate::models::{
    NotificationDelivery, TargetBaselinePhase, TargetCompareBasis, TargetSelectionKind,
    TargetSourceKind, TargetStatusKind, TargetSummary, WatchAlertRule, WatchProfile, WatchSchedule,
    WorkspaceSource,
};

fn settings(policy: NotificationPolicy, delivery: NotificationDelivery) -> NotificationSettings {
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
            workspace_source: WorkspaceSource::User,
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
            runnable_target_id: Some("release_notes".to_owned()),
            display_name: Some("Release notes".to_owned()),
            enabled: Some(true),
            source_kind: Some(TargetSourceKind::File),
            source_locator: Some("/tmp/source.html".to_owned()),
            selection_kind: Some(TargetSelectionKind::CssSelector),
            selection_label: Some(".release (single, text)".to_owned()),
            compare_basis: Some(TargetCompareBasis::Text),
            status_kind: TargetStatusKind::Pending,
            baseline_phase: Some(TargetBaselinePhase::NeverSucceeded),
            last_run_outcome: None,
            last_run_at: None,
            current_compare_preview: None,
            watch_profile: WatchProfile {
                schema_name: "dataarm.watch_profile".to_owned(),
                schema_version: 1,
                paused: false,
                folder_name: None,
                tags: Vec::new(),
                schedule: WatchSchedule::default(),
                alert_rule: WatchAlertRule::default(),
                delivery: NotificationDelivery::InApp,
            },
            error_message: None,
        }],
    }
}

fn run_report(outcome: &str) -> Value {
    serde_json::json!({
        "schema_name": "ffhn.run_report",
        "result": { "kind": outcome }
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
    assert!(candidate.title.contains("skipped 1 watch"));
}
