# Artifact Hygiene

Dataarm treats build output, test output, packaging output, and other rebuildable artifacts as a maintained subsystem rather than as incidental filesystem clutter.

The canonical policy lives in:

- [.cargo/config.toml](../.cargo/config.toml)
- [scripts/lib/artifact-roots.mjs](../scripts/lib/artifact-roots.mjs)
- [scripts/lib/hygiene.mjs](../scripts/lib/hygiene.mjs)
- [vendor/quality-gates.json](../vendor/quality-gates.json)
- [vendor/dmg-packaging.json](../vendor/dmg-packaging.json)
- [vendor/tooling-refresh.json](../vendor/tooling-refresh.json)

## Managed Artifact Root

Heavy rebuildable output belongs in the sibling artifact root:

```text
../.dataarm-artifacts/
```

That root is outside the repository checkout on purpose. It keeps the working tree small, makes large rebuildable state easy to inspect and delete, and gives CI and local development the same layout contract.

Managed roots currently include:

- `target/` — Cargo and Tauri target output
- `build/` — Rust compiler build cache
- `dist/` — Vite production frontend bundle consumed by Tauri packaging
- `playwright-report/` — Playwright HTML report output
- `test-results/` — Playwright traces, screenshots, and raw results
- `ci-artifacts/` — packaging manifests, versioned release-manifest copies, checksum manifests, and related CI handoff files

Each managed root receives:

- a `CACHEDIR.TAG`
- a `.dataarm-artifact.json` manifest
- a typed owner and purpose in the hygiene report
- a size budget in the managed policy

## Commands

Use the hygiene commands through `npm run`:

```bash
npm run hygiene:report
npm run hygiene:verify
npm run hygiene:clean:safe
npm run hygiene:clean:rebuildable
```

### `npm run hygiene:report`

Prints the current hygiene report, including:

- managed artifact root path
- known artifact classes
- current sizes
- policy violations

Use this when the checkout feels unexpectedly large or when a CI/local build leaves unexpected output behind.

### `npm run hygiene:verify`

Fails if the maintained policy is violated. This includes cases such as:

- repo-local `src-tauri/target/`
- repo-local `dist/`
- repo-local `playwright-report/`
- repo-local `test-results/`
- repo-local `tmp/` or `temp/` Cargo-like target trees
- missing managed-root markers
- managed roots that exceed their configured budgets

The maintained quality gates call this automatically.

`src-tauri/gen/` is not in that violation list. It is a small framework-generated Tauri schema surface that may be recreated by normal maintained builds because `src-tauri/capabilities/default.json` references it directly. The hygiene policy reports it and keeps it budgeted, but does not treat its presence as drift.

### `npm run hygiene:clean:safe`

Deletes disposable run output without removing the full dependency or compiler caches. This is the normal cleanup command before:

- `npm run quality:node`
- `npm run quality:rust`
- `npm run test:e2e`
- `npm run package:unsigned:dmg:macos-silicon`

It removes:

- managed frontend build output
- managed Playwright outputs
- managed CI artifact output
- legacy repo-local `src-tauri/target/`
- legacy repo-local `dist/`
- legacy repo-local `playwright-report/`
- legacy repo-local `test-results/`
- repo-local `tmp/`
- repo-local `temp/`

### `npm run hygiene:clean:rebuildable`

Deletes everything from `safe` cleanup plus the large rebuildable caches:

- managed Cargo target output
- managed Cargo build cache
- `node_modules/`

Use this when reclaiming space aggressively or when repairing a badly drifted local environment.

## Policy Rules

The hygiene system enforces these invariants:

1. Repo-local heavyweight build trees are debt, not normal state.
2. Cargo output must follow `.cargo/config.toml`.
3. Playwright output must land in the managed sibling artifact root.
4. Packaging manifests and DMG receipts must land in the managed sibling artifact root.
5. Temporary investigation space belongs under repo-local `tmp/` or `temp/`, but it must not accumulate Cargo-like target trees between maintained runs.
6. OS-generated clutter such as `.DS_Store` and `Thumbs.db` does not belong in maintained repo surfaces and is treated as hygiene debt.
7. `src-tauri/gen/` is the only accepted repo-local generated artifact surface in the normal Tauri flow; it remains disposable, small, and framework-owned rather than user-authored source.

## Legacy Roots

The following repo-local directories are treated as violations when populated:

- `src-tauri/target/`
- `dist/`
- `playwright-report/`
- `test-results/`
- `tmp/`
- `temp/`

If they appear, the expected repair path is:

```bash
npm run hygiene:report
npm run hygiene:clean:rebuildable
```

`src-tauri/gen/` is intentionally excluded from that violation list. The expected state is that `npm run hygiene:clean:safe` may remove it, and the next maintained Tauri build may recreate it.

## Related Surfaces

The hygiene contract is also reflected in:

- [docs/developer-guide.md](./developer-guide.md)
- [docs/architecture.md](./architecture.md)
- [scripts/README.md](../scripts/README.md)
- [docs/release-protocol.md](./release-protocol.md)
