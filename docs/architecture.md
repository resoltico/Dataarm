# Architecture

## Runtime Contract

Dataarm is an embedded operator client, not a second extraction engine.
The runtime call graph is:

```text
React UI  ->  Tauri commands  ->  ffhn-core  ->  htmlcut-core
```

The desktop owns:

- operator flow
- workspace selection
- local shell integration
- packaging
- presentation of canonical runtime artifacts

The desktop does not own:

- target parsing rules
- extraction rules
- baseline calculation
- run orchestration semantics
- HTMLCut-specific engine behavior

The embedded runtime line is now the released `ffhn-core v8.1.0` contract with no downstream selector-stack override. [vendor/runtime-dependencies.json](../vendor/runtime-dependencies.json) is the canonical machine-readable record of that intake policy.

## Source Layout

### Frontend

`src/` holds the React workbench:

- `App.tsx` wires the application shell together
- `hooks/useDashboardState.ts` owns frontend state, async actions, and Tauri API calls
- `hooks/dashboardState.helpers.ts`, `hooks/dashboardState.editor.ts`, and `hooks/dashboardState.workspace.ts` hold the hook’s state math and workflow slices instead of burying them in one file
- `components/layout/` renders the shell, workspace rail, and main dashboard panes
- `components/dashboard/TargetTable.tsx` is the canonical desktop target inventory surface
- `components/dashboard/DetailPanel.tsx` composes detail-panel workflows, while `components/dashboard/detailPanel/` owns snapshot workbench, change-history, and artifact-tab internals
- `components/dashboard/TargetEditor.tsx` composes guided authoring and repair mode, while `components/dashboard/targetEditor/` owns the guided form and raw repair editor
- `lib/api.ts` is the canonical frontend-to-backend contract surface
- `lib/browserWorkbenchClient.ts` is the browser-workbench entrypoint for Vite and Playwright
- `lib/workbenchContract.ts` is the typed owner for target-workbench vocabulary such as status kinds, source kinds, and run-outcome labels
- `lib/presentation.ts` holds pure formatting and presentation helpers

Frontend components are presentation-only. They do not invoke Tauri directly.

### Native Backend

`src-tauri/src/` holds the native desktop layer:

- `main.rs` wires the Tauri application and registers commands
- `commands.rs` is a thin IPC surface
- `models.rs` defines serialized data contracts returned to the frontend
- `logic/workspace.rs` owns workspace discovery, recent workspace persistence, and demo watch-root materialization
- `logic/targets.rs` owns target reading, preview, save, delete, and run operations through `ffhn-core`
- `logic/targets/drafts.rs` owns guided-session reconstruction and canonical contract reserialization
- `logic/targets/storage.rs` owns target-document materialization and runtime-artifact reset helpers
- `logic/runtime_artifacts.rs` owns typed loading of canonical runtime snapshot artifacts for history and diff browsing
- `logic/notifications/` owns notification policy, delivery history, and native system-delivery attempts
- `logic/workspace/` owns workspace discovery, recent-workspace persistence, and demo watch-root materialization
- `logic/os.rs` owns native path-opening helpers

The command layer routes requests. The `logic/` modules own the behavior.

## State Ownership

The watch root on disk is the authoritative source of truth.

For each target directory, the desktop treats these files as canonical:

- `target.toml`
- `state.json`
- `last_run.json`
- `snapshots/`

The backend derives UI-facing summaries from those files plus the canonical `ffhn-core` status and run reports. The frontend caches the returned snapshot, but it does not become a second source of truth.

Inventory summaries intentionally distinguish between a displayable target identifier and a truly runnable target identity. Workspace runnable counts and batch execution derive from the runnable identity only, so a directory can still surface useful operator context without being overpromoted into the executable set.

Guided authoring is an operator-facing projection over that canonical target contract, not a second persistence model. The backend owns the draft-session shape returned to the frontend, serializes it back into canonical `target.toml`, and falls back to raw repair mode only when the durable target document can no longer be projected honestly.

