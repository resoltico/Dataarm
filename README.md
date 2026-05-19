# Dataarm

Dataarm is a macOS desktop app for watching the exact part of a website you care about.
Instead of telling you that an entire page changed, it helps you track one specific part, save a reference version, and inspect what changed over time.

## What It Helps You Do

- Watch a product page section for price or availability changes
- Track release notes, status pages, documentation sections, or policy text
- Focus on one meaningful fragment instead of noisy full-page diffs
- Review the saved reference, recent history, and change details in one desktop app

## Why People Use It

- Less noise: monitor the part of the page that matters, not the whole page shell
- More confidence: preview the extraction before saving a watch
- Better traceability: keep retained history and inspect past snapshots and compare output
- Local control: your watch library lives on disk, not in a hosted monitoring service

## What Dataarm Does Today

Dataarm lets you:

- open or create a local watch library
- add and edit website watches
- preview the page section a watch will follow
- check one watch or all watches on demand
- inspect watch status, recent checks, retained history, and saved change details

## Current Product Shape

Dataarm is for people who want a precise desktop website watcher rather than a generic browser bookmark tool.
It is strongest when you already know the page section you want to monitor and you care about reliable, inspectable change tracking.

Current builds target Apple Silicon macOS.

## Install On macOS

Download the current DMG from the GitHub release page, open it, and drag `Dataarm.app` into `/Applications`.

Current public builds are ad-hoc signed but not yet notarized by Apple.
If macOS blocks the first launch, use Finder `Open` or `System Settings` -> `Privacy & Security` -> `Open Anyway` before falling back to terminal commands.

The maintained first-launch steps live in [docs/installing-macos.md](./docs/installing-macos.md).

## Learn More

- [Documentation index](./docs/README.md)
- [Contributing guide](./CONTRIBUTING.md)

For contributors and repository maintenance, start with [docs/developer-guide.md](./docs/developer-guide.md).

## Legal

Dataarm is released under the [MIT License](./LICENSE). See [NOTICE](./NOTICE)
and [PATENTS](./PATENTS.md) for dependency attributions and patent posture.
