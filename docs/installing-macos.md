# Installing Dataarm On macOS

Dataarm currently ships as an ad-hoc signed but unnotarized Apple Silicon macOS app.
That means the app bundle is structurally valid and signed, but macOS may still block the first launch because Apple has not notarized the download yet.

## Install

1. Download `Dataarm_X.Y.Z_aarch64.dmg` from the GitHub release.
2. Open the DMG.
3. Drag `Dataarm.app` into `/Applications`.
4. Eject the DMG.

## First Launch

Use the normal macOS override path first:

1. Open Finder and go to `/Applications`.
2. Control-click `Dataarm.app`.
3. Choose `Open`.
4. Confirm the prompt.

If macOS still blocks the launch, try the system-level override:

1. Attempt to open `Dataarm.app` once.
2. Open `System Settings` -> `Privacy & Security`.
3. Scroll to the security section for the blocked app.
4. Click `Open Anyway`.

Apple documents this override flow here:

- [Safely open apps on your Mac](https://support.apple.com/en-euro/102445)
- [Open a Mac app from an unknown developer](https://support.apple.com/en-us/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)

## Terminal Fallback

If Finder and `Open Anyway` still do not unblock the app, remove the quarantine attribute from the installed app bundle:

```bash
xattr -dr com.apple.quarantine "/Applications/Dataarm.app"
```

Only run that command against the app you already copied into `/Applications`.
Do not point it at the mounted DMG or at a broad directory tree.
