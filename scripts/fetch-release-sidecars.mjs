#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EXECUTABLE_MODE = 0o755;

const root = path.resolve(new URL('..', import.meta.url).pathname);
const manifest = readJson('vendor/bundle-manifest.json');
const packaging = readJson('vendor/dmg-packaging.json');
const expectedChecksums = readJson('vendor/checksums/expected-upstream-release-checksums.json');
const binariesDir = path.join(root, 'src-tauri', 'binaries');

await fs.promises.mkdir(binariesDir, { recursive: true });

for (const dependencyName of ['ffhn', 'htmlcut']) {
  const dependency = manifest.dependencies?.[dependencyName];
  if (!dependency) {
    throw new Error(`Missing dependency manifest entry: ${dependencyName}`);
  }

  const checksumEntry = expectedChecksums.artifacts?.[dependencyName];
  const expectedSha = checksumEntry?.sha256;
  if (typeof expectedSha !== 'string' || !expectedSha || expectedSha.startsWith('<')) {
    throw new Error(
      `Expected checksum for ${dependencyName} is still a placeholder. Run npm run record:release-sidecar-checksums after publishing the pinned upstream sidecar, then try again.`,
    );
  }

  const assetName = `${dependency.binaryBasename}-${packaging.macosTarget}`;
  const checksumAssetName = `${assetName}.sha256`;

  if (checksumEntry?.targetTriple !== packaging.macosTarget) {
    throw new Error(
      `${dependencyName} checksum receipt targetTriple mismatch. Expected ${packaging.macosTarget}, got ${checksumEntry?.targetTriple}.`,
    );
  }

  if (checksumEntry?.releaseRef !== dependency.ref) {
    throw new Error(
      `${dependencyName} checksum receipt releaseRef mismatch. Expected ${dependency.ref}, got ${checksumEntry?.releaseRef}. Re-run npm run record:release-sidecar-checksums.`,
    );
  }

  if (checksumEntry?.versionLabel !== dependency.versionLabel) {
    throw new Error(
      `${dependencyName} checksum receipt versionLabel mismatch. Expected ${dependency.versionLabel}, got ${checksumEntry?.versionLabel}. Re-run npm run record:release-sidecar-checksums.`,
    );
  }

  if (checksumEntry?.binaryAssetName !== assetName) {
    throw new Error(
      `${dependencyName} checksum receipt binaryAssetName mismatch. Expected ${assetName}, got ${checksumEntry?.binaryAssetName}. Re-run npm run record:release-sidecar-checksums.`,
    );
  }

  if (checksumEntry?.checksumAssetName !== checksumAssetName) {
    throw new Error(
      `${dependencyName} checksum receipt checksumAssetName mismatch. Expected ${checksumAssetName}, got ${checksumEntry?.checksumAssetName}. Re-run npm run record:release-sidecar-checksums.`,
    );
  }

  const releaseBaseUrl = `${normalizeRepoUrl(dependency.repo)}/releases/download/${dependency.ref}`;
  const binaryUrl = `${releaseBaseUrl}/${assetName}`;
  const checksumUrl = `${releaseBaseUrl}/${checksumAssetName}`;
  const checksumText = await downloadText(checksumUrl);
  const upstreamSha = parseChecksum(checksumText);

  if (upstreamSha !== expectedSha) {
    throw new Error(
      `${dependencyName} upstream checksum mismatch. Expected ${expectedSha} from vendor/checksums, got ${upstreamSha} from ${checksumUrl}.`,
    );
  }

  const binary = await downloadBinary(binaryUrl);
  const actualSha = createHash('sha256').update(binary).digest('hex');

  if (actualSha !== expectedSha) {
    throw new Error(
      `${dependencyName} binary checksum mismatch. Expected ${expectedSha}, computed ${actualSha} from ${binaryUrl}.`,
    );
  }

  const destination = path.join(binariesDir, assetName);
  fs.writeFileSync(destination, binary);
  fs.chmodSync(destination, EXECUTABLE_MODE);

  console.log(`${dependencyName}: verified ${dependency.ref}`);
  console.log(`  source: ${binaryUrl}`);
  console.log(`  dest:   ${destination}`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function normalizeRepoUrl(repoUrl) {
  return repoUrl.replace(/\/+$/, '').replace(/\.git$/, '');
}

async function downloadBinary(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ffhn-desktop-sidecar-fetcher',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function downloadText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ffhn-desktop-sidecar-fetcher',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
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
