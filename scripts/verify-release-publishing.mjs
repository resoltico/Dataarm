#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'release.yml');
const packageJsonPath = path.join(root, 'package.json');
const releasePolicyPath = path.join(root, 'vendor', 'release-publishing.json');
const packagingPolicyPath = path.join(root, 'vendor', 'dmg-packaging.json');
const versionPolicyPath = path.join(root, 'vendor', 'app-version.json');

for (const required of [
  workflowPath,
  packageJsonPath,
  releasePolicyPath,
  packagingPolicyPath,
  versionPolicyPath,
]) {
  if (!fs.existsSync(required)) {
    fail(`missing required file: ${required}`);
  }
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const releasePolicy = JSON.parse(fs.readFileSync(releasePolicyPath, 'utf8'));
const packagingPolicy = JSON.parse(fs.readFileSync(packagingPolicyPath, 'utf8'));
const versionPolicy = JSON.parse(fs.readFileSync(versionPolicyPath, 'utf8'));

const requiredWorkflowSnippets = [
  'name: release',
  'push:',
  "tags:\n      - 'v*'",
  'workflow_dispatch:',
  'runs-on: macos-15',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f',
  'node-version: 26.1.0',
  'dtolnay/rust-toolchain@e97e2d8cc328f1b50210efc529dca0028893a2d9',
  'toolchain: 1.95.0',
  'Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4',
  'Run release posture verification',
  'run: npm run verify:project-status && npm run verify:dmg-packaging && npm run verify:github-packaging && npm run verify:release-publishing && npm run verify:app-version',
  'run: npm run package:unsigned:dmg:macos-silicon',
  'run: node scripts/build-release-checksums.mjs',
  'run: node scripts/publish-github-release.mjs',
  'run: node scripts/verify-github-release.mjs',
  'GH_TOKEN: ${{ github.token }}',
];

for (const snippet of requiredWorkflowSnippets) {
  if (!workflow.includes(snippet)) {
    fail(`release workflow is missing required snippet: ${snippet}`);
  }
}

if (workflow.includes('CARGO_TARGET_DIR:') || workflow.includes('CARGO_BUILD_BUILD_DIR:')) {
  fail('release workflow must not override Cargo artifact directories; use .cargo/config.toml');
}

if (pkg.scripts['verify:release-publishing'] !== 'node scripts/verify-release-publishing.mjs') {
  fail('package.json is missing the expected verify:release-publishing script');
}

if (pkg.scripts['verify:github-release'] !== 'node scripts/verify-github-release.mjs') {
  fail('package.json is missing the expected verify:github-release script');
}

if (releasePolicy.current !== 'github-release-publishing-wired') {
  fail('vendor/release-publishing.json must declare the applied publication state');
}

if (releasePolicy.githubWorkflow !== '.github/workflows/release.yml') {
  fail('vendor/release-publishing.json must point at .github/workflows/release.yml');
}

if (releasePolicy.manualPackagingWorkflow !== packagingPolicy.githubWorkflow) {
  fail('release and packaging policies disagree about the manual packaging workflow');
}

if (releasePolicy.githubRunner !== 'macos-15') {
  fail('vendor/release-publishing.json must pin macos-15');
}

if (releasePolicy.releaseTagPrefix !== 'v') {
  fail('vendor/release-publishing.json must use the v tag prefix');
}

if (releasePolicy.releaseTitleTemplate !== 'Dataarm v{version}') {
  fail('vendor/release-publishing.json must use the maintained release title template');
}

if (releasePolicy.releaseNotesSource !== 'CHANGELOG.md') {
  fail('vendor/release-publishing.json must use CHANGELOG.md as the release-notes source');
}

const expectedAssetTemplates = [
  'Dataarm_{version}_aarch64.dmg',
  'dataarm-{version}-github-packaging-manifest.json',
  'dataarm-{version}-checksums.txt',
];
if (JSON.stringify(releasePolicy.managedAssets) !== JSON.stringify(expectedAssetTemplates)) {
  fail('vendor/release-publishing.json managedAssets drifted from the maintained release contract');
}

const resolvedAssets = expectedAssetTemplates.map((entry) =>
  entry.replaceAll('{version}', versionPolicy.version),
);
if (resolvedAssets[0] !== `Dataarm_${versionPolicy.version}_aarch64.dmg`) {
  fail('release asset template no longer resolves to the expected DMG name');
}

if (releasePolicy.signing !== packagingPolicy.signing) {
  fail('release and packaging policies disagree about signing posture');
}

if (releasePolicy.notarization !== packagingPolicy.notarization) {
  fail('release and packaging policies disagree about notarization posture');
}

console.log('OK: release publishing workflow verified');
