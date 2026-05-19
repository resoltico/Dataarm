#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
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

const textFileExtensions = new Set([
  '.css',
  '.html',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.rs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const ignoredScanDirectories = new Set([
  '.dataarm-artifacts',
  '.git',
  'dist',
  'node_modules',
  'target',
]);

function isScannableTextFile(absolutePath) {
  const basename = path.basename(absolutePath);
  if (
    basename === '.gitattributes' ||
    basename === '.gitignore' ||
    basename === '.mise.toml' ||
    basename === 'AGENTS.md'
  ) {
    return true;
  }

  return textFileExtensions.has(path.extname(absolutePath));
}

function listScannableTextFiles(baseDir) {
  const files = [];
  const pending = [baseDir];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredScanDirectories.has(entry.name)) {
          pending.push(absolutePath);
        }
        continue;
      }

      if (isScannableTextFile(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  files.sort();
  return files;
}

const requiredRootFiles = [
  '.github/dependabot.yml',
  '.github/workflows/package-adhoc-signed-macos.yml',
  '.github/workflows/quality-gates.yml',
  '.github/workflows/release.yml',
  '.mise.toml',
  'AGENTS.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'NOTICE',
  'PATENTS.md',
  'README.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/developer-guide.md',
  'docs/hygiene.md',
  'docs/installing-macos.md',
  'docs/release-publishing.md',
  'docs/release-protocol.md',
  'scripts/README.md',
  'src-tauri/README.md',
  'tests/README.md',
  'vendor/README.md',
  'vendor/app-version.json',
  'vendor/dmg-packaging.json',
  'vendor/quality-gates.json',
  'vendor/release-publishing.json',
  'vendor/runtime-dependencies.json',
  'vendor/tooling-refresh.json',
  'vitest.config.ts',
];

for (const relativePath of requiredRootFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`missing required maintained file: ${relativePath}`);
  }
}

const retiredPaths = [
  'RELEASE_PROTOCOL.md',
  'src-tauri/binaries',
  'vendor/bundle-manifest.json',
  'vendor/checksums',
  'vendor/packaged-execution-proof.json',
  'vendor/real-binary-activation.json',
  'vendor/release-readiness.json',
  'vendor/upstream',
  'vendor/upstream-intake.json',
];

for (const relativePath of retiredPaths) {
  if (fs.existsSync(path.join(root, relativePath))) {
    fail(`retired sidecar-era path must be absent: ${relativePath}`);
  }
}

const expectedSurfaces = [
  {
    label: 'scripts',
    baseDir: path.join(root, 'scripts'),
    files: [
      'README.md',
      'browser-workbench/constants.mjs',
      'browser-workbench/fixtures.mjs',
      'browser-workbench/notifications.mjs',
      'browser-workbench/rust-bridge.mjs',
      'browser-workbench/vite-plugin.mjs',
      'browser-workbench/vite-plugin.mjs.d.ts',
      'build-release-checksums.mjs',
      'lib/app-version.mjs',
      'clean-hygiene.mjs',
      'collect-github-packaging-artifacts.mjs',
      'lib/artifact-roots.d.mts',
      'lib/artifact-roots.mjs',
      'lib/gh-auth.mjs',
      'lib/hygiene.mjs',
      'lib/release-notes.mjs',
      'publish-github-release.mjs',
      'report-hygiene.mjs',
      'run-miri.mjs',
      'run-playwright-tests.mjs',
      'run-vite-browser-workbench.mjs',
      'run-vitest-browser-workbench.mjs',
      'sync-app-version.mjs',
      'verify-app-version.mjs',
      'verify-dmg-packaging.mjs',
      'verify-frontend-coverage.mjs',
      'verify-github-release.mjs',
      'verify-github-packaging.mjs',
      'verify-hygiene.mjs',
      'verify-project-status.mjs',
      'verify-quality-gates.mjs',
      'verify-release-publishing.mjs',
      'verify-runtime-dependencies.mjs',
      'verify-tooling-refresh.mjs',
    ],
  },
  {
    label: 'vendor',
    baseDir: path.join(root, 'vendor'),
    files: [
      'README.md',
      'app-version.json',
      'dmg-packaging.json',
      'quality-gates.json',
      'release-publishing.json',
      'runtime-dependencies.json',
      'tooling-refresh.json',
      'workbench-fixtures/demo-release-notes.html',
      'workbench-fixtures/demo-release-notes.target.toml',
      'workbench-fixtures/demo-status-board.html',
      'workbench-fixtures/demo-status-board.target.toml',
      'workbench-fixtures/file-target-template.toml',
      'workbench-fixtures/http-target-template.toml',
    ],
  },
];

for (const surface of expectedSurfaces) {
  const actualFiles = listFiles(surface.baseDir);
  const expectedFiles = [...surface.files].sort();

  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail(
      `${surface.label} surface is out of sync.\nExpected:\n${expectedFiles.join(
        '\n',
      )}\n\nActual:\n${actualFiles.join('\n')}`,
    );
  }
}

const retiredScripts = [
  'fetch:release-sidecars',
  'prepare:first-platform-real-binaries',
  'prepare:real-sidecars',
  'record:release-sidecar-checksums',
  'sync-sidecars',
  'verify:bundle-manifest',
  'verify:hydrated-bundle',
  'verify:packaged-execution-proof',
  'verify:real-binary-activation',
  'verify:release-readiness',
  'verify:upstream-intake',
];

for (const scriptName of retiredScripts) {
  if (scriptName in pkg.scripts) {
    fail(`retired package script must be absent: ${scriptName}`);
  }
}

const retiredBrandingTokens = [
  '.ffhn-desktop',
  'FFHN Desktop',
  'ffhn-desktop',
  'resoltico/ffhn-desktop',
];
const retiredBrandingMatches = [];

for (const absolutePath of listScannableTextFiles(root)) {
  if (path.relative(root, absolutePath) === 'scripts/verify-project-status.mjs') {
    continue;
  }
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of retiredBrandingTokens) {
    if (content.includes(token)) {
      retiredBrandingMatches.push(
        `${path.relative(root, absolutePath).split(path.sep).join('/')}: contains ${token}`,
      );
    }
  }
}

if (retiredBrandingMatches.length > 0) {
  fail(`retired ffhn-desktop branding must be absent.\n${retiredBrandingMatches.join('\n')}`);
}

console.log('project-status: ok');