Preview inspection uses the same canonical runtime contract. `ffhn-core` dry-run remains non-persisting, so Dataarm materializes one disposable run inside a temporary preview workspace whenever the operator asks to inspect rendered output, compare payloads, or extraction metadata before saving.

The desktop also owns one explicit runtime-artifact adapter over those canonical files. Target detail loading reads `state.json`, `last_run.json`, and retained snapshot artifacts into one typed desktop contract instead of letting multiple frontend surfaces infer raw filesystem structure independently.

The backend also owns the active workspace boundary. The frontend may request a workspace switch, but target reads, saves, runs, deletes, and path-opening actions execute against the backend-managed current workspace rather than trusting raw watch-root paths from the WebView.

Important notifications are also backend-owned. The desktop persists one notification policy and one recent alert history under app-local desktop state, then derives delivery decisions from authoritative run outcomes instead of letting the frontend guess what is noteworthy.

Saving a target is intentionally destructive to stale runtime artifacts. After a successful save, the backend removes:

- `state.json`
- `last_run.json`
- `snapshots/`

That reset keeps the next execution aligned with the edited target definition.

## Demo And Browser Workbench Paths

The repository supports two low-friction development paths:

- Tauri demo workspace: `workspace.rs` materializes a local demo watch root under app data and drives the real native backend.
- Browser workbench bridge: `src/lib/browserWorkbenchClient.ts`, `scripts/browser-workbench/vite-plugin.mjs`, `scripts/browser-workbench/rust-bridge.mjs`, and `src-tauri/examples/browser_workbench_bridge.rs` let Vite and Playwright exercise the workbench through backend-owned logic without a native host.

These paths exist to accelerate UI work. They do not replace the embedded runtime contract.

## Upstream Runtime Intake

`src-tauri/Cargo.toml` is the canonical code owner for the embedded `ffhn-core` dependency declaration. [vendor/runtime-dependencies.json](../vendor/runtime-dependencies.json) is the machine-readable policy owner for:

- which released `ffhn-core` line the desktop currently embeds
- the desktop-owned Miri seam
- whether the current embedded runtime line allows any downstream dependency overrides

That split keeps dependency declaration and dependency policy separate without duplicating either one in prose-only docs.

## Packaging Boundary

The desktop ships one native application bundle. There is no sidecar intake, no bundled `ffhn` binary, and no bundled `htmlcut` binary.

`src-tauri/tauri.conf.json` is the native packaging contract:

- managed frontend output comes from `../.dataarm-artifacts/dist`
- the main window label is explicitly `main`
- production and development CSP policies are declared
- Apple Silicon macOS packaging targets are `app` and `dmg`

## Version Contract

[vendor/app-version.json](../vendor/app-version.json) is the canonical product-version source for Dataarm.

Derived consumers must stay synchronized through:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/lib/appVersion.ts`

Maintainers change the version in one place, run `npm run sync:app-version`, and let `npm run verify:app-version` prove the surface stayed aligned.

## Managed Artifacts

Heavy rebuildable output lives under:

```text
../.dataarm-artifacts/
```

Key managed roots:

- `target/`
- `build/`
- `dist/`
- `playwright-report/`
- `test-results/`
- `ci-artifacts/`

Repo-local `src-tauri/target/`, `dist/`, `playwright-report/`, and `test-results/` count as hygiene violations when populated.

## Security Boundary

The WebView is untrusted input. The backend validates and normalizes target data in Rust before it becomes durable state or a real run request.

The repository hardens the Tauri boundary with:

- explicit capabilities
- no shell plugin
- native notifications routed through the backend rather than direct frontend plugin access
- no `externalBin` bundle inputs
- explicit CSP in development and production
- a narrow command surface that speaks in typed workspace and target records
- backend-owned current-workspace state for target mutation and execution commands
- target-path opening commands scoped to the active workspace instead of arbitrary filesystem paths
