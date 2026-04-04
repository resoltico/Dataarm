# Release Protocol

This release flow is driven by the GitHub CLI (`gh`). Every step that touches GitHub uses `gh`, not the GitHub web UI.

This repository does not currently publish a GitHub Release. Its release surface is an unsigned Apple Silicon DMG uploaded as a GitHub Actions artifact. That means the operator handoff ends at verified CI artifact availability, not at a public GitHub Release page.

## 0. GitHub CLI Gate

Before doing anything else, run both checks:

```bash
gh --version
gh auth status
```

If either command fails, stop immediately. Do not continue until `gh` is installed and authenticated with repository access.

## 1. Pre-flight: Verify Release Readiness

Run the local gates first:

```bash
npm run quality:node
npm run test:e2e
npm run quality:rust
npm run verify:project-status
npm run verify:dmg-packaging
npm run verify:github-packaging
```

On an Apple Silicon macOS release machine, also run:

```bash
npm run record:release-sidecar-checksums
npm run fetch:release-sidecars
npm run package:unsigned:dmg:macos-silicon
```

All required commands must succeed before any commit or tag.

Then verify every item in this checklist:

- `package.json` `version` equals the target release version exactly.
- `vendor/bundle-manifest.json` `desktopProduct.version` equals the target version exactly.
- `vendor/bundle-manifest.json` pins the intended upstream `ffhn` and `HTMLCut` release refs and version labels.
- `vendor/checksums/expected-upstream-release-checksums.json` was last refreshed with `npm run record:release-sidecar-checksums` after the pinned upstream releases were published, and it contains real SHA256 values rather than placeholders.
- `vendor/release-readiness.json` is not blocked on placeholder sidecars or missing packaged proof for the release you are about to ship.
- `docs/developer-guide.md`, `scripts/README.md`, and `src-tauri/binaries/README.md` describe the current sidecar flow: sibling standalone `dist/` builds for development, `npm run record:release-sidecar-checksums` for checksum intake, and `npm run fetch:release-sidecars` for release hydration.
- GitHub repository settings remain aligned with this procedure:
  - default branch is `main`
  - `delete_branch_on_merge` is enabled
  - `main` is protected with admin enforcement
  - required status checks are exactly `node-and-rust` and `miri`
  - one approving review is required, stale approvals are dismissed on new pushes, and unresolved review conversations block merge
- `.github/workflows/package-unsigned-macos.yml` and `vendor/dmg-packaging.json` are still aligned on runner, target triple, artifact name, and unsigned posture.

## 2. Commit On A Release Branch

`main` is not the place to do release commits directly. Always use a release branch.

```bash
git checkout -b release/X.Y.Z
git add <every intended release file>
git status --short
git diff --cached --name-status
git diff --cached --stat
git commit -m "release: bump version to X.Y.Z"
git push origin release/X.Y.Z
```

Before committing:

- `git status --short` must show no intended release file left unstaged.
- `git diff --cached --name-status` must show the exact release file set.
- `git diff --cached --stat` must confirm the staged payload includes versioning, sidecar pinning, checksum receipts, docs, scripts, and workflow changes that belong in the release.

If `npm run record:release-sidecar-checksums` changed `vendor/checksums/expected-upstream-release-checksums.json`, that file belongs in the release branch and must not be left unstaged.

## 3. Open PR And Wait For CI

```bash
gh pr create \
  --title "release: bump version to X.Y.Z" \
  --base main \
  --head release/X.Y.Z \
  --body "Release X.Y.Z"
```

Record the PR number, then verify the PR scope and checks:

```bash
gh pr diff <N> --name-only
gh pr view <N> --json number,state,mergeStateStatus,statusCheckRollup,url
gh pr checks <N>
```

Do not continue until every required job in workflow `quality-gates` is green. At the time of writing that means:

- `node-and-rust`
- `miri`

If CI fails, fix the branch, push again, and repeat both the staged-diff checkpoint and the PR-diff checkpoint.

## 4. Merge PR And Verify The Merge Handoff

```bash
gh pr merge <N> --merge --delete-branch --subject "release: bump version to X.Y.Z (#N)"
git checkout main
git pull
gh pr view <N> --json number,state,mergedAt,headRefName,baseRefName,url
```

Requirements before continuing:

- PR state is `MERGED`.
- `mergedAt` is populated.
- Local `main` contains the merge commit you expect.
- The remote release branch is deleted.

GitHub auto-delete on merge should also be enabled at the repository level. `--delete-branch`
remains mandatory here so the release handoff stays self-contained even if the repo setting is
misconfigured or temporarily changed.

If the local `release/X.Y.Z` branch still exists, delete it:

```bash
git branch -d release/X.Y.Z
```

## 5. Create The Tag, Push It, And Verify The Remote Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api "repos/$REPO/git/ref/tags/vX.Y.Z"
```

Do not continue until the remote tag ref exists.

The tag push is what triggers `.github/workflows/package-unsigned-macos.yml`.

## 6. Branch Hygiene

After the merge and tag push, prune stale refs and verify that no `release/` branches remain:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
git remote prune origin
gh api "repos/$REPO/branches" --paginate --jq '.[].name'
```

Requirements:

- No `release/X.Y.Z` branch remains on GitHub.
- No historical `release/` branches remain on GitHub.
- No fully merged local `release/` branches remain.

## 7. Monitor Packaging Workflow Runs With Duplicate-Run Awareness

Scope the workflow runs to the tagged commit:

```bash
TAG_SHA=$(git rev-list -n 1 vX.Y.Z)
gh run list --workflow=package-unsigned-macos.yml --event=push --commit "$TAG_SHA" --limit=20
```

Inspect every run that is not `completed/success`:

```bash
gh run view <run-id> --log-failed
```

Rules:

- Never treat one failed run as authoritative if a sibling run for the same tag commit already produced the expected artifact.
- Never rerun blindly. First inspect whether the desired DMG artifact already exists for a successful run.
- Only classify the packaging handoff as failed if no run produced the expected artifact and direct artifact inspection confirms it is absent or incomplete.

## 8. Verify The Artifact Handoff

There is no GitHub Release publication step in this repository today. The authoritative handoff is the GitHub Actions artifact named `ffhn-unsigned-macos-apple-silicon-dmg`.

Download the artifact from a successful run:

```bash
RUN_ID=<successful run id from step 7>
TMP_DIR="$(mktemp -d)"
gh run download "$RUN_ID" -n ffhn-unsigned-macos-apple-silicon-dmg -D "$TMP_DIR"

find "$TMP_DIR" -maxdepth 2 -type f | sort
jq . "$TMP_DIR/github-packaging-manifest.json"

rm -rf "$TMP_DIR"
```

Requirements:

- The downloaded artifact contains the DMG.
- The downloaded artifact contains `github-packaging-manifest.json`.
- The manifest reports:
  - `artifactKind` = `github-unsigned-macos-packaging`
  - `productName` = `FFHN`
  - `targetTriple` = `aarch64-apple-darwin`
  - `signing` = `disabled`
  - `notarization` = `disabled`

Do not declare the release complete until the CI artifact is present and the packaging manifest matches the intended release version and target.

## 9. Public Availability Note

This repository does not currently publish a public GitHub Release artifact. A successful tag push only produces a GitHub Actions artifact with retention limits.

Do not describe the desktop release as publicly available unless a separate public publication step has been added and verified. Today, the correct completion statement is narrower: the unsigned Apple Silicon DMG artifact was built and verified in GitHub Actions.
