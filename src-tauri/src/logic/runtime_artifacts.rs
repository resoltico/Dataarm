use crate::models::{SnapshotArtifactRecord, SnapshotArtifactSlot, TargetArtifactHistory};
use ffhn_core::{ExtractionRecord, SnapshotReference, SnapshotSlot, StateDocument};
use std::fs;
use std::path::Path;

pub(super) fn load_target_artifact_history(
    target_directory: &Path,
    state_document: &StateDocument,
) -> Result<TargetArtifactHistory, String> {
    let current_snapshot = state_document
        .current_snapshot()
        .map(|snapshot| load_snapshot_artifact_record(target_directory, snapshot))
        .transpose()?;
    let snapshot_history = state_document
        .snapshot_history()
        .iter()
        .map(|snapshot| load_snapshot_artifact_record(target_directory, snapshot))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(TargetArtifactHistory {
        monitoring_contract_digest_sha256: state_document
            .monitoring_contract_digest_sha256()
            .to_owned(),
        current_snapshot,
        snapshot_history,
    })
}

fn load_snapshot_artifact_record(
    target_directory: &Path,
    snapshot: &SnapshotReference,
) -> Result<SnapshotArtifactRecord, String> {
    let compare_path = target_directory.join(snapshot.compare_path().as_path());
    let outer_html_path = target_directory.join(snapshot.outer_html_path().as_path());
    let extraction_path = target_directory.join(snapshot.extraction_record_path().as_path());

    let compare_text = fs::read_to_string(&compare_path)
        .map_err(|error| format!("Failed to read {}: {error}", compare_path.display()))?;
    let outer_html = fs::read_to_string(&outer_html_path)
        .map_err(|error| format!("Failed to read {}: {error}", outer_html_path.display()))?;
    let extraction_record = read_extraction_record(&extraction_path)?;

    Ok(SnapshotArtifactRecord {
        slot: match snapshot.slot() {
            SnapshotSlot::Current => SnapshotArtifactSlot::Current,
            SnapshotSlot::History => SnapshotArtifactSlot::History,
            _ => {
                return Err(format!(
                    "Unsupported snapshot slot while loading {}",
                    snapshot.compare_path().as_str()
                ));
            }
        },
        captured_at: snapshot.captured_at().to_owned(),
        compare_digest_sha256: snapshot.compare_digest_sha256().to_owned(),
        outer_html_sha256: snapshot.outer_html_sha256().to_owned(),
        compare_path: snapshot.compare_path().as_str().to_owned(),
        outer_html_path: snapshot.outer_html_path().as_str().to_owned(),
        extraction_path: snapshot.extraction_record_path().as_str().to_owned(),
        compare_text,
        outer_html,
        extraction_record,
    })
}

fn read_extraction_record(path: &Path) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    let record: ExtractionRecord = serde_json::from_str(&content)
        .map_err(|error| format!("Failed to decode {}: {error}", path.display()))?;
    serde_json::to_value(record).map_err(|error| {
        format!(
            "Failed to encode extraction record from {}: {error}",
            path.display()
        )
    })
}
