use crate::models::*;
use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};


/// Resolves the repository root from the nested Tauri package.
fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// Returns the committed sample workspace used by default.
fn default_workspace_path() -> PathBuf {
    repo_root().join("examples").join("workspace-sample")
}

/// Resolves either an explicit workspace path or the committed sample workspace.
fn resolve_workspace_path(input: Option<String>) -> PathBuf {
    match input {
        Some(path) => PathBuf::from(path),
        None => default_workspace_path(),
    }
}

/// Reads a JSON file into a strongly typed payload.
fn read_json_file<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Writes a string payload, creating parent directories when needed.
fn write_string(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(path, content);
}

/// Invokes the OS native explorer for a given path.
pub(crate) fn open_path_logic(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Native path opening is only supported on macOS in this version.".into())
    }
}

fn workspace_name_from_path(workspace: &Path) -> String {
    read_json_file::<WorkspaceMetadata>(&workspace.join("workspace.json"))
        .and_then(|meta| meta.workspace_name)
        .or_else(|| {
            workspace
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "Workspace".into())
}

fn app_state_path(workspace: &Path) -> PathBuf {
    workspace.join(".ffhn-desktop").join("app-state.json")
}

fn load_persisted_app_state(workspace: &Path) -> Option<PersistedAppState> {
    read_json_file(&app_state_path(workspace))
}

fn persist_app_state(workspace: &Path, recents: &[RecentWorkspace]) {
    let payload = PersistedAppState {
        schema_version: 1,
        last_opened_workspace_path: workspace.display().to_string(),
        recent_workspaces: recents.to_vec(),
    };
    write_string(
        &app_state_path(workspace),
        &serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".into()),
    );
}

/// Ensures the minimum workspace structure expected by the desktop wrapper exists.
fn ensure_workspace_layout(workspace: &Path) {
    for relative in ["targets", "runs", "run-results", ".ffhn-desktop"] {
        let _ = fs::create_dir_all(workspace.join(relative));
    }

    let metadata_path = workspace.join("workspace.json");
    if !metadata_path.exists() {
        let payload = serde_json::json!({
            "workspaceName": workspace_name_from_path(workspace),
            "workspacePath": workspace.display().to_string(),
            "createdAt": "created-by-ffhn-desktop",
            "note": "Workspace metadata created by FFHN Desktop."
        });
        write_string(
            &metadata_path,
            &serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".into()),
        );
    }
}

fn load_targets_from_workspace(workspace: &Path) -> Vec<TargetRecord> {
    let dir = workspace.join("targets");
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(record) = read_json_file::<TargetRecord>(&entry.path()) {
                out.push(record);
            }
        }
    }

    if out.is_empty() && workspace == default_workspace_path() {
        return seed_targets();
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

pub(crate) fn create_target_logic(
    target: TargetRecord,
    workspace_path: Option<String>,
) -> Result<(), String> {
    let workspace = resolve_workspace_path(workspace_path);
    let target_path = workspace
        .join("targets")
        .join(format!("{}.json", target.id));
    
    let payload = serde_json::to_string_pretty(&target)
        .map_err(|e| format!("Failed to serialize target: {}", e))?;
    
    write_string(&target_path, &payload);
    Ok(())
}

pub(crate) fn delete_target_logic(
    target_id: String,
    workspace_path: Option<String>,
) -> Result<(), String> {
    let workspace = resolve_workspace_path(workspace_path);
    let target_path = workspace
        .join("targets")
        .join(format!("{}.json", target_id));
    
    if target_path.exists() {
        fs::remove_file(target_path).map_err(|e| format!("Failed to delete target file: {}", e))?;
    }
    
    Ok(())
}

pub(crate) fn duplicate_target_logic(
    target_id: String,
    workspace_path: Option<String>,
) -> Result<TargetRecord, String> {
    let workspace = resolve_workspace_path(workspace_path.clone());
    let source_path = workspace
        .join("targets")
        .join(format!("{}.json", target_id));
    
    let mut target = read_json_file::<TargetRecord>(&source_path)
        .ok_or_else(|| format!("Target {} not found for duplication.", target_id))?;
    
    target.id = format!("{}-copy-{}", target.id, now_millis() % 1000);
    target.name = format!("{} (copy)", target.name);
    target.last_run_at = None;
    target.status = "pending".into();
    
    create_target_logic(target.clone(), workspace_path)?;
    Ok(target)
}

pub(crate) fn toggle_target_logic(
    target_id: String,
    workspace_path: Option<String>,
) -> Result<TargetRecord, String> {
    let workspace = resolve_workspace_path(workspace_path.clone());
    let source_path = workspace
        .join("targets")
        .join(format!("{}.json", target_id));
    
    let mut target = read_json_file::<TargetRecord>(&source_path)
        .ok_or_else(|| format!("Target {} not found to toggle.", target_id))?;
    
    target.enabled = !target.enabled;
    
    create_target_logic(target.clone(), workspace_path)?;
    Ok(target)
}

fn load_runs_from_workspace(workspace: &Path) -> Vec<RunRecord> {
    let mut out = Vec::new();

    if let Ok(entries) = fs::read_dir(workspace.join("runs")) {
        for entry in entries.flatten() {
            if let Some(record) = read_json_file::<RunRecord>(&entry.path()) {
                out.push(record);
            }
        }
    }

    if let Ok(entries) = fs::read_dir(workspace.join("run-results")) {
        for entry in entries.flatten() {
            if let Some(value) = read_json_file::<Value>(&entry.path()) {
                if let Some(run_value) = value.get("run") {
                    if let Ok(run) = serde_json::from_value::<FixtureRun>(run_value.clone()) {
                        out.push(RunRecord {
                            id: run.run_id,
                            target_id: run.target_id,
                            status: run.status,
                            started_at: run.started_at,
                            finished_at: run.finished_at,
                            summary: run.summary,
                            mode: run.mode,
                        });
                    }
                }
            }
        }
    }

    if out.is_empty() {
        seed_runs()
    } else {
        out.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        out
    }
}

fn load_bundle_manifest() -> Option<BundleManifest> {
    read_json_file(&repo_root().join("vendor").join("bundle-manifest.json"))
}

fn load_upstream_intake_source() -> Option<UpstreamIntakeSource> {
    read_json_file(&repo_root().join("vendor").join("upstream-intake.json"))
}

fn load_real_binary_activation_source() -> Option<RealBinaryActivationSource> {
    read_json_file(
        &repo_root()
            .join("vendor")
            .join("real-binary-activation.json"),
    )
}

fn load_packaged_execution_proof_source() -> Option<PackagedExecutionProofSource> {
    read_json_file(
        &repo_root()
            .join("vendor")
            .join("packaged-execution-proof.json"),
    )
}

fn load_release_readiness_source() -> Option<ReleaseReadinessSource> {
    read_json_file(&repo_root().join("vendor").join("release-readiness.json"))
}

fn load_packaging_source() -> Option<PackagingSource> {
    read_json_file(&repo_root().join("vendor").join("dmg-packaging.json"))
}

fn seed_targets() -> Vec<TargetRecord> {
    vec![
        TargetRecord {
            id: "homepage-price-watch".into(),
            name: "Homepage price watch".into(),
            url: "https://example.com/product/1".into(),
            status: "healthy".into(),
            enabled: true,
            extractor_summary: "css:.price -> text".into(),
            last_run_at: Some("2026-03-29T10:00:00Z".into()),
        },
        TargetRecord {
            id: "homepage-availability".into(),
            name: "Homepage availability".into(),
            url: "https://example.com/product/2".into(),
            status: "attention".into(),
            enabled: true,
            extractor_summary: "css:.availability -> text".into(),
            last_run_at: Some("2026-03-29T09:40:00Z".into()),
        },
    ]
}

fn seed_runs() -> Vec<RunRecord> {
    vec![
        RunRecord {
            id: "run-003".into(),
            target_id: "homepage-price-watch".into(),
            status: "unchanged".into(),
            started_at: "2026-03-29T10:12:00Z".into(),
            finished_at: Some("2026-03-29T10:12:01Z".into()),
            summary: "No change detected.".into(),
            mode: "mock".into(),
        },
        RunRecord {
            id: "run-002".into(),
            target_id: "homepage-availability".into(),
            status: "changed".into(),
            started_at: "2026-03-29T09:40:00Z".into(),
            finished_at: Some("2026-03-29T09:40:03Z".into()),
            summary: "Availability text changed.".into(),
            mode: "mock".into(),
        },
    ]
}

fn fixture_ffhn_path() -> String {
    repo_root()
        .join("src-tauri")
        .join("binaries")
        .join("dev-fixtures")
        .join("ffhn-fixture.py")
        .display()
        .to_string()
}

fn fixture_htmlcut_path() -> String {
    repo_root()
        .join("src-tauri")
        .join("binaries")
        .join("dev-fixtures")
        .join("htmlcut-fixture.py")
        .display()
        .to_string()
}

fn host_target_triple() -> String {
    match (env::consts::ARCH, env::consts::OS) {
        ("x86_64", "linux") => "x86_64-unknown-linux-gnu".into(),
        ("aarch64", "linux") => "aarch64-unknown-linux-gnu".into(),
        ("x86_64", "macos") => "x86_64-apple-darwin".into(),
        ("aarch64", "macos") => "aarch64-apple-darwin".into(),
        ("x86_64", "windows") => "x86_64-pc-windows-msvc".into(),
        (arch, os) => format!("{}-unknown-{}", arch, os),
    }
}

fn bundled_binary_path(name: &str) -> PathBuf {
    let triple = host_target_triple();
    repo_root()
        .join("src-tauri")
        .join("binaries")
        .join(format!("{}-{}", name, triple))
}

/// Returns whether a bundled candidate exists and is executable on the host.
fn candidate_binary_is_executable(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(path) {
            return meta.permissions().mode() & 0o111 != 0;
        }
    }

    #[cfg(not(unix))]
    {
        return true;
    }

    false
}

