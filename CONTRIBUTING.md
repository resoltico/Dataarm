# Contributing

Dataarm prefers coherent current-state design over compatibility scaffolding. If a maintained surface needs to change, change it directly and keep the repo-owned contracts, docs, and checks aligned in the same slice.

## Setup

Use the maintained local toolchain:

```bash
brew install mise
mise install
npm install
npx playwright install --with-deps
```

`rust-toolchain.toml` owns the stable Rust pin. `.mise.toml` and `package.json` own the Node and npm pins.

## Normal Workflow

1. Read the affected code, tests, and docs before editing.
2. Update code, docs, and changelog together when the public or maintainer-facing surface changes.
3. Run the maintained local gates before handing work off:

```bash
npm run quality:all
npm run quality:miri
```

If the task touches packaging or release machinery, also run:

```bash
npm run package:unsigned:dmg:macos-silicon
```

## Release Expectations

- `vendor/app-version.json` is the single release-version source of truth.
- `npm run sync:app-version` must follow any intentional version change.
- The release branch flow lives in [docs/release-protocol.md](./docs/release-protocol.md).
- The tag-to-GitHub-release publication flow lives in [docs/release-publishing.md](./docs/release-publishing.md).
- The current public release surface is one unsigned Apple Silicon DMG plus the maintained manifest and checksum sidecars.

## Dependency Updates

Dependabot is enabled for npm, Cargo, and GitHub Actions updates. Keep dependency PRs coherent, run the maintained gates, and avoid carrying stale release or packaging machinery forward when the repo-owned contracts already have a cleaner shape.
