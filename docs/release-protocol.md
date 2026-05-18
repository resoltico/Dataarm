# Release Protocol

This release flow uses the GitHub CLI (`gh`) and now ends in a public GitHub release object. The maintained public asset surface is still intentionally narrow: one unsigned Apple Silicon DMG, one versioned packaging-manifest copy, and one SHA-256 manifest.

## Phase Map

- This document covers local preflight, release branch flow, pull request, merge, and tag publication.
- [release-publishing.md](./release-publishing.md) covers the tag-triggered GitHub release workflow, release-object verification, and post-tag asset verification.

## Shared Release Invariants

- `vendor/app-version.json` is the single release-version source of truth.
- `npm run sync:app-version` is required after any intentional version change.
- Release commits happen on `release/X.Y.Z`, not directly on `main`.
- If dirty unpublished release-candidate work already lives in the primary checkout, capture it on `release-prep/X.Y.Z` first, then cut `release/X.Y.Z` from that captured commit instead of pretending dirty `main` was already release-ready.
- `.github/workflows/package-unsigned-macos.yml` is a manual packaging smoke lane.
- `.github/workflows/release.yml` is the tag-driven public publication lane.
- `.cargo/config.toml` is the only maintained source for Cargo artifact directories; GitHub workflows must not override `CARGO_TARGET_DIR` or `CARGO_BUILD_BUILD_DIR`.
- The GitHub release object is the authoritative publication record.
- Current public assets remain unsigned and unnotarized until a future signing lane is wired deliberately.

## 0. GitHub CLI Gate

```bash
gh --version
gh auth status
```

Stop if either command fails.

## 1. Local Preflight

Run the maintained gates first:

```bash
mise install
npm install
npm run sync:app-version
npm run fieldtest:backend
npm run fieldtest:backend -- --live
npm run quality:all
npm run quality:miri
npm run package:unsigned:dmg:macos-silicon
```

Then verify:

- `vendor/app-version.json` is the intended release version.
- `CHANGELOG.md` contains a non-empty `## [X.Y.Z]` section for the intended release version, because GitHub release notes are extracted from that section.
- `npm run verify:app-version` passes, proving the generated consumers stayed aligned.
- `docs/developer-guide.md`, `docs/architecture.md`, `docs/hygiene.md`, [release-publishing.md](./release-publishing.md), and `scripts/README.md` describe the current embedded-runtime and release flow.
- `vendor/dmg-packaging.json`, `vendor/quality-gates.json`, `vendor/release-publishing.json`, `vendor/runtime-dependencies.json`, and `vendor/tooling-refresh.json` match the maintained workflow and tooling posture.
- `.github/workflows/quality-gates.yml`, `.github/workflows/package-unsigned-macos.yml`, and `.github/workflows/release.yml` all use the pinned Node runtime and current artifact names, and the Ubuntu `quality`/`miri` jobs still install the maintained Tauri Linux development packages before Rust runs.
- If the release changes the embedded `ffhn-core` tag or version, update `vendor/runtime-dependencies.json` in the same change so the machine-readable intake policy stays aligned with the manifest.

## 2. Dirty Main Capture

If your primary checkout already contains the intended release-candidate work on dirty `main`, capture it first:

```bash
git checkout -b release-prep/X.Y.Z
git add <intended release files>
git status --short
git diff --cached --name-status
git diff --cached --stat
git commit -m "release-prep: capture X.Y.Z candidate"
```

Then choose the release-branch shape deliberately:

- If the capture commit still needs follow-up edits, cut `release/X.Y.Z` from the captured commit and continue there.
- If the capture commit is already the full intended release candidate, keep `release-prep/X.Y.Z` as the salvage branch and replay that captured diff onto a clean `release/X.Y.Z` branch from `main` so the public branch can carry one truthful `release:` commit instead of merging the internal `release-prep:` message into `main`.

One clean way to do the replay is:

```bash
CAPTURE_COMMIT="$(git rev-parse HEAD)"
git checkout -b release/X.Y.Z origin/main
git cherry-pick --no-commit "$CAPTURE_COMMIT"
```

If `main` is already clean and truthful, skip this step and cut `release/X.Y.Z` directly from `main`.

## 3. Release Branch

```bash
# If you skipped Step 2, create the release branch now:
# git checkout -b release/X.Y.Z

# If you came from Step 2 and replayed the capture diff, you are now on a clean
# release/X.Y.Z branch with the captured changes staged but uncommitted.
confirm or edit vendor/app-version.json
npm run sync:app-version
git add <intended release files>
git status --short
git diff --cached --name-status
git diff --cached --stat
git commit -m "release: prepare X.Y.Z"
git push origin release/X.Y.Z
```

Do not proceed until the staged diff matches the release scope exactly.

## 4. Pull Request And CI

```bash
gh pr create \
  --title "release: prepare X.Y.Z" \
  --base main \
  --head release/X.Y.Z \
  --body "Release X.Y.Z"
```

Then check:

```bash
gh pr diff <N> --name-only
gh pr view <N> --json number,state,mergeStateStatus,statusCheckRollup,url
gh pr checks <N>
```

Required workflow jobs:

- `quality`
- `miri`

Fix any failing check before proceeding.

## 5. Merge

```bash
gh pr merge <N> --merge --delete-branch --subject "release: prepare X.Y.Z (#N)"
git checkout main
git pull
gh pr view <N> --json number,state,mergedAt,headRefName,baseRefName,url
```

Requirements:

- PR state is `MERGED`.
- Local `main` contains the merge commit.
- The remote release branch is gone.

## 6. Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/git/ref/tags/vX.Y.Z"
```

The tag push triggers `.github/workflows/release.yml`. Continue with [release-publishing.md](./release-publishing.md) for the publication and verification steps.