fn ffhn_path_hint() -> Option<String> {
    env::var("FFHN_DESKTOP_FFHN_BIN")
        .ok()
        .or_else(|| {
            let path = bundled_binary_path("ffhn");
            path.exists().then(|| path.display().to_string())
        })
        .or_else(|| Some("src-tauri/binaries/ffhn-<target-triple>".into()))
}

fn htmlcut_path_hint() -> Option<String> {
    env::var("FFHN_DESKTOP_HTMLCUT_BIN")
        .ok()
        .or_else(|| {
            let path = bundled_binary_path("htmlcut");
            path.exists().then(|| path.display().to_string())
        })
        .or_else(|| Some("src-tauri/binaries/htmlcut-<target-triple>".into()))
}

fn live_ffhn_path() -> Option<PathBuf> {
    env::var("FFHN_DESKTOP_FFHN_BIN")
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| {
            let path = bundled_binary_path("ffhn");
            candidate_binary_is_executable(&path).then_some(path)
        })
}

fn live_htmlcut_path() -> Option<PathBuf> {
    env::var("FFHN_DESKTOP_HTMLCUT_BIN")
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| {
            let path = bundled_binary_path("htmlcut");
            candidate_binary_is_executable(&path).then_some(path)
        })
}

fn runtime_source() -> String {
    let ffhn_override = env::var("FFHN_DESKTOP_FFHN_BIN")
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.exists());
    let htmlcut_override = env::var("FFHN_DESKTOP_HTMLCUT_BIN")
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.exists());

    if ffhn_override.is_some() && htmlcut_override.is_some() {
        return "env-override".into();
    }

    let ffhn_bundled = bundled_binary_path("ffhn");
    let htmlcut_bundled = bundled_binary_path("htmlcut");
    if candidate_binary_is_executable(&ffhn_bundled)
        && candidate_binary_is_executable(&htmlcut_bundled)
    {
        return "bundled-candidate".into();
    }

    if ffhn_path_hint().is_some() && htmlcut_path_hint().is_some() {
        return "path-hint".into();
    }

    "none".into()
}

