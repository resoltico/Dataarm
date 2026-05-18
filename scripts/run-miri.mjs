#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const targetTest =
  'logic::targets::tests::persist_and_read_target_round_trip_preserves_guided_seed_for_delimited_targets';
const args = [
  '+nightly-2026-03-29',
  'miri',
  'test',
  '--manifest-path',
  'src-tauri/Cargo.toml',
  targetTest,
  '--',
  '--exact',
];

const existingFlags = process.env.MIRIFLAGS?.trim();
const nextMiriflags = [existingFlags, '-Zmiri-disable-isolation'].filter(Boolean).join(' ');

const result = spawnSync('cargo', args, {
  encoding: 'utf8',
  env: {
    ...process.env,
    MIRIFLAGS: nextMiriflags,
  },
});

if (result.error) {
  throw result.error;
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (!combined.includes('running 1 test')) {
    console.error(`FAIL: quality:miri did not execute ${targetTest}.`);
    process.exit(1);
  }
}

process.exit(result.status ?? 1);
