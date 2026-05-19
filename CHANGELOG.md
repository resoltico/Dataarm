# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-05-19

### Added

- Added per-watch behavior settings for schedules, alert rules, delivery mode, folders, and paused state, plus automatic scheduled checks while Dataarm stays open.
- Added next-check calculations, paused and alert-focused views, folder grouping, and richer watch search so the main dashboard surfaces what needs attention and what runs next.

### Changed

- Upgraded the embedded runtime line to `ffhn-core v8.1.0` so Dataarm consumes the released upstream HTMLCut execution-stack fixes instead of the retired `8.0.0` line.
- Expanded the Rust dependency-license policy for the new HTMLCut selector crate that ships inside the `ffhn-core v8.1.0` runtime line.
- Shifted the first-run desktop surface further toward watch-and-library language, moved library-folder switching and local file creation behind advanced controls, and replaced leftover “baseline” and “artifact” copy with user-facing history and saved-reference wording.
- Reframed the main workbench around watches, pages, latest values, last checks, next checks, alerts, and history so the primary surfaces read like a website-monitoring product instead of an internal inventory console.

### Fixed

- Corrected version syncing so release-time `sync:app-version` now preserves the repository Prettier contract instead of generating a formatter drift in the frontend version module.
- Reworked draft watch setup outcomes so unreachable pages and broken selectors now surface repair guidance in the main flow and cannot be saved until a section check succeeds.
- Fixed the visual section picker so clicking the loaded page preview now chooses the intended section reliably instead of leaving the selector stuck on the default scope.

## [0.3.0] - 2026-05-19

### Fixed

- Corrected macOS packaging so the public app bundle now executes the desktop `dataarm` binary, and added a macOS ship-surface proof lane that validates the built DMG before release publication.
- Upgraded direct-download macOS packaging from fully unsigned to ad-hoc signed, and tightened release verification so bundle executable identity and first-launch guidance are checked from the built DMG and generated release notes instead of inferred from artifact names alone.
- Replaced the silent browser fallback with an explicit browser-only workbench mode, shared fixture assets, and a required offline backend release-validation lane in the Rust quality gate.
- Replaced the browser-bundled mock target interpreter with a Rust-backed browser workbench bridge, so Vite and Playwright exercise the backend-owned target contract instead of a second handwritten contract implementation.
- Tightened the desktop workbench vocabulary around target status, source kind, and run outcomes so the React surface uses one typed owner for labels, tones, and filter behavior.
- Aligned the GitHub `quality` workflow with the maintained browser-workbench proof lane so CI now runs the same unit coverage, Playwright evidence, and frontend coverage verification contract as local `quality:all`.
- Corrected the desktop Miri contract so the pinned seam test proves Dataarm-owned target persistence round-tripping instead of reporting a narrower read-only path.
- Removed cached Prettier checking from the release-grade Node gate so local verification and GitHub Actions prove the same formatting contract.
- Stopped background workspace hydrations from clearing the watch-root input field, so a late refresh can no longer erase a path while the operator is preparing a new workspace.
- Pre-primed the browser workbench demo workspace once per server boot, switched fresh sessions to cloned fixture state, and prebuilt the Rust browser-workbench bridge before Playwright boot, so release CI no longer times out while rebuilding the same demo artifacts and native bridge during cold browser startup.

### Changed

- Split the target editor, detail panel, and dashboard/unit test seams into workflow-owned modules so guided authoring, artifact inspection, release validation, and hook behavior no longer live in oversized mixed-responsibility files.
- The browser-workbench wrapper scripts now resolve local CLIs directly, and the Playwright wrapper forwards CLI arguments, so targeted local reruns use the same managed environment instead of forcing full-suite debugging.

## [0.2.0] - 2026-05-18

### Added

- Guided target authoring for HTTP and file watches, with backend-owned draft sessions instead of raw-TOML-first creation.
- Preview inspection workbench tabs for rendered fragments, compare payloads, and extraction records sourced from canonical runtime artifacts.
- Inventory search and grouping controls for the target table.
- A repeatable backend release-validation run for guided targets, local fixture servers, and optional live-web publication checks.

### Changed

- Draft preview now offers a direct save action, so operators can validate and persist a target without leaving the inspection flow.
- Draft preview now materializes disposable snapshot artifacts for the inspection workbench, so rendered, compare, and extraction tabs are backed by the real runtime contract even though `ffhn-core` dry-run is non-persisting.
- Guided `nth` selection is now called out as a 1-based contract in the editor and extraction workbench.
- Workspace run counts and batch execution now derive from truly runnable target identities instead of treating every displayable `target_id` as executable.
- Browser and unit test coverage now exercises the guided authoring flow rather than the retired raw-editor-first path.

## [0.1.0] - 2026-05-18

### Added

- Initial release.
