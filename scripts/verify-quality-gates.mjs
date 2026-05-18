import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve('vendor/quality-gates.json');
const raw = await readFile(file, 'utf8');
const parsed = JSON.parse(raw);
const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const eslintConfig = await readFile(resolve('eslint.config.mjs'), 'utf8');
const viteConfig = await readFile(resolve('vite.config.ts'), 'utf8');
const playwrightWrapper = await readFile(resolve('scripts/run-playwright-tests.mjs'), 'utf8');
const frontendCoverageVerifier = await readFile(
  resolve('scripts/verify-frontend-coverage.mjs'),
  'utf8',
);

if (parsed.current !== 'quality-gates-wired') {
  throw new Error(`Unexpected quality-gates state: ${parsed.current}`);
}

if (parsed.node?.runtimeManager !== 'mise') {
  throw new Error('quality-gates must declare mise as the Node runtime manager');
}

if (parsed.node?.nodeVersion !== '26.1.0') {
  throw new Error('quality-gates nodeVersion is out of sync with the maintained runtime pin');
}

if (parsed.node?.packageManager !== 'npm@11.13.0') {
  throw new Error('quality-gates packageManager is out of sync with package.json');
}

if (parsed.node?.eslint !== '10.4.0') {
  throw new Error('quality-gates eslint version is out of sync with package.json');
}

if (parsed.node?.strictTypecheck !== true) {
  throw new Error('quality-gates must keep strict type-checking enabled');
}

if (parsed.node?.strictLintProfile !== 'typed-strict-plus-runtime-safety') {
  throw new Error('quality-gates must declare the maintained strict ESLint profile');
}

if (parsed.frontendCoverage?.runner !== 'vitest') {
  throw new Error('quality-gates must declare Vitest as the frontend coverage runner');
}

if (parsed.frontendCoverage?.browserRunner !== 'playwright') {
  throw new Error('quality-gates must declare Playwright as the browser evidence runner');
}

if (parsed.frontendCoverage?.instrumentation !== 'istanbul + vite-plugin-istanbul') {
  throw new Error(
    'quality-gates must declare the maintained unit and Playwright coverage instrumentation',
  );
}

if (parsed.frontendCoverage?.artifactRoot !== '../.dataarm-artifacts/coverage') {
  throw new Error('quality-gates must pin the managed browser coverage artifact root');
}

if (parsed.frontendCoverage?.lines !== 100 || parsed.frontendCoverage?.branches !== 100) {
  throw new Error(
    'quality-gates must enforce 100% line and branch coverage for the frontend contract',
  );
}

const expectedNodeCommands = [
  'npm run hygiene:clean:safe',
  'npm run format:check',
  'npm run lint',
  'npm run typecheck',
  'npm run test:unit',
  'npm run build',
  'npm run verify:quality-gates',
  'npm run verify:app-version',
  'npm run verify:runtime-dependencies',
  'npm run verify:tooling-refresh',
  'npm run verify:project-status',
  'npm run verify:dmg-packaging',
  'npm run verify:github-packaging',
  'npm run verify:release-publishing',
  'typos .',
  'npm run hygiene:verify',
];
const expectedRustCommands = [
  'npm run hygiene:clean:safe',
  'npm run verify:app-version',
  'cargo fmt --all --check --manifest-path src-tauri/Cargo.toml',
  'cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features -- -D warnings',
  'cargo check --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features',
  'cargo test --manifest-path src-tauri/Cargo.toml --workspace --all-features',
  'cargo deny --manifest-path src-tauri/Cargo.toml check',
  'typos .',
  'npm run hygiene:verify',
];
const expectedAllCommands = [
  'npm run quality:node',
  'npm run test:e2e',
  'npm run verify:frontend-coverage',
  'npm run quality:rust',
];
const expectedE2EScript =
  'npm run hygiene:clean:safe && node scripts/run-playwright-tests.mjs && npm run hygiene:verify';
const expectedNodeScript =
  'npm run hygiene:clean:safe && npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run build && npm run verify:quality-gates && npm run verify:app-version && npm run verify:runtime-dependencies && npm run verify:tooling-refresh && npm run verify:project-status && npm run verify:dmg-packaging && npm run verify:github-packaging && npm run verify:release-publishing && typos . && npm run hygiene:verify';
