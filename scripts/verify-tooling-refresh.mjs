import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const toolingPath = path.join(root, 'vendor', 'tooling-refresh.json');
const qualityGatesPath = path.join(root, 'vendor', 'quality-gates.json');
const packagePath = path.join(root, 'package.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargoConfigPath = path.join(root, '.cargo', 'config.toml');
const tauriConfigPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const capabilityPath = path.join(root, 'src-tauri', 'capabilities', 'default.json');
const viteConfigPath = path.join(root, 'vite.config.ts');
const misePath = path.join(root, '.mise.toml');
const workflowQualityPath = path.join(root, '.github', 'workflows', 'quality-gates.yml');
const workflowPackagingPath = path.join(root, '.github', 'workflows', 'package-unsigned-macos.yml');
const workflowReleasePath = path.join(root, '.github', 'workflows', 'release.yml');
const rustToolchainPath = path.join(root, 'rust-toolchain.toml');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const required of [
  toolingPath,
  qualityGatesPath,
  packagePath,
  cargoPath,
  cargoConfigPath,
  tauriConfigPath,
  capabilityPath,
  viteConfigPath,
  misePath,
  workflowQualityPath,
  workflowPackagingPath,
  workflowReleasePath,
  rustToolchainPath,
]) {
  if (!fs.existsSync(required)) {
    fail(`missing required file: ${required}`);
  }
}

if (fs.existsSync(path.join(root, '.nvmrc'))) {
  fail('.nvmrc must not exist');
}
if (fs.existsSync(path.join(root, '.node-version'))) {
  fail('.node-version must not exist');
}

