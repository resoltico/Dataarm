import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const intakePath = path.join(repo, 'vendor', 'upstream-intake.json');
const packagingPath = path.join(repo, 'vendor', 'dmg-packaging.json');
const manifestPath = path.join(repo, 'vendor', 'bundle-manifest.json');
const checksumsPath = path.join(
  repo,
  'vendor',
  'checksums',
  'expected-upstream-release-checksums.json',
);

const failures = [];
if (!fs.existsSync(intakePath)) failures.push('Missing vendor/upstream-intake.json');
if (!fs.existsSync(checksumsPath))
  failures.push('Missing vendor/checksums/expected-upstream-release-checksums.json');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const intake = JSON.parse(fs.readFileSync(intakePath, 'utf8'));
const packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));

if (
  intake.current !== 'fixture-backed-bundle-inputs' &&
  intake.current !== 'real-upstream-intake'
) {
  failures.push(`Unexpected intake current state: ${intake.current}`);
}

if (intake.firstSupportedPlatform?.targetTriple !== packaging.macosTarget) {
  failures.push('upstream-intake target triple must match vendor/dmg-packaging.json');
}

const expectedArtifacts = {
  ffhn: [`ffhn-${packaging.macosTarget}`, `ffhn-${packaging.macosTarget}.sha256`],
  htmlcut: [`htmlcut-${packaging.macosTarget}`, `htmlcut-${packaging.macosTarget}.sha256`],
};

for (const key of ['ffhn', 'htmlcut']) {
  const checksumEntry = checksums.artifacts?.[key];

  if (JSON.stringify(intake.expectedArtifacts?.[key]) !== JSON.stringify(expectedArtifacts[key])) {
    failures.push(`upstream-intake expectedArtifacts.${key} is out of sync`);
  }

  if (checksumEntry?.targetTriple !== packaging.macosTarget) {
    failures.push(`expected-upstream-release-checksums ${key} targetTriple is out of sync`);
  }

  if (typeof checksumEntry?.sha256 !== 'string' || !checksumEntry.sha256) {
    failures.push(`expected-upstream-release-checksums ${key} sha256 must be present`);
  }

  if (checksumEntry?.releaseRef !== manifest.dependencies?.[key]?.ref) {
    failures.push(`expected-upstream-release-checksums ${key} releaseRef is out of sync`);
  }

  if (checksumEntry?.versionLabel !== manifest.dependencies?.[key]?.versionLabel) {
    failures.push(`expected-upstream-release-checksums ${key} versionLabel is out of sync`);
  }

  if (checksumEntry?.binaryAssetName !== expectedArtifacts[key][0]) {
    failures.push(`expected-upstream-release-checksums ${key} binaryAssetName is out of sync`);
  }

  if (checksumEntry?.checksumAssetName !== expectedArtifacts[key][1]) {
    failures.push(`expected-upstream-release-checksums ${key} checksumAssetName is out of sync`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Upstream intake scaffold looks coherent.');
