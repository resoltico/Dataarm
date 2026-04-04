# FFHN Desktop — Developer Guide

This is the authoritative reference for developing, testing, and packaging `ffhn-desktop`.

The desktop is a strict wrapper. It owns no extraction or orchestration logic.
All of that lives in the upstream CLI tools: `ffhn` and `htmlcut`.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [First-Time Setup](#first-time-setup)
3. [Understanding the Three Repositories](#understanding-the-three-repositories)
4. [Execution Modes](#execution-modes)
5. [Wiring Real Sidecars](#wiring-real-sidecars)
6. [Local Development Loop](#local-development-loop)
7. [Quality Assurance Gates](#quality-assurance-gates)
8. [Building a Native Release](#building-a-native-release)

---

## System Requirements

| Tool           | Required Version                 | Notes                                    |
| -------------- | -------------------------------- | ---------------------------------------- |
| Node.js        | `>= 24.14.1 < 25`                | Enforced in `package.json#engines`       |
| npm            | `>= 11.6.0 < 12`                 | Enforced in `package.json#engines`       |
| Rust (stable)  | Managed by `rust-toolchain.toml` | Installed automatically via `rustup`     |
| Rust (nightly) | `nightly-2026-03-29`             | Required only for `npm run quality:miri` |
| Tauri CLI      | `v2.10.x`                        | Installed as a devDependency via npm     |

Install all Node dependencies:

```bash
npm install
```

Rust toolchains are selected automatically via `rust-toolchain.toml` when you run any `cargo` or `tauri` command.

---

## First-Time Setup

These steps are required only once when you first check out `ffhn-desktop`.

### 1. Clone all three repositories as siblings

The desktop sync tooling expects `ffhn` and `htmlcut` to sit in directories
adjacent to this repository. The exact parent directory name does not matter.

```bash
mkdir -p ~/Developer/ffhn-project
cd ~/Developer/ffhn-project

git clone git@github.com:resoltico/ffhn.git
git clone git@github.com:resoltico/htmlcut.git
git clone git@github.com:resoltico/ffhn-desktop.git
```

Resulting layout:

```text
ffhn-project/
  ├── ffhn/           ← upstream CLI engine
  ├── htmlcut/        ← upstream HTML parser
  └── ffhn-desktop/   ← this repository
```

### 2. Install Desktop Node dependencies

```bash
cd ffhn-desktop
npm install
```

### 3. Verify tooling prerequisites

Run the project-status verifier to confirm the desktop's packaging posture is
coherent before doing anything else:

```bash
npm run verify:project-status
```

At this point the app will be running in **Mock** mode, which is correct. Mock
mode enables full UI iteration without requiring real binaries to be present.

---

## Understanding the Three Repositories

```
ffhn-desktop  ──(Tauri IPC)──►  ffhn  ──(subprocess)──►  htmlcut
     GUI                      CLI engine               HTML parser
```

- **`ffhn-desktop`** ← You are here. React/Tauri wrapper. No extraction logic.
- **`ffhn`** — The authoritative Rust CLI. Owns targets, runs, validation, and artifact generation. It is invoked by the Desktop and is the only caller of `htmlcut`.
- **`htmlcut`** — A standalone HTML parsing CLI. Never called by the Desktop directly. It is invoked exclusively by `ffhn`.

**The Desktop's only job** is to provide an operator UI that calls `ffhn`.
It must never re-implement any logic that `ffhn` already owns.

### How Sidecar Binaries Are Resolved

At startup, `logic.rs` resolves which binaries to use in this exact priority order:

| Priority | Source                                                        | When Active                                   |
| -------- | ------------------------------------------------------------- | --------------------------------------------- |
| 1st      | `FFHN_DESKTOP_FFHN_BIN` / `FFHN_DESKTOP_HTMLCUT_BIN` env vars | Both env vars set and point to existing files |
| 2nd      | `src-tauri/binaries/ffhn-<target>` / `htmlcut-<target>`       | Executable bundled files exist at those paths |
| 3rd      | Mock (fallback)                                               | Neither of the above is satisfied             |

The runtime source reported in the UI (`env-override`, `bundled-candidate`, `path-hint`, or `mock`) directly reflects this resolution state.

---

## Execution Modes

The UI header banner always states the current execution mode. There are three possible states:

| Mode            | Meaning                                                       | How to Reach It                             |
| --------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `mock`          | No real binaries found. All runs are simulated.               | Default on a fresh checkout                 |
| `sidecar-ready` | Path hints exist but binaries are not executable on this host | Intermediate state; rarely seen in practice |
| `sidecar-live`  | Both `ffhn` and `htmlcut` are executable and fully wired      | After running `npm run sync-sidecars`       |

**Mock mode is intentional and safe for UI-only development.** You do not need real
binaries until you want to test actual target execution.

---

## Wiring Real Sidecars

Follow this procedure when you want the desktop to run real targets using the
actual `ffhn` and `htmlcut` binaries.

### Option A — Build standalone siblings locally (standard developer path)

**Step 1: Build both upstream standalone binaries**

Run the standalone build in each sibling directory.
These can be run in parallel in separate terminals:

```bash
# Terminal 1
cd ../ffhn && npm install && npm run build:standalone:macos-silicon

# Terminal 2
cd ../HTMLCut && npm install && npm run build:standalone:macos-silicon
```

The sync script will look for the binaries at:

- `../ffhn/dist/ffhn-aarch64-apple-darwin`
- `../HTMLCut/dist/htmlcut-aarch64-apple-darwin`

**Step 2: Sync binaries into the desktop boundary**

```bash
cd ../ffhn-desktop
npm run sync-sidecars
```

The script will:

1. Read `vendor/dmg-packaging.json` to determine the expected target triple (e.g. `aarch64-apple-darwin`)
2. Copy each compiled binary into `src-tauri/binaries/`
3. Rename them with the required target suffix (`ffhn-aarch64-apple-darwin`, `htmlcut-aarch64-apple-darwin`)
4. Apply `chmod 0o755` to guarantee executability
5. Report `✅` per binary, or `❌` with a clear diagnosis if either is missing

**Step 3: Boot the desktop in live mode**

```bash
npm run tauri:dev
```

The UI banner will now read **Execution Mode: sidecar-live**.

---

### Option B — Environment variable overrides (CI / advanced use)

If your binaries live at non-standard paths (e.g. in a CI pipeline or a
custom build directory), you can override the paths without modifying any files:

```bash
FFHN_DESKTOP_FFHN_BIN=/path/to/ffhn \
FFHN_DESKTOP_HTMLCUT_BIN=/path/to/htmlcut \
npm run tauri:dev
```

When both env vars are set and point to existing files, the app reports
`runtime_source: env-override` and operates in full `sidecar-live` mode.
The bundled files in `src-tauri/binaries/` are completely ignored.

> **Note:** Environment overrides take priority over bundled binaries.
> They are intended for development and CI only. Production DMG bundles
> do not use env vars — they rely exclusively on the bundled binaries.

---

## Local Development Loop

### UI-only iteration (no Rust, no sidecars required)

```bash
npm run dev
```

Starts Vite at `http://localhost:1420`. The full React UI renders with mock data.
Use this for iterating on layout, components, and state logic.

### Full desktop iteration (React + Tauri Rust process)

```bash
npm run tauri:dev
```

Starts both the Vite dev server and the native Tauri/Rust host process.
Use this when testing IPC calls, sidecar execution, or OS-level integrations.

### Quick type and lint check

```bash
npm run check
```

Runs Prettier check, ESLint, and TypeScript compiler without building.

---

## Quality Assurance Gates

All quality gates must pass before merging to `main`. Zero-warning tolerance is enforced.

### Run the full gate suite

```bash
npm run quality:all
```

This is equivalent to running `quality:node` followed by `quality:rust` in sequence.

---

### Node / TypeScript gate (`npm run quality:node`)

Runs these checks in order, stopping on first failure:

| Step | Tool                      | What it checks                                                                       |
| ---- | ------------------------- | ------------------------------------------------------------------------------------ |
| 1    | `prettier --check`        | Consistent formatting across all source files                                        |
| 2    | `eslint --max-warnings 0` | Strict TypeScript rules (`strictTypeChecked`), no floating promises, no implicit any |
| 3    | `vite build`              | Full production build succeeds without errors                                        |
| 4    | `verify:quality-gates`    | Confirms all `verify:*` scripts are registered and documented                        |
| 5    | `verify:tooling-refresh`  | Confirms tooling versions match `package.json` constraints                           |
| 6    | `verify:project-status`   | Confirms vendor manifests, target triples, and intake posture are coherent           |
| 7    | `verify:dmg-packaging`    | Confirms DMG packaging config is internally consistent                               |
| 8    | `verify:github-packaging` | Confirms GitHub Actions workflow matches packaging config                            |
| 9    | `typos .`                 | Spell-checks all source, docs, and config files                                      |

---

### Rust gate (`npm run quality:rust`)

Runs these checks in order, stopping on first failure:

| Step | Tool                        | What it checks                                       |
| ---- | --------------------------- | ---------------------------------------------------- |
| 1    | `cargo fmt --check`         | Consistent Rust formatting                           |
| 2    | `cargo clippy -D warnings`  | Strict linting — any warning is a hard failure       |
| 3    | `cargo check`               | Full compilation check without producing a binary    |
| 4    | `cargo test --all-features` | All unit and integration tests pass                  |
| 5    | `cargo deny check`          | No unlicensed, duplicate, or disallowed dependencies |
| 6    | `typos .`                   | Spell-checks all Rust source files                   |

---

### Memory integrity gate (`npm run quality:miri`)

Optional but strongly recommended before any release.

```bash
npm run quality:miri
```

Runs the Rust test suite under [Miri](https://github.com/rust-lang/miri), which
interprets the compiled MIR and detects undefined behaviour, invalid memory access,
and data races that the compiler cannot catch statically.

Requires the pinned nightly toolchain (`nightly-2026-03-29`), which is set up
automatically in the GitHub Actions `miri` job.

---

### End-to-end GUI tests (`npm run test:e2e`)

```bash
npm run test:e2e
```

Runs the Playwright test suite against a live Vite dev server.
Tests cover the Mock execution path; no real binaries are required.

Playwright must be installed first on a fresh machine:

```bash
npx playwright install --with-deps
```

---

## Building a Native Release

> **Target:** Apple Silicon macOS only (`aarch64-apple-darwin`).
> Windows and Intel macOS are not currently supported packaging targets.

### Pre-requisites

Real upstream sidecar binaries **must** be present in `src-tauri/binaries/` before building.
A release build with mock shims will compile but produce a non-functional application.

Refresh the pinned upstream checksum map, fetch the pinned release sidecars, then verify:

```bash
npm run record:release-sidecar-checksums
npm run fetch:release-sidecars
npm run verify:hydrated-bundle
```

If `npm run record:release-sidecar-checksums` fails, the pinned upstream releases have not published the standalone sidecars yet. Publish those upstream release assets first, then rerun the command.

### Build the unsigned DMG

```bash
npm run package:unsigned:dmg:macos-silicon
```

This command:

1. Runs `verify:project-status`, `verify:dmg-packaging`, and `verify:github-packaging` as pre-flight checks
2. Compiles the Tauri app for `aarch64-apple-darwin` with the production Cargo profile (`lto=true`, `codegen-units=1`, `opt-level="s"`, `strip=true`)
3. Produces an unsigned `.dmg` in `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/`
4. Writes a `github-packaging-manifest.json` artifact to `src-tauri/target/ci-artifacts/`

### GitHub Actions

The packaging workflow runs on `macos-15` (Apple Silicon) and is triggered:

- On every `v*` tag push
- Manually via `workflow_dispatch`

See `.github/workflows/package-unsigned-macos.yml` for the full definition.
The resulting `.dmg` and packaging manifest are uploaded as a GitHub Actions artifact (`ffhn-unsigned-macos-apple-silicon-dmg`) with 14-day retention.

> **Signing and notarization are intentionally disabled.** The application
> is distributed as an unsigned DMG. This is a deliberate decision and is
> not a gap to be filled.
