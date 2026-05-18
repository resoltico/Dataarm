#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { readAppVersionContract } from './lib/app-version.mjs';
import {
  dmgOutputRoot,
  managedCiArtifactsRoot,
  repoRelativePath,
  repoRoot,
} from './lib/artifact-roots.mjs';
import { changelogSectionFor } from './lib/release-notes.mjs';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function renderTemplate(template, version) {
  return String(template).replaceAll('{version}', version);
}

function runGh(args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: process.env,
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (capture && result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (!allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

const releasePolicy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'vendor', 'release-publishing.json'), 'utf8'),
);
const packagingPolicy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'vendor', 'dmg-packaging.json'), 'utf8'),
);
const versionContract = readAppVersionContract();
const releaseTag =
  process.argv[2] ??
  process.env.RELEASE_TAG ??
  `${releasePolicy.releaseTagPrefix}${versionContract.version}`;
const expectedTag = `${releasePolicy.releaseTagPrefix}${versionContract.version}`;

if (releasePolicy.current !== 'github-release-publishing-wired') {
  fail(`Unexpected release publishing state: ${String(releasePolicy.current)}`);
}

if (releaseTag !== expectedTag) {
  fail(`release tag ${releaseTag} does not match the canonical version ${expectedTag}`);
}

if (!process.env.GH_TOKEN) {
  fail('GH_TOKEN must be set before publishing a GitHub release');
}

const [dmgAssetName, manifestAssetName, checksumAssetName] = releasePolicy.managedAssets.map(
  (entry) => renderTemplate(entry, versionContract.version),
);
const releaseTitle = renderTemplate(releasePolicy.releaseTitleTemplate, versionContract.version);
const dmgAssetPath = path.join(dmgOutputRoot(packagingPolicy.macosTarget), dmgAssetName);
const manifestAssetPath = path.join(managedCiArtifactsRoot(), manifestAssetName);
const checksumAssetPath = path.join(managedCiArtifactsRoot(), checksumAssetName);

for (const requiredFile of [dmgAssetPath, manifestAssetPath, checksumAssetPath]) {
  if (!fs.existsSync(requiredFile)) {
    fail(`missing required GitHub release asset: ${repoRelativePath(requiredFile)}`);
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataarm-release-'));
const notesPath = path.join(tempDir, 'release-notes.md');
try {
  fs.writeFileSync(notesPath, `${changelogSectionFor(versionContract.version)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

try {
  const existingRelease = runGh(['release', 'view', releaseTag, '--json', 'isDraft,assets,url'], {
    capture: true,
    allowFailure: true,
  });

  if (existingRelease.status !== 0) {
    runGh([
      'release',
      'create',
      releaseTag,
      '--draft',
      '--verify-tag',
      '--title',
      releaseTitle,
      '--notes-file',
      notesPath,
    ]);
  } else {
    const parsed = JSON.parse(existingRelease.stdout);
    if (!parsed.isDraft) {
      fail(
        `GitHub release ${releaseTag} is already published. Refusing to mutate a published release object.`,
      );
    }
  }

  runGh([
    'release',
    'upload',
    releaseTag,
    dmgAssetPath,
    manifestAssetPath,
    checksumAssetPath,
    '--clobber',
  ]);

  runGh([
    'release',
    'edit',
    releaseTag,
    '--draft=false',
    '--latest',
    '--title',
    releaseTitle,
    '--notes-file',
    notesPath,
  ]);

  const publishedRelease = JSON.parse(
    runGh(['release', 'view', releaseTag, '--json', 'isDraft,assets,url'], { capture: true })
      .stdout,
  );

  if (publishedRelease.isDraft) {
    fail(`GitHub release ${releaseTag} is still a draft after publication`);
  }

  const assetNames = new Set((publishedRelease.assets ?? []).map((asset) => asset.name));
  for (const requiredAsset of [dmgAssetName, manifestAssetName, checksumAssetName]) {
    if (!assetNames.has(requiredAsset)) {
      fail(`GitHub release ${releaseTag} is missing required asset ${requiredAsset}`);
    }
  }

  console.log(`OK: published ${releaseTag} at ${publishedRelease.url}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
