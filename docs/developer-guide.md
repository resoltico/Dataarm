# Dataarm Developer Guide

This is the maintained guide for developing, testing, and packaging Dataarm.

## System Requirements

| Tool         | Version              | Notes                                                                  |
| ------------ | -------------------- | ---------------------------------------------------------------------- |
| `mise`       | current              | local runtime manager                                                  |
| Node.js      | `26.1.0`             | pinned in `.mise.toml`                                                 |
| npm          | `11.13.0`            | bundled with Node `26.1.0` and pinned in `package.json#packageManager` |
| Rust stable  | `1.95.0`             | pinned in `rust-toolchain.toml`                                        |
| Rust nightly | `nightly-2026-03-29` | used only for `npm run quality:miri`                                   |

## First-Time Setup

```bash
brew install mise
mise install
mise exec -- npm install
npx playwright install --with-deps
```

That is enough to run the browser workbench, the native app, the tests, and the packaging checks in this repository.

All `npm` commands in this guide assume you are already inside the pinned toolchain from `mise`. In a plain host shell, prefix them with `mise exec --`.

You do not need sibling `ffhn` or `HTMLCut` clones to work on Dataarm. Those repositories only matter when you are changing upstream engine behavior.

## Product Version Changes

Dataarm now keeps one canonical version contract in [vendor/app-version.json](../vendor/app-version.json).

When you intentionally change the app version:

```bash
npm run sync:app-version
npm run verify:app-version
```

That rewrites the duplicated consumers used by npm, Cargo, Tauri bundling, and browser-workbench fixtures.

## Local Development Loops

### Browser workbench

```bash
npm run dev -- --host 127.0.0.1
```

This starts Vite on an explicit localhost bind and uses the maintained browser workbench bridge:

- [src/lib/browserWorkbenchClient.ts](../src/lib/browserWorkbenchClient.ts) is the frontend transport
- [scripts/browser-workbench/vite-plugin.mjs](../scripts/browser-workbench/vite-plugin.mjs) mounts the local RPC surface
- [scripts/browser-workbench/rust-bridge.mjs](../scripts/browser-workbench/rust-bridge.mjs) talks to the Rust example bridge
- [src-tauri/examples/browser_workbench_bridge.rs](../src-tauri/examples/browser_workbench_bridge.rs) delegates browser workbench calls to backend-owned logic

Use this loop for:

- layout work
- copy and interaction refinement
- guided target-authoring flow work
- Playwright-oriented UI debugging
- state-flow iteration that does not require native shell integration

### Backend release validation

```bash
npm run release-validation:backend
```

Use `npm run release-validation:backend:live` before public releases when you want the real Rust backend to exercise local fixture servers, deliberate bad operator inputs, and live public websites.

Dataarm preserves the upstream FFHN and HTMLCut selection contract here. When a guided target uses `nth`, the index is 1-based.

### Native desktop loop

```bash
npm run tauri:dev
```

This starts the Vite dev server and the native Tauri host together. The backend materializes a demo watch root and exercises the embedded `ffhn-core` path.

Use this loop for:

- command contract work
- real target preview and run behavior
- filesystem operations
- native path opening
- packaging-adjacent debugging

Preview inspection is intentionally artifact-backed. Because `ffhn-core` dry-run does not persist runtime artifacts, Dataarm materializes one disposable run inside a temporary preview workspace whenever the rendered, compare, and extraction tabs need concrete snapshot files.

## Quality Gates

### Fast gate

```bash
npm run check
```

Runs formatting, linting, and type-checking.

The lint lane is intentionally zero-warning and uses ESLint flat config in typed strict mode plus explicit runtime-safety rules such as `eqeqeq`, `curly`, `no-var`, `prefer-const`, and `no-debugger`.

### Full maintained suite

```bash
npm run quality:all
```

This runs:

1. `npm run quality:node`
2. `npm run quality:browser-workbench`
3. `npm run quality:rust`

The frontend coverage contract is intentionally split inside `npm run quality:browser-workbench`: `npm run test:unit` proves 100% line plus 100% branch coverage across the maintained React surface, while `npm run test:e2e` drives real desktop workbench flows against an instrumented Vite dev server and must emit runtime coverage evidence without filler assertions.

