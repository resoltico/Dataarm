#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(message);
}

const vendorFile = resolve('vendor/runtime-dependencies.json');
const runtimePolicy = JSON.parse(await readFile(vendorFile, 'utf8'));
const manifest = await readFile(resolve('src-tauri/Cargo.toml'), 'utf8');
const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const runtimeLine = `ffhn-core ${runtimePolicy.ffhnCore?.version ?? '(unknown version)'}`;

if (runtimePolicy.current !== 'released-ffhn-runtime-line') {
  fail(`Unexpected runtime dependency policy state: ${runtimePolicy.current}`);
}

if (runtimePolicy.ffhnCore?.manifestPath !== 'src-tauri/Cargo.toml') {
  fail('runtime-dependencies ffhnCore.manifestPath must point at src-tauri/Cargo.toml');
}

const expectedFfhnDependency = `ffhn-core = { version = "${runtimePolicy.ffhnCore.version}", git = "${runtimePolicy.ffhnCore.repository}", tag = "${runtimePolicy.ffhnCore.tag}", package = "ffhn-core" }`;
if (!manifest.includes(expectedFfhnDependency)) {
  fail(
    'src-tauri/Cargo.toml ffhn-core dependency is out of sync with vendor/runtime-dependencies.json',
  );
}

if (
  runtimePolicy.htmlcutCore?.directDependencyAllowed !== false &&
  manifest.includes('htmlcut-core')
) {
  fail('src-tauri/Cargo.toml must not depend on htmlcut-core directly');
}

if (packageJson.scripts['quality:miri'] !== runtimePolicy.miri?.command) {
  fail('package.json quality:miri is out of sync with vendor/runtime-dependencies.json');
}

const expectedMiriTargetTest = `'${runtimePolicy.miri?.targetTest}'`;
const runMiriScript = await readFile(resolve('scripts/run-miri.mjs'), 'utf8');
if (!runMiriScript.includes(expectedMiriTargetTest)) {
  fail('scripts/run-miri.mjs is out of sync with vendor/runtime-dependencies.json');
}

if (!runMiriScript.includes('-Zmiri-disable-isolation')) {
  fail('scripts/run-miri.mjs must preserve the required Tauri Miri isolation override');
}

const patchPolicy = runtimePolicy.patchPolicy;
if (patchPolicy?.active) {
  fail(
    `vendor/runtime-dependencies.json must not mark a local patch active on the released ${runtimeLine} line`,
  );
}

if (manifest.includes('[patch.crates-io]')) {
  fail(
    `src-tauri/Cargo.toml must not carry a local [patch.crates-io] override on the released ${runtimeLine} line`,
  );
}

for (const retiredPath of ['patches/README.md', 'patches/rust/servo_arc']) {
  try {
    await stat(resolve(retiredPath));
    fail(`${retiredPath} must be removed once the released ${runtimeLine} line is embedded`);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

console.log('runtime-dependencies: ok');
