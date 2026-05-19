#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const vitePackageRoot = path.dirname(require.resolve('vite/package.json'));
const viteCliPath = path.join(vitePackageRoot, 'bin', 'vite.js');
const env = {
  ...process.env,
  VITE_DATAARM_BROWSER_BACKEND: 'browser_workbench',
};
const forwardedArgs = process.argv.slice(2);
const child = spawn(process.execPath, [viteCliPath, ...forwardedArgs], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
