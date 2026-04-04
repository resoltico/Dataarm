#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'vendor', 'packaged-execution-proof.json');
const packagingPath = path.join(root, 'vendor', 'dmg-packaging.json');
const receiptPath = path.join(
  root,
  'vendor',
  'checksums',
  'first-platform-packaged-proof-receipt.json',
);

const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};

if (!fs.existsSync(manifestPath)) fail('Missing packaged-execution-proof.json');
if (!fs.existsSync(receiptPath)) fail('Missing packaged proof receipt placeholder');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));

if (
  ![
    'awaiting-real-packaged-proof',
    'fixture-backed-packaged-proof',
    'real-packaged-proof',
  ].includes(manifest.current)
) {
  fail('Unexpected packaged proof posture');
}

if (manifest.firstSupportedPlatform?.targetTriple !== packaging.macosTarget) {
  fail('packaged-execution-proof target triple must match vendor/dmg-packaging.json');
}

if (receipt.targetTriple !== packaging.macosTarget) {
  fail('packaged proof receipt targetTriple must match vendor/dmg-packaging.json');
}

if (typeof manifest.packagedReceiptPresent !== 'boolean') {
  fail('Missing packagedReceiptPresent boolean');
}

if (typeof manifest.runtimeEnvelopeCompatibilityChecked !== 'boolean') {
  fail('Missing runtimeEnvelopeCompatibilityChecked boolean');
}

if (manifest.current === 'real-packaged-proof') {
  if (!manifest.packagedReceiptPresent || !manifest.runtimeEnvelopeCompatibilityChecked) {
    fail('real-packaged-proof requires a verified receipt and compatibility check');
  }
}

console.log('OK packaged-execution proof seam is present and internally coherent');
