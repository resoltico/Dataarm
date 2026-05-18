# Patent Notes

Dataarm's own code is licensed under the MIT License, which does not include an
explicit patent grant or patent retaliation clause.

## Dependency patent posture

Dataarm's maintained Rust and npm dependency surfaces include licenses with
different patent terms. The exact inventory for a given release lives in
[NOTICE](./NOTICE), [src-tauri/Cargo.lock](./src-tauri/Cargo.lock), and
[package-lock.json](./package-lock.json).

Two license families currently present in the maintained surface are important
to call out explicitly:

- `Apache-2.0` includes an explicit patent grant from contributors to their
  contributions under Section 3.
- `MPL-2.0` includes a patent grant scoped to the covered files under Section
  2.1.

Other license families present in the maintained dependency surface are
permissive or data/content licenses with their own terms. This repository does
not try to restate all of those patent implications in prose; consult the
underlying license texts for the exact grant scope.

## Repository-level patent posture

This repository does not publish a separate project-level patent license,
retaliation clause, or patent non-assert covenant beyond:

- Dataarm's own MIT license
- whatever patent terms are present in the third-party dependency licenses that
  apply to the shipped release

If a stronger project-level patent covenant is desired, it must be added
explicitly. It should not be inferred from this note alone.

## Legal disclaimer

This document is informational only and does not constitute legal advice. For
patent-related questions, consult qualified legal counsel.
