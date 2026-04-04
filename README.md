# ffhn-desktop

Desktop wrapper for `ffhn`. Provides an operator GUI for creating, running, and inspecting FFHN targets without terminal use.

## What this is

`ffhn-desktop` is a **strict wrapper**. It owns no extraction, orchestration, or validation logic. All of that lives in the upstream CLI tools.

```
ffhn-desktop  →  ffhn  →  htmlcut
    GUI          engine     parser
```

The desktop calls `ffhn`. Only `ffhn` calls `htmlcut`. The desktop never calls `htmlcut` directly.

## Status

All five implementation phases are complete:

- ✅ React + TypeScript frontend, fully modular component and hook architecture
- ✅ Tauri Rust backend with strict domain boundaries (`commands.rs` / `logic.rs` / `models.rs`)
- ✅ Sidecar integration: deterministic binary resolution, mock fallback for development
- ✅ Full GUI operations: target management, execution tracking, workspace + run inspection
- ✅ Unsigned Apple Silicon DMG packaging via GitHub Actions, quality + E2E gates

## Prerequisites

| Tool        | Version                     |
| ----------- | --------------------------- |
| Node.js     | `>= 24.14.1` (see `.nvmrc`) |
| npm         | `>= 11.6.0`                 |
| Rust stable | via `rust-toolchain.toml`   |

## Setup

```bash
npm install
```

The app runs in **Mock mode** by default on a fresh checkout — no real binaries required.
To wire real `ffhn` and `htmlcut` binaries, see [docs/developer-guide.md](./docs/developer-guide.md).

## Common Commands

```bash
npm run dev                          # UI-only dev server (browser, no Tauri)
npm run tauri:dev                    # Full desktop dev loop (React + Rust)

npm run sync-sidecars                # Sync compiled ffhn+htmlcut into src-tauri/binaries/
npm run record:release-sidecar-checksums  # Refresh the pinned upstream checksum receipt
npm run fetch:release-sidecars       # Download and verify the pinned release sidecars
npm run check                        # Format check + lint + typecheck
npm run quality:all                  # Full Node + Rust quality gate suite
npm run test:e2e                     # Playwright end-to-end GUI tests

npm run package:unsigned:dmg:macos-silicon   # Build unsigned Apple Silicon DMG
```

## Documentation

| Document                                             | Purpose                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| [CHANGELOG.md](./CHANGELOG.md)                       | Notable project changes and release notes                                       |
| [docs/developer-guide.md](./docs/developer-guide.md) | Full developer SOP: setup, multi-repo wiring, QA gates, release process         |
| [docs/architecture.md](./docs/architecture.md)       | System design: call graph, source layout, binary resolution, state management   |
| [RELEASE_PROTOCOL.md](./RELEASE_PROTOCOL.md)         | `gh`-first operator procedure for desktop release branches, tags, and artifacts |
| [scripts/README.md](./scripts/README.md)             | Catalogue of all `npm run` scripts and their purpose                            |