fn detect_execution_mode() -> String {
    let ffhn_live = live_ffhn_path().is_some();
    let htmlcut_live = live_htmlcut_path().is_some();

    if ffhn_live && htmlcut_live {
        "sidecar-live".into()
    } else if ffhn_path_hint().is_some() && htmlcut_path_hint().is_some() {
        "sidecar-ready".into()
    } else {
        "mock".into()
    }
}

fn get_runtime_readiness_state() -> RuntimeReadinessStatus {
    let ffhn_binary = bundled_binary_path("ffhn");
    let htmlcut_binary = bundled_binary_path("htmlcut");
    let ffhn_ok = candidate_binary_is_executable(&ffhn_binary);
    let htmlcut_ok = candidate_binary_is_executable(&htmlcut_binary);
    let source = runtime_source();
    let current = match (ffhn_ok, htmlcut_ok) {
        (true, true) => "ready",
        (true, false) | (false, true) => "partial",
        (false, false) => "missing",
    };

    RuntimeReadinessStatus {
        host_target_triple: host_target_triple(),
        current: current.into(),
        runtime_source: source.clone(),
        ffhn_binary_path: ffhn_binary
            .exists()
            .then(|| ffhn_binary.display().to_string()),
        htmlcut_binary_path: htmlcut_binary
            .exists()
            .then(|| htmlcut_binary.display().to_string()),
        executable_pair_available: ffhn_ok && htmlcut_ok,
        note: match source.as_str() {
            "env-override" => {
                "Runtime is currently satisfied by explicit environment overrides.".into()
            }
            "bundled-candidate" => {
                "Runtime can use the bundled sidecar pair committed under src-tauri/binaries."
                    .into()
            }
            "path-hint" => {
                "Path hints exist, but the current host does not have an executable bundled pair."
                    .into()
            }
            _ => "No executable FFHN and HTMLCUT pair is available on this host.".into(),
        },
    }
}

