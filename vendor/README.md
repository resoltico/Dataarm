# Vendor Data

This directory stores maintained machine-readable project policy.

## Current Files

- `app-version.json` — canonical desktop product version contract
- `dmg-packaging.json` — local and GitHub packaging posture for the ad-hoc signed but unnotarized Apple Silicon DMG
- `quality-gates.json` — maintained quality-lane contract
- `release-publishing.json` — tag-driven GitHub release workflow, asset inventory, and publication posture
- `runtime-dependencies.json` — embedded `ffhn-core` intake posture, Miri seam ownership, and downstream-override policy
- `tooling-refresh.json` — pinned toolchain and dependency posture
- `workbench-fixtures/` — shared browser-workbench and demo-watch-root fixture assets used by both the desktop backend and the browser workbench seam

## Rules

- do not store build output here
- do not reintroduce upstream binary intake metadata here
- add structured data only when scripts or quality gates read it
- remove retired policy layers instead of stacking replacements beside them
