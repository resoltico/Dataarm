# Binaries

This directory holds the sidecar inputs that Tauri bundles into the desktop application.

---

## File Naming Convention

Tauri requires sidecar binaries to be suffixed with the Rust target triple of the
host machine they are compiled for. The desktop currently supports one packaging target:

| Binary    | Expected filename              |
| --------- | ------------------------------ |
| `ffhn`    | `ffhn-aarch64-apple-darwin`    |
| `htmlcut` | `htmlcut-aarch64-apple-darwin` |

Both files must be present **and executable** (`chmod 0o755`) before a production
DMG build can be run. Use `npm run verify:hydrated-bundle` to confirm their state.

---

## How to Populate These Files

**Do not edit these files manually.**

For local development, build the upstream standalone binaries and sync them in:

```bash
npm run sync-sidecars
```

For release packaging, fetch the pinned upstream GitHub release assets and verify them:

```bash
npm run fetch:release-sidecars
```

See [docs/developer-guide.md](../../docs/developer-guide.md) for the full procedure.

---

## Current Stand-In Files

The files currently committed here (`ffhn-aarch64-apple-darwin`, `htmlcut-aarch64-apple-darwin`)
are **development shims**, not production binaries.

They exist so that:

1. The Rust backend can exercise its binary resolution and subprocess-launch paths in development
2. CI can verify the structural Tauri build succeeds without requiring real upstream binaries

They are not release-grade artifacts. A production DMG must be built with real compiled
binaries from the `ffhn` and `htmlcut` repositories. `npm run fetch:release-sidecars`
is the authoritative release hydration path, and `vendor/bundle-manifest.json` declares
the pinned upstream references it must use.

---

## dev-fixtures/

The `dev-fixtures/` subdirectory contains Python scripts (`ffhn-fixture.py`,
`htmlcut-fixture.py`) that mimic the JSON envelope output of the real CLIs.
They are used only in local development to exercise the full IPC pipeline
without requiring a compiled Rust binary.

These are **not** bundled into the production application.
