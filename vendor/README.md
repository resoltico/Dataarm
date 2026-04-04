# Vendor data

This directory stores machine-readable repository data.
It is not a dump for arbitrary third-party material.

## Current groups

- `bundle-manifest.json`, `dmg-packaging.json`, `quality-gates.json`, and `tooling-refresh.json` define active project policy and packaging posture
- `upstream-intake.json`, `real-binary-activation.json`, `packaged-execution-proof.json`, and `release-readiness.json` define the active project-status model consumed by the app
- `upstream/` holds provenance notes and intake evidence, not Tauri bundle inputs
- `checksums/` stores only live receipts and checksum manifests consumed by the current tooling and project-status model

## Rules

- do not put generated build outputs here
- add structured data here only when the app or maintenance tooling reads it
- remove retired metadata layers instead of piling new ones on top