The GitHub `quality` and `miri` jobs run on Ubuntu and must install the documented Tauri Linux development packages before any Rust lane executes. The GitHub `quality` job must run the full browser-workbench proof lane, not a narrower Playwright-only subset. The GitHub `desktop-surface` job runs on macOS and proves that the public DMG surface matches the maintained packaging contract. Keep those workflow boundaries aligned with [.github/workflows/quality-gates.yml](../.github/workflows/quality-gates.yml) when changing CI or Tauri Linux requirements.

### Release-grade ship gate

```bash
npm run quality:ship
```

This runs the full maintained suite and then builds plus verifies the ad-hoc signed DMG that the public release workflow publishes.

### Memory safety lane

```bash
npm run quality:miri
```

This uses the pinned nightly toolchain and the maintained wrapper script because the Tauri startup path needs the Miri isolation override. The lane is intentionally scoped to one desktop-owned save/read seam rather than to the entire upstream HTML extraction engine. `ffhn-core` and `htmlcut-core` own the deeper engine proof in their own repositories; Dataarm proves that its guided-session persistence and workspace read boundary remain sound under Miri, and any open upstream HTML extraction defect belongs in the `.codex/` upstream-defect log.

## Packaging

The maintained local packaging command is:

```bash
npm run package:adhoc-signed:dmg:macos-silicon
```

It does four things:

1. cleans disposable artifact state
2. verifies the packaging posture
3. builds the ad-hoc signed but unnotarized Apple Silicon DMG
4. launches the mounted app bundle through the native smoke path and writes a packaging manifest into `../.dataarm-artifacts/ci-artifacts/`

The packaged `.app` inside that DMG must carry its release legal surface under
`Contents/SharedSupport/Legal/`:

- `LICENSE`
- `NOTICE`
- `PATENTS.md`
- `Cargo.lock`
- `package-lock.json`

Do not override `CARGO_TARGET_DIR` or `CARGO_BUILD_BUILD_DIR` in GitHub workflows. The checked-in
`.cargo/config.toml` artifact-root contract is the single source of truth for local builds,
quality gates, packaging, and release publication.

There is no sidecar fetch or upstream checksum intake step in this repository anymore.

## Public Release Publication

Local DMG packaging smoke and public GitHub publication are intentionally separate:

1. `npm run package:adhoc-signed:dmg:macos-silicon` proves that the repository can build the ad-hoc signed but unnotarized Apple Silicon DMG, launch the packaged desktop binary through the native smoke path, and write the packaging manifest locally.
2. `.github/workflows/package-adhoc-signed-macos.yml` is the manual GitHub packaging smoke lane for the same posture.
3. `.github/workflows/release.yml` is the tag-driven public publication lane that creates the GitHub release object, uploads the maintained assets, and publishes the release.

Use [docs/release-protocol.md](./release-protocol.md) for the local preflight, release branch, PR, merge, and tagging flow. Use [docs/release-publishing.md](./release-publishing.md) for the tag-triggered GitHub release publication and post-tag verification steps.

## Managed Artifact Policy

Heavy rebuildable output belongs under:

```text
../.dataarm-artifacts/
```

Use these commands to inspect and maintain that policy:

```bash
npm run hygiene:report
npm run hygiene:verify
npm run hygiene:clean:safe
npm run hygiene:clean:rebuildable
```

Repo-local `src-tauri/target/`, `dist/`, `playwright-report/`, and `test-results/` are treated as violations, not as normal build output.

## When Upstream Repositories Matter

Clone `ffhn` or `HTMLCut` only when your task changes:

- engine contracts exposed by `ffhn-core`
- canonical target schemas
- preview or run envelope shape
- extraction semantics owned by `htmlcut-core`

Dataarm depends on the released `ffhn-core` crate from the upstream repository tag declared in [src-tauri/Cargo.toml](../src-tauri/Cargo.toml).

[vendor/runtime-dependencies.json](../vendor/runtime-dependencies.json) is the canonical machine-readable policy for the embedded runtime line, the desktop-owned Miri seam, and the no-downstream-patch posture that now applies on `ffhn-core v8.1.0`.
