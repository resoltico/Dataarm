import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'package-unsigned-macos.yml');
const packageJsonPath = path.join(root, 'package.json');
const posturePath = path.join(root, 'vendor', 'dmg-packaging.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const required of [workflowPath, packageJsonPath, posturePath]) {
  if (!fs.existsSync(required)) fail(`missing required file: ${required}`);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const posture = JSON.parse(fs.readFileSync(posturePath, 'utf8'));

const requiredWorkflowSnippets = [
  'name: package-unsigned-macos',
  'workflow_dispatch:',
  'runs-on: macos-15',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f',
  'dtolnay/rust-toolchain@e97e2d8cc328f1b50210efc529dca0028893a2d9',
  'Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4',
  'Install frontend dependencies',
  'run: npm ci',
  'run: npm run verify:project-status && npm run verify:dmg-packaging && npm run verify:github-packaging',
  'Fetch pinned upstream sidecars',
  'run: npm run fetch:release-sidecars',
  'run: npm run package:unsigned:dmg:macos-silicon',
  'actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f',
  'src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/FFHN_*.dmg',
  'src-tauri/target/ci-artifacts/github-packaging-manifest.json',
];

for (const snippet of requiredWorkflowSnippets) {
  if (!workflow.includes(snippet)) fail(`workflow is missing required snippet: ${snippet}`);
}

if (pkg.scripts['verify:github-packaging'] !== 'node scripts/verify-github-packaging.mjs') {
  fail('package.json is missing the expected verify:github-packaging script');
}

if (
  pkg.scripts['package:unsigned:dmg:macos-silicon'] !==
  'npm run verify:dmg-packaging && npm run tauri:build:dmg:macos-silicon && node scripts/collect-github-packaging-artifacts.mjs'
) {
  fail('package.json is missing the expected package:unsigned:dmg:macos-silicon script');
}

if (posture.githubWorkflow !== '.github/workflows/package-unsigned-macos.yml') {
  fail('vendor/dmg-packaging.json must point at the GitHub packaging workflow');
}

if (posture.githubRunner !== 'macos-15') fail('vendor/dmg-packaging.json must pin macos-15');
if (posture.githubArtifactName !== 'ffhn-unsigned-macos-apple-silicon-dmg') {
  fail('vendor/dmg-packaging.json must pin the GitHub artifact name');
}

if (
  posture.githubArtifactManifest !== 'src-tauri/target/ci-artifacts/github-packaging-manifest.json'
) {
  fail('vendor/dmg-packaging.json must declare the GitHub artifact manifest path');
}

if (posture.signing !== 'disabled') fail('GitHub packaging posture must remain unsigned');
if (posture.notarization !== 'disabled') fail('GitHub packaging posture must remain unnotarized');

console.log('OK: GitHub packaging workflow verified');
