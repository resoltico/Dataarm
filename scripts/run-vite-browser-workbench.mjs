#!/usr/bin/env node

import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  VITE_DATAARM_BROWSER_BACKEND: 'browser_workbench',
};
const forwardedArgs = process.argv.slice(2);
const child = spawn('vite', forwardedArgs, {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
