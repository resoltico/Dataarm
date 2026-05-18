# src-tauri

This is the native Tauri package for Dataarm.

## Contents

- `Cargo.toml` and `Cargo.lock` — native package manifest and lockfile
- `src/` — Tauri entrypoint, commands, models, and embedded-runtime logic
- `tauri.conf.json` — native app and packaging contract
- `build.rs` — Tauri build hook
- `capabilities/` and `icons/` — native assets and permission surface

There is no `binaries/` directory in the maintained runtime shape. The desktop no longer bundles `ffhn` or `htmlcut` executables as sidecars.

## Generated Output

- `gen/` — framework-generated Tauri schema output
- `../.dataarm-artifacts/target/` — Cargo and Tauri target output, including `.app` and `.dmg` artifacts
- `../.dataarm-artifacts/build/` — Rust compiler build cache

Repo-local `target/` is hygiene debt when populated.

See [docs/hygiene.md](../docs/hygiene.md) for the maintained artifact policy.
