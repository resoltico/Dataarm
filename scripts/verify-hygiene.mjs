#!/usr/bin/env node

import { ensureHygiene } from './lib/hygiene.mjs';

try {
  const report = ensureHygiene();
  console.log(`hygiene: ok (${report.managedArtifactRoot})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
