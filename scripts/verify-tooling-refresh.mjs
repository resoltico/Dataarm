import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const toolingPath = path.join(root, 'vendor', 'tooling-refresh.json');
const packagePath = path.join(root, 'package.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const tauriConfigPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const capabilityPath = path.join(root, 'src-tauri', 'capabilities', 'default.json');
const nvmrcPath = path.join(root, '.nvmrc');
const nodeVersionPath = path.join(root, '.node-version');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const required of [
  toolingPath,
  packagePath,
  cargoPath,
  tauriConfigPath,
  capabilityPath,
  nvmrcPath,
  nodeVersionPath,
]) {
  if (!fs.existsSync(required)) fail(`missing required file: ${required}`);
}

const tooling = JSON.parse(fs.readFileSync(toolingPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const cargo = fs.readFileSync(cargoPath, 'utf8');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const capability = JSON.parse(fs.readFileSync(capabilityPath, 'utf8'));
const nvmrc = fs.readFileSync(nvmrcPath, 'utf8').trim();
const nodeVersion = fs.readFileSync(nodeVersionPath, 'utf8').trim();

if (tooling.current !== 'tooling-refresh-applied') fail('tooling refresh state is not applied');
if (pkg.dependencies.react !== '^19.2.4') fail('react version not upgraded');
if (pkg.dependencies['react-dom'] !== '^19.2.4') fail('react-dom version not upgraded');
if (pkg.devDependencies.vite !== '^8.0.3') fail('vite version not upgraded');
if (pkg.devDependencies.esbuild !== '^0.27.4') fail('esbuild version not aligned');
if (pkg.devDependencies.eslint !== '^9.39.4') fail('eslint version not aligned');
if (pkg.devDependencies.prettier !== '^3.8.1') fail('prettier version not aligned');
if (pkg.devDependencies.typescript !== '^5.9.3') fail('typescript version not aligned');
if (pkg.dependencies['@tauri-apps/api'] !== '^2.10.1') fail('@tauri-apps/api version not upgraded');
if (pkg.devDependencies['@tauri-apps/cli'] !== '^2.10.1')
  fail('@tauri-apps/cli version not upgraded');
if (!cargo.includes('tauri = { version = "2.10.3"')) fail('tauri crate version not upgraded');
if (!cargo.includes('tauri-build = { version = "2.5.6"'))
  fail('tauri-build crate version not upgraded');
if (cargo.includes('tauri-plugin-shell'))
  fail('unused tauri-plugin-shell dependency must not be present');
if ('plugins' in tauriConfig) fail('tauri.conf.json must not declare unused plugins');
if (capability.permissions?.includes('shell:default'))
  fail('default capability must not request unused shell permissions');
if (nvmrc !== '24.14.1') fail('.nvmrc not updated to recommended Node baseline');
if (nodeVersion !== '24.14.1') fail('.node-version not updated to recommended Node baseline');

console.log('OK: tooling refresh verified');
