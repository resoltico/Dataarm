# Release Publishing

Use this guide after the release pull request has merged and the `vX.Y.Z` tag has been pushed.

This phase starts when `.github/workflows/release.yml` begins and ends only after the GitHub release object and downloaded assets have both been verified.

## 7. Monitor The Release Workflow

List runs for the tagged commit:

```bash
TAG_SHA=$(git rev-list -n 1 vX.Y.Z)
gh run list --workflow=release.yml --event=push --commit "$TAG_SHA" --limit=20
gh run list --workflow=release.yml --event=workflow_dispatch --commit "$TAG_SHA" --limit=20
```

If any run fails:

```bash
gh run view <run-id> --log-failed
```

If the workflow needs a targeted rerun against the existing tag:

```bash
gh workflow run release.yml -f release_tag=vX.Y.Z
```

`package-adhoc-signed-macos.yml` remains available as a manual smoke lane, but it is no longer the public publication workflow.

## 8. Verify The GitHub Release Object

Verify the release directly:

```bash
gh release view vX.Y.Z --json tagName,isDraft,isPrerelease,publishedAt,url,assets
npm run verify:github-release -- vX.Y.Z
```

`npm run verify:github-release -- vX.Y.Z` now reuses the authenticated `gh` session directly. A separate manual `GH_TOKEN=...` export is not required.

Requirements:

- the release exists for tag `vX.Y.Z`
- `isDraft` is `false`
- `isPrerelease` is `false` unless this was intentionally a prerelease
- assets include:
  - `Dataarm_X.Y.Z_aarch64.dmg`
  - `dataarm-X.Y.Z-github-packaging-manifest.json`
  - `dataarm-X.Y.Z-checksums.txt`

The GitHub release object is the authoritative publication record. GitHub’s built-in source-code archive links are convenience downloads, not part of the maintained Dataarm asset inventory.
The published release notes should also carry the first-launch macOS guidance footer that points readers to [installing-macos.md](./installing-macos.md), because current public builds are ad-hoc signed but still unnotarized.

## 9. Verify The Published Assets

Download the maintained assets:

```bash
TMP_DIR="$(mktemp -d)"
gh release download vX.Y.Z \
  -p 'Dataarm_X.Y.Z_aarch64.dmg' \
  -p 'dataarm-X.Y.Z-github-packaging-manifest.json' \
  -p 'dataarm-X.Y.Z-checksums.txt' \
  -D "$TMP_DIR"
```

Validate the checksums:

```bash
(
  cd "$TMP_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum --check "dataarm-X.Y.Z-checksums.txt"
  else
    while read -r EXPECTED ASSET_NAME; do
      ACTUAL="$(shasum -a 256 "${ASSET_NAME}" | awk '{print $1}')"
      [ "$ACTUAL" = "$EXPECTED" ]
    done < "dataarm-X.Y.Z-checksums.txt"
  fi

  jq . "dataarm-X.Y.Z-github-packaging-manifest.json"
)
```

Then confirm the manifest still describes the intended public posture:

- `artifactKind` is `github-ad-hoc-signed-macos-packaging`
- `productName` is `Dataarm`
- `targetTriple` is `aarch64-apple-darwin`
- `signing` is `ad-hoc`
- `notarization` is `disabled`
- `appBundle.bundleExecutable` is `dataarm`
- `appBundle.legalDirectory` is `Contents/SharedSupport/Legal`
- `appBundle.nativeSmokePayload.runtimeContract` is `embedded-ffhn-core`
- `appBundle.bundledLegalFiles` includes `LICENSE`, `NOTICE`, `PATENTS.md`, `Cargo.lock`, and `package-lock.json`

The public release notes should state the current first-launch truth as well:

- Finder `Open` or `Privacy & Security` -> `Open Anyway` is the primary unblock path.
- `xattr -dr com.apple.quarantine "/Applications/Dataarm.app"` is a terminal fallback, not the primary recommendation.

Remove the download directory when you are done:

```bash
rm -rf "$TMP_DIR"
```
