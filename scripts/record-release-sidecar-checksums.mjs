#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const manifest = readJson('vendor/bundle-manifest.json');
const packaging = readJson('vendor/dmg-packaging.json');
const checksumsPath = path.join(
  root,
  'vendor',
  'checksums',
  'expected-upstream-release-checksums.json',
);
const artifacts = {};

for (const dependencyName of ['ffhn', 'htmlcut']) {
  const dependency = manifest.dependencies?.[dependencyName];
  if (!dependency) {
    throw new Error(`Missing dependency manifest entry: ${dependencyName}`);
  }

  const binaryAssetName = `${dependency.binaryBasename}-${packaging.macosTarget}`;
  const checksumAssetName = `${binaryAssetName}.sha256`;
  const checksumUrl = `${normalizeRepoUrl(dependency.repo)}/releases/download/${dependency.ref}/${checksumAssetName}`;
  const checksumText = await downloadText(checksumUrl);
  const sha256 = parseChecksum(checksumText);

  artifacts[dependencyName] = {
    targetTriple: packaging.macosTarget,
    releaseRef: dependency.ref,
    versionLabel: dependency.versionLabel,
    binaryAssetName,
    checksumAssetName,
    sha256,
  };

  console.log(`${dependencyName}: ${sha256}`);
  console.log(`  source: ${checksumUrl}`);
}

const nextChecksums = {
  schemaVersion: 1,
  note: 'Pinned checksum map for the supported Apple Silicon upstream intake. Refresh this file with npm run record:release-sidecar-checksums after the pinned upstream standalone releases are published.',
  artifacts,
};

fs.writeFileSync(checksumsPath, `${JSON.stringify(nextChecksums, null, 2)}\n`);
console.log(`Wrote ${checksumsPath}`);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function normalizeRepoUrl(repoUrl) {
  return repoUrl.replace(/\/+$/, '').replace(/\.git$/, '');
}

async function downloadText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ffhn-desktop-sidecar-checksum-recorder',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}. Publish the pinned upstream standalone release assets first.`,
    );
  }

  return response.text();
}

function parseChecksum(content) {
  const firstLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    throw new Error('Checksum file was empty.');
  }

  const [sha] = firstLine.split(/\s+/u);
  if (!/^[a-f0-9]{64}$/u.test(sha)) {
    throw new Error(`Invalid sha256 content: ${firstLine}`);
  }

  return sha;
}
