#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const validators = [
  'verify-bundle-manifest.mjs',
  'verify-upstream-intake.mjs',
  'verify-hydrated-bundle.mjs',
  'verify-real-binary-activation.mjs',
  'verify-packaged-execution-proof.mjs',
  'verify-release-readiness.mjs',
];

for (const script of validators) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function listFiles(baseDir) {
  const entries = [];

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    const absolutePath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      for (const child of listFiles(absolutePath)) {
        entries.push(path.posix.join(entry.name, child.split(path.sep).join('/')));
      }
      continue;
    }

    entries.push(entry.name);
  }

  return entries.sort();
}

const expectedSurfaces = [
  {
    label: 'scripts',
    baseDir: path.join(root, 'scripts'),
    files: [
      'README.md',
      'collect-github-packaging-artifacts.mjs',
      'fetch-release-sidecars.mjs',
      'prepare-first-platform-real-binaries.mjs',
      'prepare-real-sidecars.mjs',
      'record-release-sidecar-checksums.mjs',
      'sync-local-sidecars.mjs',
      'verify-bundle-manifest.mjs',
      'verify-dmg-packaging.mjs',
      'verify-github-packaging.mjs',
      'verify-hydrated-bundle.mjs',
      'verify-packaged-execution-proof.mjs',
      'verify-project-status.mjs',
      'verify-quality-gates.mjs',
      'verify-real-binary-activation.mjs',
      'verify-release-readiness.mjs',
      'verify-tooling-refresh.mjs',
      'verify-upstream-intake.mjs',
    ],
  },
  {
    label: 'vendor',
    baseDir: path.join(root, 'vendor'),
    files: [
      'README.md',
      'bundle-manifest.json',
      'checksums/activated-first-platform-binaries.json',
      'checksums/expected-upstream-release-checksums.json',
      'checksums/first-platform-packaged-proof-receipt.json',
      'checksums/release-readiness-receipt.json',
      'dmg-packaging.json',
      'packaged-execution-proof.json',
      'quality-gates.json',
      'real-binary-activation.json',
      'release-readiness.json',
      'tooling-refresh.json',
      'upstream-intake.json',
      'upstream/ffhn/README.md',
      'upstream/htmlcut/README.md',
      'upstream/receipts/README.md',
    ],
  },
  {
    label: 'src-tauri/binaries',
    baseDir: path.join(root, 'src-tauri', 'binaries'),
    files: [
      'README.md',
      'dev-fixtures/ffhn-fixture.py',
      'dev-fixtures/htmlcut-fixture.py',
      'ffhn-aarch64-apple-darwin',
      'htmlcut-aarch64-apple-darwin',
    ],
  },
];

for (const surface of expectedSurfaces) {
  const actualFiles = listFiles(surface.baseDir);
  const expectedFiles = [...surface.files].sort();

  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `${surface.label} surface is out of sync.\nExpected:\n${expectedFiles.join(
        '\n',
      )}\n\nActual:\n${actualFiles.join('\n')}`,
    );
  }
}

console.log('project-status: ok');
