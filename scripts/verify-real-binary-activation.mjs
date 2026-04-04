import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const activationPath = path.join(repo, 'vendor', 'real-binary-activation.json');
const packagingPath = path.join(repo, 'vendor', 'dmg-packaging.json');
const receiptPath = path.join(
  repo,
  'vendor',
  'checksums',
  'activated-first-platform-binaries.json',
);
const failures = [];

if (!fs.existsSync(activationPath)) failures.push('Missing vendor/real-binary-activation.json');
if (!fs.existsSync(receiptPath))
  failures.push('Missing vendor/checksums/activated-first-platform-binaries.json');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
const packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));

if (
  ![
    'fixture-backed-bundle-inputs',
    'ready-for-real-first-platform',
    'activated-real-first-platform',
  ].includes(activation.current)
) {
  failures.push(`Unexpected activation current state: ${activation.current}`);
}

if (activation.firstSupportedPlatform?.targetTriple !== packaging.macosTarget) {
  failures.push('real-binary-activation target triple must match vendor/dmg-packaging.json');
}

for (const [key, expectedFile] of Object.entries({
  ffhn: `ffhn-${packaging.macosTarget}`,
  htmlcut: `htmlcut-${packaging.macosTarget}`,
})) {
  if (receipt.targetTriple !== packaging.macosTarget) {
    failures.push('activation receipt targetTriple must match vendor/dmg-packaging.json');
  }

  if (receipt.artifacts?.[key]?.file !== expectedFile) {
    failures.push(`activation receipt ${key} file is out of sync`);
  }

  if (!receipt.artifacts?.[key]?.sha256) {
    failures.push(`activation receipt ${key} sha256 is incomplete`);
  }

  if (receipt.artifacts?.[key]?.sha256?.includes('REPLACE_')) {
    failures.push(`activation receipt ${key} must not use placeholder sha256 values`);
  }
}

if (!activation.activationReceiptPresent) {
  failures.push('Activation receipt is incomplete.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Real-binary activation scaffold looks coherent.');
