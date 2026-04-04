# Tests

## End-to-End GUI Tests (Playwright)

The `tests/e2e/` directory contains Playwright tests that run against the Vite dev server.
Tests operate against **Mock mode** — no real `ffhn` or `htmlcut` binaries are required.

### First-time setup

Install Playwright browsers once per machine:

```bash
npx playwright install --with-deps
```

### Run the tests

```bash
npm run test:e2e
```

### What is tested

| Test            | Coverage                                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| Dashboard loads | Execution mode banner, Hero heading, App Info and Sidecar Health panels are visible |
| Target creation | "Add target" opens the editor; Cancel returns to the main view                      |

Tests are intentionally scoped to structural UI invariants in Mock mode.
They verify that the GUI shell renders correctly and that primary interaction
paths (target rail, editor toggle) function without regression.

### Adding tests

When adding new tests, prefer this order of scope:

1. Core UI structure and navigation paths (Mock mode, no binaries)
2. Interaction flows that drive the `useDashboardState` hook (still Mock mode)
3. Live sidecar integration paths — set `FFHN_DESKTOP_FFHN_BIN` and `FFHN_DESKTOP_HTMLCUT_BIN` in the test environment

### CI

Playwright runs as part of the `quality-gates` CI workflow after `npm run quality:node`.
See `.github/workflows/quality-gates.yml`.

---

## Rust Unit Tests

Rust tests live alongside their source in `src-tauri/src/` and are run by:

```bash
npm run quality:rust     # includes `cargo test --all-features`
```

See [docs/developer-guide.md](../docs/developer-guide.md) for the full QA gate reference.
