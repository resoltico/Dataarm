# Tests

## End-to-End GUI Tests

`tests/e2e/` contains Playwright tests that run against the Vite dev server and the browser mock backend. No native sidecars or sibling repositories are required.

### First-time setup

```bash
npx playwright install --with-deps
```

### Run the maintained lane

```bash
npm run test:e2e
```

The maintained command clears disposable output before the run, executes the browser workbench against an instrumented Vite dev server, and verifies artifact hygiene afterward. Playwright reports, raw results, and browser coverage reports are written under `../.dataarm-artifacts/`.

`npm run verify:frontend-coverage` then enforces the frontend `100%` line and `100%` branch contract from the maintained unit/component lane and confirms the Playwright run captured instrumented runtime files.

### Browser workbench matrix

| Scenario                     | Coverage                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Dashboard bootstrap          | embedded workbench shell, watch-root inventory, summary panel, and primary actions        |
| HTTP template preview        | guided target authoring, canonical preview inspection, and preview report rendering       |
| Draft truth                  | new-target draft context, selection honesty, and durable-run disablement                  |
| Unsaved-work guard           | editor dirty state and protection against stale target or workspace runs                  |
| Draft discard prompt         | confirmation flow before abandoning an untouched new-target draft                         |
| Workspace batch run          | batch-run action, completion feedback, and canonical batch report rendering               |
| Notification policy          | alert policy updates, delivery-channel changes, delivery history, and history clearing    |
| Workspace create and recents | user watch-root creation, save-run feedback, and switching back through recent workspaces |
| Target deletion              | destructive confirmation and post-delete empty-workspace state                            |
| Desktop viewport fit         | no page scrolling, usable target list height, and usable editor height                    |
| Live-browser width fit       | short-height desktop composition with visible recents and stable two-column workbench     |

## Rust Tests

Rust tests live next to the backend code in `src-tauri/src/` and are exercised by:

```bash
npm run quality:rust
```

That lane includes formatting, clippy, `cargo check`, `cargo test`, `cargo deny`, spell checking, and hygiene verification.

### Native backend matrix

| Scenario                     | Coverage                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Target save cleanup          | stale `state.json`, `last_run.json`, locks, and snapshots are cleared before a rewritten target becomes durable |
| Target create and rename     | canonical `target.toml` persistence, directory rename behavior, and duplicate-destination rejection             |
| Notification policy engine   | eligible run outcomes, delivery-channel selection, denied-system fallback, and workspace-skip escalation        |
| HTTP preview fixture         | real `ffhn-core` dry-run preview against a local HTTP fixture server                                            |
| File target run              | persisted status and run artifacts after a real live run in a temporary watch root                              |
| Workspace batch run          | multi-target live batch execution against a temporary watch root                                                |
| Workspace boundary hardening | direct-child validation and traversal rejection for target-directory resolution                                 |

## Release-grade field test

For a broader backend shakeout that exercises the real guided-session contract, local fixture servers, deliberate operator mistakes, and optional live-web targets, run:

```bash
npm run fieldtest:backend
```

Add `-- --live` when you want the matrix to reach real public sites such as `example.com` and `rust-lang.org`:

```bash
npm run fieldtest:backend -- --live
```

This lane is intentionally outside the maintained CI/quality gate because the `--live` variant depends on public network availability and current site content.