const tooling = JSON.parse(fs.readFileSync(toolingPath, 'utf8'));
const qualityGates = JSON.parse(fs.readFileSync(qualityGatesPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const cargo = fs.readFileSync(cargoPath, 'utf8');
const cargoConfig = fs.readFileSync(cargoConfigPath, 'utf8');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const capability = JSON.parse(fs.readFileSync(capabilityPath, 'utf8'));
const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
const mise = fs.readFileSync(misePath, 'utf8');
const qualityWorkflow = fs.readFileSync(workflowQualityPath, 'utf8');
const packagingWorkflow = fs.readFileSync(workflowPackagingPath, 'utf8');
const releaseWorkflow = fs.readFileSync(workflowReleasePath, 'utf8');
const rustToolchain = fs.readFileSync(rustToolchainPath, 'utf8');

const nodeVersionMatch = mise.match(/^\s*node\s*=\s*"([^"]+)"\s*$/mu);
if (!nodeVersionMatch) {
  fail('.mise.toml must declare a node tool pin');
}
const nodeVersion = nodeVersionMatch[1];

if (tooling.current !== 'tooling-refresh-applied') {
  fail('tooling refresh state is not applied');
}
if (tooling.jsRuntime?.manager !== 'mise') {
  fail('tooling refresh must declare mise as the runtime manager');
}
if (tooling.jsRuntime?.recommendedNode !== '26.1.0') {
  fail('tooling refresh node pin is incorrect');
}
if (tooling.jsRuntime?.recommendedNpm !== '11.13.0') {
  fail('tooling refresh npm pin is incorrect');
}
if (nodeVersion !== tooling.jsRuntime.recommendedNode) {
  fail('.mise.toml node pin is out of sync with vendor/tooling-refresh.json');
}
if (pkg.packageManager !== 'npm@11.13.0') {
  fail('packageManager must pin npm@11.13.0');
}
if (pkg.engines.node !== '>=26.1.0 <27') {
  fail('package.json node engine is not aligned');
}
if (pkg.engines.npm !== '>=11.13.0 <12') {
  fail('package.json npm engine is not aligned');
}
if (pkg.dependencies.react !== '^19.2.6') {
  fail('react version not upgraded');
}
if (pkg.dependencies['react-dom'] !== '^19.2.6') {
  fail('react-dom version not upgraded');
}
if (pkg.devDependencies.vite !== '^8.0.13') {
  fail('vite version not upgraded');
}
if (pkg.devDependencies['@vitejs/plugin-react'] !== '^6.0.2') {
  fail('@vitejs/plugin-react version not aligned');
}
if (pkg.devDependencies.esbuild !== '^0.28.0') {
  fail('esbuild version not aligned');
}
if (pkg.devDependencies.eslint !== '^10.4.0') {
  fail('eslint version not aligned');
}
if (pkg.devDependencies['@eslint/js'] !== '^10.0.1') {
  fail('@eslint/js version not aligned');
}
if (pkg.devDependencies.prettier !== '^3.8.3') {
  fail('prettier version not aligned');
}
if (pkg.devDependencies.typescript !== '^6.0.3') {
  fail('typescript version not aligned');
}
if (pkg.devDependencies['@types/node'] !== '^25.8.0') {
  fail('@types/node version not aligned');
}
if (pkg.devDependencies['@playwright/test'] !== '1.60.0') {
  fail('@playwright/test version not aligned');
}
if (pkg.devDependencies['vite-plugin-istanbul'] !== '^9.0.0') {
  fail('vite-plugin-istanbul version not aligned');
}
if (pkg.devDependencies['istanbul-lib-coverage'] !== '^3.2.2') {
  fail('istanbul-lib-coverage version not aligned');
}
if (pkg.devDependencies['istanbul-lib-report'] !== '^3.0.1') {
  fail('istanbul-lib-report version not aligned');
}
if (pkg.devDependencies['istanbul-reports'] !== '^3.2.0') {
  fail('istanbul-reports version not aligned');
}
if (pkg.devDependencies.vitest !== '^4.1.6') {
  fail('vitest version not aligned');
}
if (pkg.devDependencies['@vitest/coverage-istanbul'] !== '^4.1.6') {
  fail('@vitest/coverage-istanbul version not aligned');
}
if (pkg.devDependencies.jsdom !== '^29.1.1') {
  fail('jsdom version not aligned');
}
if (pkg.devDependencies['@testing-library/react'] !== '^16.3.2') {
  fail('@testing-library/react version not aligned');
}
if (pkg.devDependencies['eslint-plugin-react-hooks'] !== '^7.1.1') {
  fail('eslint-plugin-react-hooks version not aligned');
}
if (pkg.devDependencies.globals !== '^17.6.0') {
  fail('globals version not aligned');
}
if (pkg.devDependencies['typescript-eslint'] !== '^8.59.3') {
  fail('typescript-eslint version not aligned');
}
if (pkg.dependencies['@tauri-apps/api'] !== '^2.11.0') {
  fail('@tauri-apps/api version not upgraded');
}
if (pkg.devDependencies['@tauri-apps/cli'] !== '^2.11.2') {
  fail('@tauri-apps/cli version not upgraded');
}
if (!cargo.includes('description = "Dataarm desktop workbench built with Tauri"')) {
  fail('src-tauri/Cargo.toml description is not aligned');
}
if (!cargo.includes('license = "MIT"')) {
  fail('src-tauri/Cargo.toml must be MIT-licensed');
}
if (!cargo.includes('tauri = { version = "2.11.1"')) {
  fail('tauri crate version not upgraded');
}
if (!cargo.includes('tauri-build = { version = "2.6.1"')) {
  fail('tauri-build crate version not upgraded');
}
if (!cargo.includes('edition = "2024"')) {
  fail('src-tauri/Cargo.toml must pin Rust edition 2024');
}
if (!cargo.includes('rust-version = "1.95"')) {
  fail('src-tauri/Cargo.toml must pin rust-version 1.95');
}
if (!cargoConfig.includes('target-dir = "../.dataarm-artifacts/target"')) {
  fail('.cargo/config.toml must pin the managed Cargo target root');
}
if (!cargoConfig.includes('build-dir = "../.dataarm-artifacts/build"')) {
  fail('.cargo/config.toml must pin the managed Cargo build root');
}
if (!rustToolchain.includes('channel = "1.95.0"')) {
  fail('rust-toolchain.toml must pin the stable Rust toolchain to 1.95.0');
}
if (cargo.includes('tauri-plugin-shell')) {
  fail('unused tauri-plugin-shell dependency must not be present');
}
if ('plugins' in tauriConfig) {
  fail('tauri.conf.json must not declare unused plugins');
}
if (tauriConfig.build?.frontendDist !== '../../.dataarm-artifacts/dist') {
  fail('tauri.conf.json must point frontendDist at the managed sibling dist root');
}
if (tauriConfig.bundle?.externalBin) {
  fail('tauri.conf.json must not declare externalBin');
}
if (tauriConfig.app?.windows?.[0]?.label !== 'main') {
  fail('tauri.conf.json must declare the main window label explicitly');
}
if (tauriConfig.app?.security?.csp == null) {
  fail('tauri.conf.json must define a production CSP');
}
if (tauriConfig.app?.security?.devCsp == null) {
  fail('tauri.conf.json must define a development CSP');
}
if (!viteConfig.includes("const buildTarget = 'es2020';")) {
  fail('vite.config.ts must pin the desktop runtime build target to es2020');
}
if (capability.permissions?.includes('shell:default')) {
  fail('default capability must not request unused shell permissions');
}
if (!qualityWorkflow.includes('node-version: 26.1.0')) {
  fail('quality-gates workflow node pin is out of sync');
}
if (!qualityWorkflow.includes('toolchain: 1.95.0')) {
  fail('quality-gates workflow stable Rust pin is out of sync');
}
if (!qualityWorkflow.includes('Install Linux native dependencies')) {
  fail('quality-gates workflow must install Linux native dependencies for Tauri on Ubuntu');
}
for (const packageName of qualityGates.rust?.linuxCiPackages ?? []) {
  const occurrences = qualityWorkflow.split(packageName).length - 1;
  if (occurrences < 2) {
    fail(`quality-gates workflow must install ${packageName} in both Ubuntu Rust jobs`);
  }
}
if (!packagingWorkflow.includes('node-version: 26.1.0')) {
  fail('package-unsigned-macos workflow node pin is out of sync');
}
if (!packagingWorkflow.includes('toolchain: 1.95.0')) {
  fail('package-unsigned-macos workflow stable Rust pin is out of sync');
}
if (!releaseWorkflow.includes('node-version: 26.1.0')) {
  fail('release workflow node pin is out of sync');
}
if (!releaseWorkflow.includes('toolchain: 1.95.0')) {
  fail('release workflow stable Rust pin is out of sync');
}
for (const [workflowName, workflowContents] of [
  ['quality-gates', qualityWorkflow],
  ['package-unsigned-macos', packagingWorkflow],
  ['release', releaseWorkflow],
]) {
  if (workflowContents.includes('CARGO_TARGET_DIR:')) {
    fail(`${workflowName} workflow must not override CARGO_TARGET_DIR; use .cargo/config.toml`);
  }
  if (workflowContents.includes('CARGO_BUILD_BUILD_DIR:')) {
    fail(
      `${workflowName} workflow must not override CARGO_BUILD_BUILD_DIR; use .cargo/config.toml`,
    );
  }
}

console.log('OK: tooling refresh verified');
