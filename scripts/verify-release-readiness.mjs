#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const statusPath = join(repoRoot, 'vendor', 'release-readiness.json');
const packagingPath = join(repoRoot, 'vendor', 'dmg-packaging.json');
const receiptPath = join(repoRoot, 'vendor', 'checksums', 'release-readiness-receipt.json');

if (!existsSync(statusPath)) {
  console.error('Missing vendor/release-readiness.json');
  process.exit(1);
}

const status = JSON.parse(readFileSync(statusPath, 'utf8'));
const packaging = JSON.parse(readFileSync(packagingPath, 'utf8'));
const receiptPresent = existsSync(receiptPath);
const receipt = receiptPresent ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;

if (typeof status.schemaVersion !== 'number') {
  console.error('release-readiness.json must contain numeric schemaVersion');
  process.exit(1);
}

if (
  !['blocked-on-real-sidecar-proof', 'candidate-with-open-gates', 'release-ready'].includes(
    status.current,
  )
) {
  console.error('release-readiness.json must contain current');
  process.exit(1);
}

if (
  !status.firstSupportedPlatform ||
  status.firstSupportedPlatform.targetTriple !== packaging.macosTarget
) {
  console.error('release-readiness.json must describe the supported packaging target');
  process.exit(1);
}

if (!Array.isArray(status.blockingGates)) {
  console.error('release-readiness.json must contain blockingGates');
  process.exit(1);
}

if (!receiptPresent) {
  console.error('Missing vendor/checksums/release-readiness-receipt.json');
  process.exit(1);
}

if (receipt.targetTriple !== packaging.macosTarget) {
  console.error('release-readiness receipt targetTriple is out of sync');
  process.exit(1);
}

if (status.current === 'release-ready' && status.blockingGates.length > 0) {
  console.error('release-ready posture cannot carry blocking gates');
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      current: status.current,
      targetTriple: status.firstSupportedPlatform.targetTriple,
      releaseReceiptPresent: receiptPresent,
      blockingGates: status.blockingGates,
    },
    null,
    2,
  ),
);
