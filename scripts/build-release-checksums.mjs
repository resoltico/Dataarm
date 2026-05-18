#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readAppVersion } from './lib/app-version.mjs';
import {
  dmgOutputRoot,
  ensureManagedRootById,
  repoRelativePath,
  repoRoot,
} from './lib/hygiene.mjs';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function renderTemplate(template, version) {
  return String(template).replaceAll('{version}', version);
}

function sha256For(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const version = readAppVersion();
const releasePolicy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'vendor', 'release-publishing.json'), 'utf8'),
);
const packagingPolicy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'vendor', 'dmg-packaging.json'), 'utf8'),
);

if (releasePolicy.current !== 'github-release-publishing-wired') {
  fail(`Unexpected release publishing state: ${String(releasePolicy.current)}`);
}

const [dmgAssetName, manifestAssetName, checksumAssetName] = releasePolicy.managedAssets.map(
  (entry) => renderTemplate(entry, version),
);
const dmgPath = path.join(dmgOutputRoot(packagingPolicy.macosTarget), dmgAssetName);
const manifestSourcePath = path.resolve(repoRoot, packagingPolicy.githubArtifactManifest);
const ciArtifactsRoot = ensureManagedRootById('managed-ci-artifacts');
const manifestAssetPath = path.join(ciArtifactsRoot, manifestAssetName);
const checksumAssetPath = path.join(ciArtifactsRoot, checksumAssetName);

for (const requiredFile of [dmgPath, manifestSourcePath]) {
  if (!fs.existsSync(requiredFile)) {
    fail(`missing required release asset input: ${repoRelativePath(requiredFile)}`);
  }
}

fs.copyFileSync(manifestSourcePath, manifestAssetPath);

const checksumLines = [
  `${sha256For(dmgPath)}  ${path.basename(dmgPath)}`,
  `${sha256For(manifestAssetPath)}  ${path.basename(manifestAssetPath)}`,
];
fs.writeFileSync(checksumAssetPath, `${checksumLines.join('\n')}\n`);

console.log(`OK: release assets prepared in ${repoRelativePath(ciArtifactsRoot)}`);
console.log(`- ${repoRelativePath(dmgPath)}`);
console.log(`- ${repoRelativePath(manifestAssetPath)}`);
console.log(`- ${repoRelativePath(checksumAssetPath)}`);
