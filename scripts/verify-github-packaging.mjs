import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'package-adhoc-signed-macos.yml');
const packageJsonPath = path.join(root, 'package.json');
const posturePath = path.join(root, 'vendor', 'dmg-packaging.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const required of [workflowPath, packageJsonPath, posturePath]) {
  if (!fs.existsSync(required)) {
    fail(`missing required file: ${required}`);
  }
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const posture = JSON.parse(fs.readFileSync(posturePath, 'utf8'));
const expectedDmgGlob = `${posture.localOutputDirectory}/Dataarm_*.dmg`;

const requiredWorkflowSnippets = [
  'name: package-adhoc-signed-macos',
  'workflow_dispatch:',
  'runs-on: macos-15',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f',
  'node-version: 26.1.0',
  'dtolnay/rust-toolchain@e97e2d8cc328f1b50210efc529dca0028893a2d9',
  'toolchain: 1.95.0',
  'Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4',
  'Install frontend dependencies',
  'run: npm ci',
  'Run packaging posture verification',
  'run: npm run verify:project-status && npm run verify:dmg-packaging && npm run verify:github-packaging',
  'run: npm run package:adhoc-signed:dmg:macos-silicon',
  'actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f',
  expectedDmgGlob,
  posture.githubArtifactManifest,
  posture.githubArtifactName,
];

for (const snippet of requiredWorkflowSnippets) {
  if (!workflow.includes(snippet)) {
    fail(`workflow is missing required snippet: ${snippet}`);
  }
}

if (workflow.includes('fetch:release-sidecars')) {
  fail('workflow must not fetch sidecars for the embedded runtime');
}

if (workflow.includes('\n  push:\n')) {
  fail(
    'package-adhoc-signed-macos must stay manual-only; tag publication belongs to .github/workflows/release.yml',
  );
}

if (workflow.includes('CARGO_TARGET_DIR:') || workflow.includes('CARGO_BUILD_BUILD_DIR:')) {
  fail(
    'package-adhoc-signed-macos workflow must not override Cargo artifact directories; use .cargo/config.toml',
  );
}

if (pkg.scripts['verify:github-packaging'] !== 'node scripts/verify-github-packaging.mjs') {
  fail('package.json is missing the expected verify:github-packaging script');
}

if (
  pkg.scripts['package:adhoc-signed:dmg:macos-silicon'] !==
  'npm run hygiene:clean:safe && npm run verify:app-version && npm run verify:dmg-packaging && npm run verify:github-packaging && npm run tauri:build:dmg:macos-silicon && node scripts/collect-github-packaging-artifacts.mjs && npm run hygiene:verify'
) {
  fail('package.json is missing the expected package:adhoc-signed:dmg:macos-silicon script');
}

if (posture.githubWorkflow !== '.github/workflows/package-adhoc-signed-macos.yml') {
  fail('vendor/dmg-packaging.json must point at the GitHub packaging workflow');
}

if (posture.githubRunner !== 'macos-15') {
  fail('vendor/dmg-packaging.json must pin macos-15');
}
if (posture.githubArtifactName !== 'dataarm-ad-hoc-signed-macos-apple-silicon-dmg') {
  fail('vendor/dmg-packaging.json must pin the GitHub artifact name');
}

if (!posture.githubArtifactManifest.startsWith('../.dataarm-artifacts/')) {
  fail('vendor/dmg-packaging.json must declare the managed sibling artifact manifest path');
}

if (!posture.localOutputDirectory.startsWith('../.dataarm-artifacts/')) {
  fail('vendor/dmg-packaging.json must declare the managed sibling DMG output directory');
}

if (posture.signing !== 'ad-hoc') {
  fail('GitHub packaging posture must remain ad-hoc signed');
}
if (posture.notarization !== 'disabled') {
  fail('GitHub packaging posture must remain unnotarized');
}

console.log('OK: GitHub packaging workflow verified');
