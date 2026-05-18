# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-18

### Added

- Guided target authoring for HTTP and file watches, with backend-owned draft sessions instead of raw-TOML-first creation.
- Preview inspection workbench tabs for rendered fragments, compare payloads, and extraction records sourced from canonical runtime artifacts.
- Inventory search and grouping controls for the target table.
- A repeatable backend field-test matrix for guided targets, local fixture servers, and optional live-web release shakeouts.

### Changed

- Draft preview now offers a direct save action, so operators can validate and persist a target without leaving the inspection flow.
- Draft preview now materializes disposable snapshot artifacts for the inspection workbench, so rendered, compare, and extraction tabs are backed by the real runtime contract even though `ffhn-core` dry-run is non-persisting.
- Guided `nth` selection is now called out as a 1-based contract in the editor and extraction workbench.
- Workspace run counts and batch execution now derive from truly runnable target identities instead of treating every displayable `target_id` as executable.
- Browser and unit test coverage now exercises the guided authoring flow rather than the retired raw-editor-first path.

## [0.1.0] - 2026-05-18

### Added

- Initial release.
