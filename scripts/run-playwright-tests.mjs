#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ensureManagedRootById } from './lib/hygiene.mjs';

const require = createRequire(import.meta.url);
const cliPath = require.resolve('@playwright/test/cli');
const env = { ...process.env };

if (env.NO_COLOR) {
  delete env.NO_COLOR;
}

if (env.FORCE_COLOR) {
  delete env.FORCE_COLOR;
}

ensureManagedRootById('managed-playwright-report');
ensureManagedRootById('managed-playwright-test-results');
ensureManagedRootById('managed-playwright-coverage');
env.DATAARM_COVERAGE = '1';
env.VITE_COVERAGE = 'true';

const result = spawnSync(process.execPath, [cliPath, 'test'], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  throw result.error;
}

ensureManagedRootById('managed-playwright-report');
ensureManagedRootById('managed-playwright-test-results');
ensureManagedRootById('managed-playwright-coverage');

process.exit(result.status ?? 1);
