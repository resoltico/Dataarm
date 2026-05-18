#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const vitestPackageRoot = path.dirname(require.resolve('vitest/package.json'));
const vitestCliPath = path.join(vitestPackageRoot, 'vitest.mjs');
const env = {
  ...process.env,
  VITE_DATAARM_BROWSER_BACKEND: 'browser_workbench',
};
const forwardedArgs = process.argv.slice(2);
const result = spawnSync(process.execPath, [vitestCliPath, 'run', ...forwardedArgs], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
