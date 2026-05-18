#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  VITE_DATAARM_BROWSER_BACKEND: 'browser_workbench',
};
const forwardedArgs = process.argv.slice(2);
const result = spawnSync('vitest', ['run', ...forwardedArgs], {
  stdio: 'inherit',
  env,
  shell: true,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
