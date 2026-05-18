#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = [
  '+nightly-2026-03-29',
  'miri',
  'test',
  '--manifest-path',
  'src-tauri/Cargo.toml',
  'execute_target_run_persists_runtime_artifacts_for_file_targets',
  '--',
  '--exact',
];

const existingFlags = process.env.MIRIFLAGS?.trim();
const nextMiriflags = [existingFlags, '-Zmiri-disable-isolation'].filter(Boolean).join(' ');

const result = spawnSync('cargo', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    MIRIFLAGS: nextMiriflags,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