const expectedRustScript =
  'npm run hygiene:clean:safe && npm run verify:app-version && cargo fmt --all --check --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features -- -D warnings && cargo check --manifest-path src-tauri/Cargo.toml --workspace --all-targets --all-features && cargo test --manifest-path src-tauri/Cargo.toml --workspace --all-features && cargo deny --manifest-path src-tauri/Cargo.toml check && typos . && npm run hygiene:verify';
const expectedAllScript =
  'npm run quality:node && npm run test:e2e && npm run verify:frontend-coverage && npm run quality:rust';
const expectedMiriScript = 'node scripts/run-miri.mjs';
const expectedPackagingScript =
  'npm run hygiene:clean:safe && npm run verify:app-version && npm run verify:dmg-packaging && npm run verify:github-packaging && npm run tauri:build:dmg:macos-silicon && node scripts/collect-github-packaging-artifacts.mjs && npm run hygiene:verify';
const expectedFrontendCoverageScript = 'node scripts/verify-frontend-coverage.mjs';
const expectedUnitScript = 'vitest run --coverage.enabled';
const expectedHygieneScripts = {
  'hygiene:report': 'node scripts/report-hygiene.mjs',
  'hygiene:verify': 'node scripts/verify-hygiene.mjs',
  'hygiene:clean:safe': 'node scripts/clean-hygiene.mjs --mode safe',
  'hygiene:clean:rebuildable': 'node scripts/clean-hygiene.mjs --mode rebuildable',
};
const retiredScripts = [
  'fetch:release-sidecars',
  'prepare:first-platform-real-binaries',
  'prepare:real-sidecars',
  'record:release-sidecar-checksums',
  'sync-sidecars',
  'verify:bundle-manifest',
  'verify:hydrated-bundle',
  'verify:operational-signoff',
  'verify:packaged-execution-proof',
  'verify:proof-dossier',
  'verify:real-binary-activation',
  'verify:release-readiness',
  'verify:upstream-intake',
];
const requiredEslintConfigSnippets = [
  'strictTypeChecked',
  "reportUnusedDisableDirectives: 'error'",
  "curly: ['error', 'all']",
  "eqeqeq: ['error', 'always', { null: 'ignore' }]",
  "'no-debugger': 'error'",
  "'no-var': 'error'",
  "'prefer-const': 'error'",
];
const requiredViteCoverageSnippets = [
  "import istanbul from 'vite-plugin-istanbul';",
  "const coverageEnabled = process.env.VITE_COVERAGE === 'true';",
  'istanbul({',
  "include: ['src/**/*']",
  "exclude: ['tests/**', 'src/types.ts']",
  'requireEnv: true',
  'checkProd: true',
  'sourcemap: coverageEnabled || Boolean(process.env.TAURI_DEBUG)',
];
const requiredPlaywrightCoverageSnippets = [
  "ensureManagedRootById('managed-playwright-coverage')",
  "env.DATAARM_COVERAGE = '1';",
  "env.VITE_COVERAGE = 'true';",
];
const requiredFrontendCoverageVerifierSnippets = [
  'const expectedThresholds = {',
  'lines: 100,',
  'branches: 100,',
  'coverage-final.json',
  'playwrightCoveredFiles',
  'frontend-coverage: ok',
];

if (JSON.stringify(parsed.node?.commands) !== JSON.stringify(expectedNodeCommands)) {
  throw new Error('quality-gates node.commands is out of sync with the supported quality lane');
}

if (JSON.stringify(parsed.rust?.stableGates) !== JSON.stringify(expectedRustCommands)) {
  throw new Error('quality-gates rust.stableGates is out of sync with the supported quality lane');
}

if (JSON.stringify(parsed.all?.commands) !== JSON.stringify(expectedAllCommands)) {
  throw new Error('quality-gates all.commands is out of sync with the supported quality lane');
}

if (parsed.hygiene?.cargoTargetDir !== '../.dataarm-artifacts/target') {
  throw new Error(
    'quality-gates hygiene.cargoTargetDir is out of sync with the supported hygiene lane',
  );
}

if (parsed.hygiene?.cargoBuildDir !== '../.dataarm-artifacts/build') {
  throw new Error(
    'quality-gates hygiene.cargoBuildDir is out of sync with the supported hygiene lane',
  );
}

