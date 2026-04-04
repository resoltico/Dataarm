use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) recent_workspaces: Mutex<Vec<RecentWorkspace>>,
    pub(crate) runs: Mutex<Vec<RunRecord>>,
}


#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopAppInfo {
    pub(crate) app_name: String,
    pub(crate) app_version: String,
    pub(crate) mode: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SidecarHealth {
    pub(crate) ffhn_configured: bool,
    pub(crate) htmlcut_configured: bool,
    pub(crate) ffhn_binary_path_hint: Option<String>,
    pub(crate) htmlcut_binary_path_hint: Option<String>,
    pub(crate) runtime_source: String,
    pub(crate) execution_mode: String,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeReadinessStatus {
    pub(crate) host_target_triple: String,
    pub(crate) current: String,
    pub(crate) runtime_source: String,
    pub(crate) ffhn_binary_path: Option<String>,
    pub(crate) htmlcut_binary_path: Option<String>,
    pub(crate) executable_pair_available: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProbeResult {
    pub(crate) ok: bool,
    pub(crate) command: String,
    pub(crate) mode: String,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSummary {
    pub(crate) workspace_name: String,
    pub(crate) workspace_path: String,
    pub(crate) target_count: usize,
    pub(crate) run_count: usize,
    pub(crate) mode: String,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetRecord {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) url: String,
    pub(crate) status: String,
    pub(crate) enabled: bool,
    pub(crate) extractor_summary: String,
    pub(crate) last_run_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunRecord {
    pub(crate) id: String,
    pub(crate) target_id: String,
    pub(crate) status: String,
    pub(crate) started_at: String,
    pub(crate) finished_at: Option<String>,
    pub(crate) summary: String,
    pub(crate) mode: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunDetail {
    pub(crate) id: String,
    pub(crate) target_id: String,
    pub(crate) status: String,
    pub(crate) mode: String,
    pub(crate) command_attempted: String,
    pub(crate) stdout_preview: String,
    pub(crate) stderr_preview: String,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentWorkspace {
    pub(crate) workspace_name: String,
    pub(crate) workspace_path: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnostics {
    pub(crate) execution_mode: String,
    pub(crate) workspace_path: String,
    pub(crate) ffhn_resolution: String,
    pub(crate) htmlcut_resolution: String,
    pub(crate) notes: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleDependencySpec {
    pub(crate) repo: String,
    #[serde(rename = "ref")]
    pub(crate) git_ref: String,
    pub(crate) version_label: String,
    pub(crate) binary_basename: String,
    pub(crate) status: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleManifestDesktopProduct {
    pub(crate) name: String,
    pub(crate) version: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleExecutionPosture {
    pub(crate) current: String,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleManifestDependencies {
    pub(crate) ffhn: BundleDependencySpec,
    pub(crate) htmlcut: BundleDependencySpec,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleManifest {
    pub(crate) schema_version: u64,
    pub(crate) desktop_product: BundleManifestDesktopProduct,
    pub(crate) runtime_contract: String,
    pub(crate) execution_posture: BundleExecutionPosture,
    pub(crate) dependencies: BundleManifestDependencies,
    pub(crate) supported_target_triples: Vec<String>,
    pub(crate) notes: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleInputStatus {
    pub(crate) path: String,
    pub(crate) present: bool,
    pub(crate) executable: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleHydrationStatus {
    pub(crate) current: String,
    pub(crate) note: String,
    pub(crate) ffhn: BundleInputStatus,
    pub(crate) htmlcut: BundleInputStatus,
    pub(crate) supported_target_triples: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExpectedArtifacts {
    pub(crate) ffhn: Vec<String>,
    pub(crate) htmlcut: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SupportedPlatformSource {
    pub(crate) target_triple: String,
    pub(crate) status: String,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpstreamIntakeSource {
    pub(crate) schema_version: u64,
    pub(crate) current: String,
    pub(crate) first_supported_platform: SupportedPlatformSource,
    pub(crate) expected_artifacts: ExpectedArtifacts,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RealBinaryActivationSource {
    pub(crate) schema_version: u64,
    pub(crate) current: String,
    pub(crate) first_supported_platform: SupportedPlatformSource,
    pub(crate) activation_receipt_present: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackagedExecutionProofSource {
    pub(crate) schema_version: u64,
    pub(crate) current: String,
    pub(crate) first_supported_platform: SupportedPlatformSource,
    pub(crate) packaged_receipt_present: bool,
    pub(crate) runtime_envelope_compatibility_checked: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReleaseReadinessSource {
    pub(crate) schema_version: u64,
    pub(crate) current: String,
    pub(crate) first_supported_platform: SupportedPlatformSource,
    pub(crate) blocking_gates: Vec<String>,
    pub(crate) release_receipt_present: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackagingSource {
    pub(crate) schema_version: u64,
    pub(crate) current: String,
    pub(crate) macos_target: String,
    pub(crate) local_output_directory: String,
    pub(crate) bundles: Vec<String>,
    pub(crate) github_workflow: String,
    pub(crate) github_runner: String,
    pub(crate) signing: String,
    pub(crate) notarization: String,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectStatus {
    pub(crate) runtime_contract: String,
    pub(crate) supported_platform: SupportedPlatformSummary,
    pub(crate) sidecar_intake: SidecarIntakeSummary,
    pub(crate) packaged_execution: PackagedExecutionSummary,
    pub(crate) packaging: PackagingSummary,
    pub(crate) release: ReleaseSummary,
    pub(crate) priorities: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SupportedPlatformSummary {
    pub(crate) target_triple: String,
    pub(crate) status: String,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SidecarIntakeSummary {
    pub(crate) current: String,
    pub(crate) target_triple: String,
    pub(crate) status: String,
    pub(crate) expected_ffhn_artifacts: Vec<String>,
    pub(crate) expected_htmlcut_artifacts: Vec<String>,
    pub(crate) activation_receipt_present: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackagedExecutionSummary {
    pub(crate) current: String,
    pub(crate) target_triple: String,
    pub(crate) status: String,
    pub(crate) packaged_receipt_present: bool,
    pub(crate) runtime_envelope_compatibility_checked: bool,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PackagingSummary {
    pub(crate) current: String,
    pub(crate) local_output_directory: String,
    pub(crate) bundles: Vec<String>,
    pub(crate) github_workflow: String,
    pub(crate) github_runner: String,
    pub(crate) signing: String,
    pub(crate) notarization: String,
    pub(crate) note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReleaseSummary {
    pub(crate) current: String,
    pub(crate) target_triple: String,
    pub(crate) status: String,
    pub(crate) blocking_gates: Vec<String>,
    pub(crate) release_receipt_present: bool,
    pub(crate) note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FixtureEnvelope {
    pub(crate) ok: bool,
    pub(crate) note: Option<String>,
    pub(crate) error: Option<String>,
    pub(crate) runs: Option<Vec<FixtureRun>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FixtureRun {
    pub(crate) run_id: String,
    pub(crate) target_id: String,
    pub(crate) status: String,
    pub(crate) summary: String,
    pub(crate) started_at: String,
    pub(crate) finished_at: Option<String>,
    pub(crate) command: String,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
    pub(crate) note: String,
    pub(crate) extracted_text: String,
    pub(crate) mode: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PersistedAppState {
    pub(crate) schema_version: u64,
    pub(crate) last_opened_workspace_path: String,
    pub(crate) recent_workspaces: Vec<RecentWorkspace>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceMetadata {
    pub(crate) workspace_name: Option<String>,
}