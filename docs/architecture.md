# Architecture

## Core Rule

`ffhn-desktop` is not a second implementation of FFHN.
It is a strict wrapper that provides an operator GUI for the FFHN CLI engine.

The desktop must never re-implement any extraction, orchestration, or validation
logic that `ffhn` already owns.

---

## Runtime Call Graph

```text
┌─────────────────────┐
│   ffhn-desktop      │  React/Tauri GUI — operator interface
│   (this repo)       │
└────────┬────────────┘
         │  Tauri IPC → #[tauri::command]
         ▼
┌─────────────────────┐
│   Rust backend      │  commands.rs / logic.rs — orchestration, I/O, state
│   (src-tauri/src/)  │
└────────┬────────────┘
         │  std::process::Command::new(ffhn) with args + env
         ▼
┌─────────────────────┐
│   ffhn              │  Authoritative CLI engine — targets, runs, validation
│   (sibling repo)    │
└────────┬────────────┘
         │  subprocess (managed by ffhn, not by the desktop)
         ▼
┌─────────────────────┐
│   htmlcut           │  HTML parsing utility
│   (sibling repo)    │
└─────────────────────┘
```

**The desktop only ever calls `ffhn`.** It never calls `htmlcut` directly.
`ffhn` is solely responsible for invoking `htmlcut`.

---

## Repository Boundaries

| Repository     | Role        | Who calls it                       |
| -------------- | ----------- | ---------------------------------- |
| `ffhn-desktop` | GUI wrapper | end users / operators              |
| `ffhn`         | CLI engine  | `ffhn-desktop` (via Tauri command) |
| `htmlcut`      | HTML parser | `ffhn` (via subprocess)            |

The three repositories are developed independently and never directly import
each other's source code. They integrate exclusively through compiled binary
execution at runtime.

---

## Source Layout

### Frontend (`src/`)

Responsible for operator workflow, state presentation, and user interaction.
The frontend makes Tauri IPC calls and renders what the backend returns.

```
src/
  hooks/
    useDashboardState.ts    ← single source of truth for all UI state
  components/
    layout/
      Hero.tsx              ← top-level header + primary action buttons
      Sidebar.tsx           ← left rail: target list, recent workspaces, priorities
      MainDashboard.tsx     ← main content: all data panels and detail views
    dashboard/
      TargetEditor.tsx      ← target creation form
    KeyValueTable.tsx       ← generic key/value display primitive
    SectionCard.tsx         ← generic card container with optional title/actions
    StatusPill.tsx          ← status label component
  App.tsx                   ← root: wires useDashboardState into the three layout components
  styles.css                ← design system; adapts to system light/dark mode via prefers-color-scheme
```

**Design invariant:** Layout components (`Hero`, `Sidebar`, `MainDashboard`) are presentation-only.
They receive state and callbacks as props from `App.tsx`. They contain no business logic and
make no direct Tauri calls. All Tauri calls are isolated inside `useDashboardState.ts`.

### Tauri / Rust Backend (`src-tauri/src/`)

```
src-tauri/src/
  main.rs         ← Tauri builder: registers AppState, wires all command handlers
  models.rs       ← typed data schemas shared across the backend (serialised to/from JSON for IPC)
  commands.rs     ← exclusive Tauri command surface; each fn is annotated #[tauri::command]
  logic.rs        ← all logic, I/O, binary resolution, workspace management, sidecar execution
```

**Design invariant:** `commands.rs` is a pure routing layer. It delegates immediately to `logic.rs`
and must not contain business logic. `logic.rs` must not contain Tauri-specific code.

### Vendor (`vendor/`)

JSON contracts that define the desktop's relationship to its upstream sidecars:

```
vendor/
  bundle-manifest.json      ← pinned upstream refs (repo URLs, refs, version labels)
  dmg-packaging.json        ← packaging target, bundle IDs, signing posture
```

These files are the source of truth read by both the Rust backend and the `verify:*` scripts.

---

## Sidecar Binary Resolution

At startup, `logic.rs` determines which binaries to use via the following precedence chain:

```
1. FFHN_DESKTOP_FFHN_BIN env var         ← highest priority
   FFHN_DESKTOP_HTMLCUT_BIN env var
   (both must be set and point to existing files)

2. src-tauri/binaries/ffhn-<target>      ← bundled candidate
   src-tauri/binaries/htmlcut-<target>
   (files must exist and be executable)

3. Mock fallback                         ← lowest priority
   (all runs are simulated; no real execution occurs)
```

The resolved source is reported in the UI as `runtime_source`:

- `env-override` — both env vars satisfied
- `bundled-candidate` — bundled executables found and usable
- `path-hint` — path hints exist but binaries are not executable on this host
- `none` — mock

The reported `execution_mode` derives from the above:

- `sidecar-live` — an executable binary pair is available from any source
- `sidecar-ready` — path hints exist but no executable pair
- `mock` — no real binaries available

### `htmlcut` Path Injection

When invoking `ffhn`, the desktop passes the absolute path of the bundled `htmlcut`
binary down to `ffhn` via the `FFHN_DESKTOP_HTMLCUT_BIN` environment variable.
This ensures `ffhn` uses the exact same `htmlcut` version that the desktop bundled,
rather than any version that may exist on the user's ambient `PATH`.

The user's shell `PATH` is never passed through to the sidecar subprocess.

---

## Execution Posture

| Context                       | Behaviour                                                            |
| ----------------------------- | -------------------------------------------------------------------- |
| Fresh checkout (no binaries)  | Mock mode — UI fully functional, runs are simulated                  |
| After `npm run sync-sidecars` | `sidecar-live` — real `ffhn` execution                               |
| CI headless tests             | Mock mode (no binaries present in CI unless explicitly injected)     |
| Production DMG                | Bundled binaries in `src-tauri/binaries/` — `sidecar-live` mandatory |

---

## State Management

All application state is centralised in `useDashboardState.ts`.
This hook:

- Owns the bootstrap loading sequence (called once on mount)
- Exposes strongly-typed async handlers for every user action
- Returns a flat state object consumed by the three layout components

No state lives in individual components. No Tauri calls are made from JSX.

---

## Compilation Profiles

```toml
# src-tauri/Cargo.toml

[profile.dev]
incremental = true         # faster incremental rebuilds during development

[profile.release]
codegen-units = 1          # maximises LLVM optimisation scope
lto = true                 # link-time optimisation across all crates
opt-level = "s"            # optimise for binary size
strip = true               # strip debug symbols from the output binary
```

The release profile is used automatically by both `tauri build` and the GitHub Actions packaging workflow.
