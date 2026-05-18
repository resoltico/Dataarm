# Scripts

All scripts in this directory are invoked through `package.json`. Use `npm run <command>` as the entry point.

## Catalogue

### Verification

| Command                               | Script                            | Purpose                                                                                                                                                                               |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run sync:app-version`            | `sync-app-version.mjs`            | Synchronizes all version consumers from `vendor/app-version.json`.                                                                                                                    |
| `npm run verify:app-version`          | `verify-app-version.mjs`          | Confirms `package.json`, `package-lock.json`, Tauri manifests, and frontend version helpers match the version contract.                                                               |
| `npm run verify:quality-gates`        | `verify-quality-gates.mjs`        | Confirms the maintained quality lanes, package scripts, and vendor policy file agree.                                                                                                 |
| `npm run verify:runtime-dependencies` | `verify-runtime-dependencies.mjs` | Confirms the embedded `ffhn-core` intake contract, desktop-owned Miri seam, and no-downstream-patch posture agree.                                                                    |
| `npm run verify:tooling-refresh`      | `verify-tooling-refresh.mjs`      | Confirms the `mise` Node pin, package manager pin, dependency versions, workflow Node pins, and the single-source Cargo artifact-root posture agree.                                  |
| `npm run verify:project-status`       | `verify-project-status.mjs`       | Confirms the maintained file surface is present and retired sidecar-era scaffolding is absent.                                                                                        |
| `npm run verify:dmg-packaging`        | `verify-dmg-packaging.mjs`        | Validates the local DMG packaging contract against `tauri.conf.json`, `Cargo.toml`, and `vendor/dmg-packaging.json`.                                                                  |
| `npm run verify:github-packaging`     | `verify-github-packaging.mjs`     | Validates the GitHub packaging workflow against the maintained packaging posture.                                                                                                     |
| `npm run verify:github-release`       | `verify-github-release.mjs`       | Verifies that the published GitHub release object exists, is no longer draft/prerelease, and exposes the maintained public asset inventory by reusing the authenticated `gh` session. |
| `npm run verify:release-publishing`   | `verify-release-publishing.mjs`   | Validates the tag-driven GitHub release workflow, release asset inventory, publication contract, and current-version changelog release notes.                                         |
| `npm run hygiene:verify`              | `verify-hygiene.mjs`              | Fails if managed artifact policy drifted.                                                                                                                                             |

### Quality Wrappers

| Command                             | Script                                                                                           | Purpose                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run quality:miri`              | `run-miri.mjs`                                                                                   | Runs the pinned nightly Miri lane against the desktop-owned save/read seam with the required Tauri isolation override.                            |
| `npm run quality:browser-workbench` | `run-vitest-browser-workbench.mjs` + `run-playwright-tests.mjs` + `verify-frontend-coverage.mjs` | Runs the self-sufficient browser workbench proof lane: unit coverage, Playwright evidence, and final frontend-coverage verification.              |
| `npm run test:unit`                 | `run-vitest-browser-workbench.mjs`                                                               | Runs the maintained frontend unit and component lane with the explicit browser-workbench backend contract enabled.                                |
| `npm run test:e2e`                  | `run-playwright-tests.mjs`                                                                       | Runs the maintained Playwright lane with a clean color environment, browser-coverage instrumentation, and the explicit browser-workbench backend. |
| `npm run dev`                       | `run-vite-browser-workbench.mjs`                                                                 | Starts the maintained browser workbench dev loop with the explicit browser-workbench backend contract enabled.                                    |

### Hygiene

| Command                             | Script               | Purpose                                                                                    |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `npm run hygiene:report`            | `report-hygiene.mjs` | Prints the current artifact hygiene report.                                                |
| `npm run hygiene:clean:safe`        | `clean-hygiene.mjs`  | Removes disposable build, packaging, Playwright, and temporary output.                     |
| `npm run hygiene:clean:rebuildable` | `clean-hygiene.mjs`  | Performs safe cleanup plus removes managed Cargo output, build cache, and `node_modules/`. |

### Packaging

| Command                                          | Script                                   | Purpose                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run package:adhoc-signed:dmg:macos-silicon` | `collect-github-packaging-artifacts.mjs` | After a successful DMG build, verifies the app bundle carries the maintained legal files, confirms the mounted bundle executable identity and ad-hoc signature, launches the mounted desktop binary through the native smoke path, and writes the GitHub packaging manifest into the managed CI artifact root. |
| n/a                                              | `build-release-checksums.mjs`            | Builds the versioned release-manifest copy and SHA-256 manifest consumed by the GitHub release flow.                                                                                                                                                                                                           |
| n/a                                              | `publish-github-release.mjs`             | Creates or reuses the draft GitHub release for a tag, uploads the maintained assets, and publishes it.                                                                                                                                                                                                         |

## Naming Rules

- `verify-*.mjs` are read-only contract checks.
- `sync-*.mjs` rewrite generated or duplicated consumers from one maintained source contract.
- `run-*.mjs` wrap maintained test or analysis lanes.
- `report-*.mjs` print maintained subsystem state.
- `clean-*.mjs` remove disposable or rebuildable state.
- `collect-*.mjs` record post-build artifact metadata.

Retired script families for sidecar intake, checksum recording, bundle hydration, and release-side activation do not belong in the embedded-runtime repository surface.
