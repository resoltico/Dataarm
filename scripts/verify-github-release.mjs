#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { readAppVersionContract } from './lib/app-version.mjs';
import { repoRoot } from './lib/artifact-roots.mjs';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function renderTemplate(template, version) {
  return String(template).replaceAll('{version}', version);
}

function runGh(args) {
  const result = spawnSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

const releasePolicy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'vendor', 'release-publishing.json'), 'utf8'),
);
const versionContract = readAppVersionContract();
const expectedTag = `${releasePolicy.releaseTagPrefix}${versionContract.version}`;
const releaseTag =
  process.argv[2] ?? process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? expectedTag;

if (releaseTag !== expectedTag) {
  fail(`release tag ${releaseTag} does not match the canonical version ${expectedTag}`);
}

if (!process.env.GH_TOKEN) {
  fail('GH_TOKEN must be set before verifying a GitHub release');
}

const publishedRelease = JSON.parse(
  runGh(['release', 'view', releaseTag, '--json', 'tagName,isDraft,isPrerelease,url,assets']),
);

if (publishedRelease.tagName !== releaseTag) {
  fail(`expected release tag ${releaseTag}, got ${String(publishedRelease.tagName)}`);
}

if (publishedRelease.isDraft) {
  fail(`GitHub release ${releaseTag} is still a draft`);
}

if (publishedRelease.isPrerelease) {
  fail(`GitHub release ${releaseTag} is marked prerelease`);
}

const expectedAssets = releasePolicy.managedAssets.map((entry) =>
  renderTemplate(entry, versionContract.version),
);
const actualAssets = new Set((publishedRelease.assets ?? []).map((asset) => asset.name));

for (const requiredAsset of expectedAssets) {
  if (!actualAssets.has(requiredAsset)) {
    fail(`GitHub release ${releaseTag} is missing required asset ${requiredAsset}`);
  }
}

console.log(`OK: verified GitHub release handoff for ${releaseTag} at ${publishedRelease.url}`);