if (parsed.miri?.toolchain !== 'nightly-2026-03-29') {
  throw new Error('Miri toolchain pin is missing or incorrect');
}

if (parsed.miri?.command !== expectedMiriScript) {
  throw new Error('Miri command is out of sync with the maintained wrapper');
}

if (pkg.packageManager !== parsed.node.packageManager) {
  throw new Error('package.json packageManager is out of sync with vendor/quality-gates.json');
}

if (pkg.devDependencies.eslint !== `^${parsed.node.eslint}`) {
  throw new Error('package.json eslint version is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts.lint !== 'eslint . --max-warnings 0') {
  throw new Error('package.json lint script must enforce zero-warning ESLint execution');
}

if (pkg.scripts['verify:frontend-coverage'] !== expectedFrontendCoverageScript) {
  throw new Error(
    'package.json verify:frontend-coverage script is out of sync with the maintained browser coverage verifier',
  );
}

if (pkg.scripts['test:unit'] !== expectedUnitScript) {
  throw new Error(
    'package.json test:unit script is out of sync with the maintained frontend unit lane',
  );
}

for (const snippet of requiredEslintConfigSnippets) {
  if (!eslintConfig.includes(snippet)) {
    throw new Error(`eslint.config.mjs is missing strict lint contract snippet: ${snippet}`);
  }
}

for (const snippet of requiredViteCoverageSnippets) {
  if (!viteConfig.includes(snippet)) {
    throw new Error(`vite.config.ts is missing browser coverage contract snippet: ${snippet}`);
  }
}

for (const snippet of requiredPlaywrightCoverageSnippets) {
  if (!playwrightWrapper.includes(snippet)) {
    throw new Error(
      `scripts/run-playwright-tests.mjs is missing browser coverage contract snippet: ${snippet}`,
    );
  }
}

for (const snippet of requiredFrontendCoverageVerifierSnippets) {
  if (!frontendCoverageVerifier.includes(snippet)) {
    throw new Error(
      `scripts/verify-frontend-coverage.mjs is missing browser coverage contract snippet: ${snippet}`,
    );
  }
}

if (pkg.scripts['quality:node'] !== expectedNodeScript) {
  throw new Error('package.json quality:node script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['quality:rust'] !== expectedRustScript) {
  throw new Error('package.json quality:rust script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['quality:all'] !== expectedAllScript) {
  throw new Error('package.json quality:all script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['test:e2e'] !== expectedE2EScript) {
  throw new Error(
    'package.json test:e2e script is out of sync with the maintained Playwright lane',
  );
}

if (pkg.scripts['quality:miri'] !== expectedMiriScript) {
  throw new Error('package.json quality:miri script is out of sync with vendor/quality-gates.json');
}

if (pkg.scripts['verify:runtime-dependencies'] !== 'node scripts/verify-runtime-dependencies.mjs') {
  throw new Error(
    'package.json verify:runtime-dependencies script is out of sync with the maintained runtime dependency contract',
  );
}

if (pkg.scripts['verify:release-publishing'] !== 'node scripts/verify-release-publishing.mjs') {
  throw new Error(
    'package.json verify:release-publishing script is out of sync with the maintained release publication contract',
  );
}

if (pkg.scripts['sync:app-version'] !== 'node scripts/sync-app-version.mjs') {
  throw new Error(
    'package.json sync:app-version script is out of sync with the maintained version contract',
  );
}

if (pkg.scripts['verify:app-version'] !== 'node scripts/verify-app-version.mjs') {
  throw new Error(
    'package.json verify:app-version script is out of sync with the maintained version contract',
  );
}

if (pkg.scripts['package:unsigned:dmg:macos-silicon'] !== expectedPackagingScript) {
  throw new Error(
    'package.json package:unsigned:dmg:macos-silicon script is out of sync with vendor/quality-gates.json',
  );
}

for (const [scriptName, expectedScript] of Object.entries(expectedHygieneScripts)) {
  if (pkg.scripts[scriptName] !== expectedScript) {
    throw new Error(
      `package.json ${scriptName} script is out of sync with vendor/quality-gates.json`,
    );
  }
}

for (const scriptName of retiredScripts) {
  if (scriptName in pkg.scripts) {
    throw new Error(`package.json must not expose retired script ${scriptName}`);
  }
}

console.log('quality-gates: ok');
