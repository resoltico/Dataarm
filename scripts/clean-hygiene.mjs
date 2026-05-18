#!/usr/bin/env node

import { cleanHygiene } from './lib/hygiene.mjs';

const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'safe';

if (!['safe', 'rebuildable'].includes(mode)) {
  console.error('Usage: node scripts/clean-hygiene.mjs --mode safe|rebuildable');
  process.exit(1);
}

const result = cleanHygiene(mode);
console.log(
  `Removed ${result.removedPaths.length} artifact roots and reclaimed ${result.reclaimedBytes} bytes.`,
);
for (const removedPath of result.removedPaths) {
  console.log(`- ${removedPath}`);
}
