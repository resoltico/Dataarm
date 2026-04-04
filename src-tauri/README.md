# src-tauri

This is the native Tauri package for the desktop app.
`src-tauri` is the conventional directory name used by Tauri for the Rust side of a split web-plus-native project.

## Contents

- `Cargo.toml` and `Cargo.lock` — Rust package manifest and lockfile
- `src/` — native entrypoint and Rust command layer
- `tauri.conf.json` — app and bundling configuration
- `build.rs` — Rust build hook
- `capabilities/` and `icons/` — Tauri-native assets
- `binaries/` — sidecar bundle inputs

## Generated output

- `gen/` — generated schema output
- `target/` — Cargo and Tauri build output, including local `.app` and `.dmg` artifacts

Keep generated output disposable and keep source-of-truth project docs outside this directory unless they are specifically native-side concerns.