fn get_bundle_hydration_state() -> BundleHydrationStatus {
    let ffhn = bundled_binary_path("ffhn");
    let htmlcut = bundled_binary_path("htmlcut");
    let ffhn_present = ffhn.exists();
    let htmlcut_present = htmlcut.exists();
    let ffhn_executable = candidate_binary_is_executable(&ffhn);
    let htmlcut_executable = candidate_binary_is_executable(&htmlcut);

    let current = match (
        ffhn_executable,
        htmlcut_executable,
        ffhn_present,
        htmlcut_present,
    ) {
        (true, true, _, _) => "ready",
        (_, _, true, true) | (_, _, true, false) | (_, _, false, true) => "partial",
        _ => "missing",
    };

    BundleHydrationStatus {
        current: current.into(),
        note: "Shows whether the current host has executable Tauri bundle inputs for FFHN and HTMLCUT."
            .into(),
        ffhn: BundleInputStatus {
            path: ffhn.display().to_string(),
            present: ffhn_present,
            executable: ffhn_executable,
        },
        htmlcut: BundleInputStatus {
            path: htmlcut.display().to_string(),
            present: htmlcut_present,
            executable: htmlcut_executable,
        },
        supported_target_triples: load_bundle_manifest()
            .map(|manifest| manifest.supported_target_triples)
            .unwrap_or_default(),
    }
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn persist_fixture_run(workspace: &Path, run: &FixtureRun) {
    let result_path = workspace
        .join("run-results")
        .join(format!("{}.json", run.run_id));
    let payload = serde_json::json!({
        "schemaVersion": 1,
        "run": run,
    });
    write_string(
        &result_path,
        &serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".into()),
    );
}

fn run_live_ffhn(args: &[&str], workspace: &Path) -> Result<FixtureEnvelope, String> {
    let ffhn =
        live_ffhn_path().ok_or_else(|| "FFHN live binary path is not configured.".to_string())?;
    let htmlcut = live_htmlcut_path()
        .ok_or_else(|| "HTMLCUT live binary path is not configured.".to_string())?;

    let output = Command::new(ffhn)
        .args(args)
        .env("FFHN_HTMLCUT_BIN", &htmlcut)
        .env("FFHN_DESKTOP_HTMLCUT_BIN", &htmlcut)
        .env("FFHN_DESKTOP_MODE", "1")
        .current_dir(workspace)
        .output()
        .map_err(|error| format!("Failed to launch FFHN: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    serde_json::from_slice::<FixtureEnvelope>(&output.stdout)
        .map_err(|error| format!("Failed to parse FFHN output: {error}"))
}

fn build_mock_run(target_id: &str, summary: &str) -> FixtureRun {
    let stamp = now_millis();
    FixtureRun {
        run_id: format!("run-{}-{}", target_id, stamp),
        target_id: target_id.to_string(),
        status: if target_id.ends_with("availability") {
            "changed".into()
        } else {
            "unchanged".into()
        },
        summary: summary.to_string(),
        started_at: format!("synthetic-start-{}", stamp),
        finished_at: Some(format!("synthetic-finish-{}", stamp)),
        command: "ffhn run --target <id> --json (simulated)".into(),
        stdout: format!(
            "{{\n  \"targetId\": \"{}\",\n  \"status\": \"simulated\"\n}}",
            target_id
        ),
        stderr: String::new(),
        note: "Generated by the explicit mock fallback path.".into(),
        extracted_text: format!("fixture-text-for:{}", target_id),
        mode: "mock".into(),
    }
}

fn convert_fixture_run(run: FixtureRun, workspace: &Path) -> RunRecord {
    persist_fixture_run(workspace, &run);
    RunRecord {
        id: run.run_id,
        target_id: run.target_id,
        status: run.status,
        started_at: run.started_at,
        finished_at: run.finished_at,
        summary: run.summary,
        mode: run.mode,
    }
}

fn build_priorities(
    activation: &RealBinaryActivationSource,
    packaged_execution: &PackagedExecutionProofSource,
    release: &ReleaseReadinessSource,
) -> Vec<String> {
    let mut priorities = Vec::new();

    if activation.current != "activated-real-first-platform" {
        priorities.push(
            "Replace fixture-backed sidecars with exact upstream Apple Silicon binaries.".into(),
        );
    }

    if packaged_execution.current != "real-packaged-proof"
        || !packaged_execution.packaged_receipt_present
        || !packaged_execution.runtime_envelope_compatibility_checked
    {
        priorities.push(
            "Capture one packaged FFHN -> HTMLCUT execution proof against the bundled pair.".into(),
        );
    }

    if !release.blocking_gates.is_empty() {
        priorities.push(format!(
            "Resolve the remaining release gates: {}.",
            release.blocking_gates.join(", ")
        ));
    }

    if priorities.is_empty() {
        priorities
            .push("Validate the current Apple Silicon bundle as a real release candidate.".into());
    }

    priorities
}

/// Aggregates the compact project-status model consumed by the frontend.
fn get_project_status_state() -> Result<ProjectStatus, String> {
    let manifest =
        load_bundle_manifest().ok_or_else(|| "Missing vendor/bundle-manifest.json".to_string())?;
    let intake = load_upstream_intake_source()
        .ok_or_else(|| "Missing vendor/upstream-intake.json".to_string())?;
    let activation = load_real_binary_activation_source()
        .ok_or_else(|| "Missing vendor/real-binary-activation.json".to_string())?;
    let packaged_execution = load_packaged_execution_proof_source()
        .ok_or_else(|| "Missing vendor/packaged-execution-proof.json".to_string())?;
    let release = load_release_readiness_source()
        .ok_or_else(|| "Missing vendor/release-readiness.json".to_string())?;
    let packaging =
        load_packaging_source().ok_or_else(|| "Missing vendor/dmg-packaging.json".to_string())?;
    let priorities = build_priorities(&activation, &packaged_execution, &release);

    Ok(ProjectStatus {
        runtime_contract: manifest.runtime_contract,
        supported_platform: SupportedPlatformSummary {
            target_triple: packaging.macos_target,
            status: release.first_supported_platform.status.clone(),
            note: release.first_supported_platform.note.clone(),
        },
        sidecar_intake: SidecarIntakeSummary {
            current: intake.current,
            target_triple: intake.first_supported_platform.target_triple,
            status: intake.first_supported_platform.status,
            expected_ffhn_artifacts: intake.expected_artifacts.ffhn,
            expected_htmlcut_artifacts: intake.expected_artifacts.htmlcut,
            activation_receipt_present: activation.activation_receipt_present,
            note: intake.note,
        },
        packaged_execution: PackagedExecutionSummary {
            current: packaged_execution.current,
            target_triple: packaged_execution.first_supported_platform.target_triple,
            status: packaged_execution.first_supported_platform.status,
            packaged_receipt_present: packaged_execution.packaged_receipt_present,
            runtime_envelope_compatibility_checked: packaged_execution
                .runtime_envelope_compatibility_checked,
            note: packaged_execution.note.clone(),
        },
        packaging: PackagingSummary {
            current: packaging.current,
            local_output_directory: packaging.local_output_directory,
            bundles: packaging.bundles,
            github_workflow: packaging.github_workflow,
            github_runner: packaging.github_runner,
            signing: packaging.signing,
            notarization: packaging.notarization,
            note: packaging.note,
        },
        release: ReleaseSummary {
            current: release.current.clone(),
            target_triple: release.first_supported_platform.target_triple,
            status: release.first_supported_platform.status,
            blocking_gates: release.blocking_gates.clone(),
            release_receipt_present: release.release_receipt_present,
            note: release.note.clone(),
        },
        priorities,
    })
}


/// Returns desktop metadata and the current execution mode.
pub(crate) fn get_app_info_state() -> DesktopAppInfo {
    DesktopAppInfo {
        app_name: "FFHN".into(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        mode: detect_execution_mode(),
    }
}

/// Returns current sidecar resolution facts for the host runtime.
pub(crate) fn get_sidecar_health_state() -> SidecarHealth {
    let mode = detect_execution_mode();
    let source = runtime_source();

    SidecarHealth {
        ffhn_configured: ffhn_path_hint().is_some(),
        htmlcut_configured: htmlcut_path_hint().is_some(),
        ffhn_binary_path_hint: ffhn_path_hint().or_else(|| Some(fixture_ffhn_path())),
        htmlcut_binary_path_hint: htmlcut_path_hint().or_else(|| Some(fixture_htmlcut_path())),
        runtime_source: source.clone(),
        execution_mode: mode.clone(),
        note: match mode.as_str() {
            "sidecar-live" => match source.as_str() {
                "bundled-candidate" => {
                    "The bundled FFHN and HTMLCUT inputs are executable on this host.".into()
                }
                "env-override" => {
                    "Environment overrides currently point to executable sidecar binaries.".into()
                }
                _ => "Live sidecar execution is active.".into(),
            },
            "sidecar-ready" => {
                "Path hints exist, but the current host does not yet have an executable sidecar pair."
                    .into()
            }
            _ => {
                "The app is currently using its mock fallback because no executable sidecar pair is available."
                    .into()
            }
        },
    }
}

/// Runs a one-shot FFHN probe against the current runtime posture.
pub(crate) fn run_ffhn_probe_state() -> Result<ProbeResult, String> {
    let mode = detect_execution_mode();
    if mode == "sidecar-live" {
        let workspace = default_workspace_path();
        let envelope = run_live_ffhn(&["probe"], &workspace)?;
        return Ok(ProbeResult {
            ok: envelope.ok,
            command: format!(
                "{} probe",
                live_ffhn_path()
                    .unwrap_or_else(|| bundled_binary_path("ffhn"))
                    .display()
            ),
            mode,
            note: envelope
                .note
                .unwrap_or_else(|| "FFHN probe completed successfully.".into()),
        });
    }

    Ok(ProbeResult {
        ok: true,
        command: "ffhn probe (simulated)".into(),
        mode,
        note: "The probe is reporting current execution posture honestly; live execution requires an executable FFHN and HTMLCUT pair."
            .into(),
    })
}

/// Opens a workspace and refreshes desktop-local recent-workspace state.
pub(crate) fn open_workspace_logic(
    state: &State<AppState>,
    workspace_path: Option<String>,
) -> WorkspaceSummary {
    let workspace = resolve_workspace_path(workspace_path);
    ensure_workspace_layout(&workspace);

    let workspace_name = workspace_name_from_path(&workspace);
    let workspace_string = workspace.display().to_string();
    let workspace_runs = load_runs_from_workspace(&workspace);
    let workspace_targets = load_targets_from_workspace(&workspace);
    let mut recents = state.recent_workspaces.lock().unwrap();

    if recents.is_empty() {
        if let Some(persisted) = load_persisted_app_state(&workspace) {
            *recents = persisted.recent_workspaces;
        }
    }

    let recent = RecentWorkspace {
        workspace_name: workspace_name.clone(),
        workspace_path: workspace_string.clone(),
    };
    recents.retain(|item| item.workspace_path != recent.workspace_path);
    recents.insert(0, recent);
    if recents.len() > 8 {
        recents.truncate(8);
    }
    persist_app_state(&workspace, &recents);

    let mut state_runs = state.runs.lock().unwrap();
    *state_runs = workspace_runs.clone();

    WorkspaceSummary {
        workspace_name,
        workspace_path: workspace_string,
        target_count: workspace_targets.len(),
        run_count: workspace_runs.len(),
        mode: detect_execution_mode(),
        note: "Workspace summary is backed by workspace files and persisted run-result envelopes."
            .into(),
    }
}

/// Returns persisted run detail when available, otherwise derives a compact fallback view.
pub(crate) fn get_run_detail_logic(
    state: &State<AppState>,
    run_id: String,
    workspace_path: Option<String>,
) -> Result<RunDetail, String> {
    let workspace = resolve_workspace_path(workspace_path);
    let persisted = workspace
        .join("run-results")
        .join(format!("{}.json", run_id));

    if let Some(value) = read_json_file::<Value>(&persisted) {
        if let Some(run_value) = value.get("run") {
            if let Ok(run) = serde_json::from_value::<FixtureRun>(run_value.clone()) {
                return Ok(RunDetail {
                    id: run.run_id,
                    target_id: run.target_id,
                    status: run.status,
                    mode: run.mode,
                    command_attempted: run.command,
                    stdout_preview: run.stdout,
                    stderr_preview: run.stderr,
                    note: run.note,
                });
            }
        }
    }

    let records = load_runs_from_workspace(&workspace);
    let mut state_runs = state.runs.lock().unwrap();
    *state_runs = records.clone();
    let record = records
        .into_iter()
        .find(|item| item.id == run_id)
        .ok_or_else(|| format!("Run {} was not found.", run_id))?;

    Ok(RunDetail {
        id: record.id,
        target_id: record.target_id,
        status: record.status.clone(),
        mode: record.mode.clone(),
        command_attempted: if record.mode == "sidecar-live" {
            "ffhn run --target <id> --json".into()
        } else {
            "ffhn run --target <id> --json (simulated)".into()
        },
        stdout_preview: format!(
            "{{\n  \"status\": \"{}\",\n  \"summary\": \"{}\"\n}}",
            record.status, record.summary
        ),
        stderr_preview: String::new(),
        note: "Run detail fell back to the derived record view because no persisted envelope was found."
            .into(),
    })
}

/// Returns operator-facing diagnostics that explain current behavior.
pub(crate) fn get_workspace_diagnostics_state(workspace_path: Option<String>) -> WorkspaceDiagnostics {
    let workspace = resolve_workspace_path(workspace_path);
    let mode = detect_execution_mode();

    WorkspaceDiagnostics {
        execution_mode: mode.clone(),
        workspace_path: workspace.display().to_string(),
        ffhn_resolution: ffhn_path_hint().unwrap_or_else(fixture_ffhn_path),
        htmlcut_resolution: htmlcut_path_hint().unwrap_or_else(fixture_htmlcut_path),
        notes: vec![
            "Desktop calls FFHN, not HTMLCUT, during normal operation.".into(),
            "Bundled sidecar inputs under src-tauri/binaries take precedence over ambient PATH."
                .into(),
            "Run-detail panels prefer persisted envelopes when they exist.".into(),
            format!(
                "Current execution mode is {} and runtime source is {}.",
                mode,
                runtime_source()
            ),
        ],
    }
}

/// Executes all targets through the live or mock runtime path.
pub(crate) fn run_all_targets_logic(
    state: &State<AppState>,
    workspace_path: Option<String>,
) -> Result<Vec<RunRecord>, String> {
    let workspace = resolve_workspace_path(workspace_path);
    let mode = detect_execution_mode();
    let mut produced = Vec::new();

    if mode == "sidecar-live" {
        let envelope = run_live_ffhn(
            &["run-all", "--workspace", &workspace.display().to_string()],
            &workspace,
        )?;
        if let Some(error) = envelope.error {
            return Err(error);
        }
        for run in envelope.runs.unwrap_or_default() {
            produced.push(convert_fixture_run(run, &workspace));
        }
    } else {
        for target in load_targets_from_workspace(&workspace) {
            let run = build_mock_run(
                &target.id,
                "Synthetic run generated through the explicit mock fallback path.",
            );
            produced.push(convert_fixture_run(run, &workspace));
        }
    }

    produced.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    let mut state_runs = state.runs.lock().unwrap();
    *state_runs = produced.clone();
    Ok(produced)
}

/// Executes a single target through the live or mock runtime path.
pub(crate) fn run_target_logic(
    state: &State<AppState>,
    target_id: String,
    workspace_path: Option<String>,
) -> Result<RunRecord, String> {
    let workspace = resolve_workspace_path(workspace_path);
    let mode = detect_execution_mode();

    let record = if mode == "sidecar-live" {
        let envelope = run_live_ffhn(
            &[
                "run",
                "--target",
                &target_id,
                "--workspace",
                &workspace.display().to_string(),
            ],
            &workspace,
        )?;
        if let Some(error) = envelope.error {
            return Err(error);
        }
        let run = envelope
            .runs
            .unwrap_or_default()
            .into_iter()
            .next()
            .ok_or_else(|| "Live FFHN returned no run records.".to_string())?;
        convert_fixture_run(run, &workspace)
    } else {
        let run = build_mock_run(
            &target_id,
            "Single-target execution used the explicit mock fallback path.",
        );
        convert_fixture_run(run, &workspace)
    };

    let mut runs = state.runs.lock().unwrap();
    runs.insert(0, record.clone());
    Ok(record)
}

/// Returns desktop-local recently opened workspaces.
pub(crate) fn list_recent_workspaces_logic(state: &State<AppState>) -> Vec<RecentWorkspace> {
    let mut recents = state.recent_workspaces.lock().unwrap();
    if recents.is_empty() {
        if let Some(persisted) = load_persisted_app_state(&default_workspace_path()) {
            *recents = persisted.recent_workspaces;
        }
    }

    if recents.is_empty() {
        vec![RecentWorkspace {
            workspace_name: workspace_name_from_path(&default_workspace_path()),
            workspace_path: default_workspace_path().display().to_string(),
        }]
    } else {
        recents.clone()
    }
}

