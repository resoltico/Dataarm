import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve('vendor/quality-gates.json');
const raw = await readFile(file, 'utf8');
const parsed = JSON.parse(raw);
const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));

if (parsed.current !== 'quality-gates-wired') {
  throw new Error(`Unexpected quality-gates state: ${parsed.current}`);
}

const expectedNodeCommands = [
  'npm run format:check',
  'npm run lint',
  'npm run build',
  'npm run verify:tooling-refresh',
  'npm run verify:project-status',
  'npm run verify:dmg-packaging',
  'npm run verify:github-packaging',
  'typos .',
];
const expectedRustCommands = [
  'cargo fmt --all --check --manifest-path src-tauri/Cargo.toml',
  'cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features -- -D warnings',
  'cargo check --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features',
  'cargo test --manifest-path src-tauri/Cargo.toml --workspace --all-features',
  'cargo deny --manifest-path src-tauri/Cargo.toml check',
  'typos .',
];
const expectedNodeScript =
  'npm run format:check && npm run lint && npm run build && npm run verify:quality-gates && npm run verify:tooling-refresh && npm run verify:project-status && npm run verify:dmg-packaging && npm run verify:github-packaging && typos .';
const expectedRustScript =
  'cargo fmt --all --check --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features -- -D warnings && cargo check --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features && cargo test --manifest-path src-tauri/Cargo.toml --workspace --all-features && cargo deny --manifest-path src-tauri/Cargo.toml check && typos .';
const expectedMiriScript =
  'cargo +nightly-2026-03-29 miri test --manifest-path src-tauri/Cargo.toml --workspace --all-features';
const retiredScripts = [
  'verify:proof-dossier',
  'verify:operational-signoff',
  'hydrate:bundle-placeholders',
];

if (JSON.stringify(parsed.node?.commands) !== JSON.stringify(expectedNodeCommands)) {
  throw new Error('quality-gates node.commands is out of sync with the supported quality lane');
}

if (JSON.stringify(parsed.rust?.stableGates) !== JSON.stringify(expectedRustCommands)) {
  throw new Error('quality-gates rust.stableGates is out of sync with the supported quality lane');
}

if (parsed.miri?.toolchain !== 'nightly-2026-03-29') {
  throw new Error('Miri toolchain pin is missing or incorrect');
}

if (pkg.scripts['quality:node'] !== expectedNodeScript) {
  throw new Error('package.json quality:node script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['quality:rust'] !== expectedRustScript) {
  throw new Error('package.json quality:rust script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['quality:miri'] !== expectedMiriScript) {
  throw new Error('package.json quality:miri script is out of sync with vendor/quality-gates.json');
}

for (const scriptName of retiredScripts) {
  if (scriptName in pkg.scripts) {
    throw new Error(`package.json must not expose retired script ${scriptName}`);
  }
}

console.log('quality-gates: ok');
