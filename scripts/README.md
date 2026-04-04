# Scripts

All scripts in this directory are invoked through `package.json` commands.
Do not call scripts directly unless debugging a single step — always use `npm run <command>` as the entry point.

---

## Script Catalogue

### Sidecar Management

| Command                                        | Script                                     | Purpose                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run sync-sidecars`                        | `sync-local-sidecars.mjs`                  | Copies standalone sibling builds from `../ffhn/dist` and `../HTMLCut/dist` into `src-tauri/binaries/` with the correct target-triple suffix. Standard developer path for wiring real binaries locally.                 |
| `npm run record:release-sidecar-checksums`     | `record-release-sidecar-checksums.mjs`     | Downloads the published `.sha256` assets for the pinned upstream releases in `vendor/bundle-manifest.json` and rewrites `vendor/checksums/expected-upstream-release-checksums.json` with the exact expected hashes.    |
| `npm run fetch:release-sidecars`               | `fetch-release-sidecars.mjs`               | Downloads the pinned upstream release sidecars declared in `vendor/bundle-manifest.json`, verifies both the published `.sha256` asset and the locally computed hash, and hydrates `src-tauri/binaries/` for packaging. |
| `npm run prepare:real-sidecars`                | `prepare-real-sidecars.mjs`                | Prints the expected sidecar paths and bundle contract. Use to inspect what the desktop expects before syncing.                                                                                                         |
| `npm run prepare:first-platform-real-binaries` | `prepare-first-platform-real-binaries.mjs` | Scaffolding helper for the initial intake of platform binaries into the vendor intake slot.                                                                                                                            |

### Verification — Run individually or as part of quality gates

| Command                                   | Script                                | Purpose                                                                                                                        |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify:bundle-manifest`          | `verify-bundle-manifest.mjs`          | Validates `vendor/bundle-manifest.json` schema, repo refs, and version labels.                                                 |
| `npm run verify:upstream-intake`          | `verify-upstream-intake.mjs`          | Checks the current upstream sidecar intake slot under `vendor/`.                                                               |
| `npm run verify:hydrated-bundle`          | `verify-hydrated-bundle.mjs`          | Confirms sidecar binaries in `src-tauri/binaries/` are present and executable. Run this before packaging.                      |
| `npm run verify:real-binary-activation`   | `verify-real-binary-activation.mjs`   | Confirms the activation receipt file exists for the intake slot.                                                               |
| `npm run verify:packaged-execution-proof` | `verify-packaged-execution-proof.mjs` | Confirms a packaging execution proof artifact exists from a prior build.                                                       |
| `npm run verify:release-readiness`        | `verify-release-readiness.mjs`        | Aggregate pre-release check: manifest, intake, hydration, activation, and execution proof.                                     |
| `npm run verify:project-status`           | `verify-project-status.mjs`           | Checks overall project posture: supported platform, sidecar intake state, and runtime contract. Run by `quality:node`.         |
| `npm run verify:quality-gates`            | `verify-quality-gates.mjs`            | Meta-verifier confirming all `verify:*` scripts are registered in `package.json` and documented. Run by `quality:node`.        |
| `npm run verify:tooling-refresh`          | `verify-tooling-refresh.mjs`          | Confirms Node, npm, and key devDependency versions match `package.json#engines` constraints. Run by `quality:node`.            |
| `npm run verify:dmg-packaging`            | `verify-dmg-packaging.mjs`            | Validates `vendor/dmg-packaging.json` is internally consistent and matches the GitHub Actions workflow. Run by `quality:node`. |
| `npm run verify:github-packaging`         | `verify-github-packaging.mjs`         | Validates the GitHub Actions packaging workflow matches expected config. Run by `quality:node`.                                |

### Packaging & Artifacts

| Command                                            | Script                                   | Purpose                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| _(called by `package:unsigned:dmg:macos-silicon`)_ | `collect-github-packaging-artifacts.mjs` | Collects DMG output and writes `github-packaging-manifest.json` to `src-tauri/target/ci-artifacts/` after a successful Tauri build. |

---

## Naming Convention

Scripts must be named for the responsibility they verify or automate, not for scaffolding or temporary intent.

- `verify-*.mjs` — Read-only validators. They check state and exit non-zero if invariants are violated.
- `prepare-*.mjs` — Mutating helpers that set up state the app or packaging process depends on.
- `record-*.mjs` — Receipt writers. They pull authoritative upstream state into committed local manifests or checksum maps.
- `sync-*.mjs` — Binary / artifact synchronisation between external repositories and this one.
- `collect-*.mjs` — Post-build artifact collection and manifest writing.
