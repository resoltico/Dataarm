import fs from 'node:fs';

import {
  cargoManifestPath,
  frontendVersionModulePath,
  packageJsonPath,
  packageLockPath,
  readAppVersionContract,
  tauriConfigPath,
} from './lib/app-version.mjs';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const contract = readAppVersionContract();
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const cargoManifest = fs.readFileSync(cargoManifestPath, 'utf8');
const frontendVersionModule = fs.readFileSync(frontendVersionModulePath, 'utf8');

function moduleExports(name, expectedValue) {
  const pattern = new RegExp(
    `^export const ${name} = ['"]${expectedValue.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}['"];$`,
    'mu',
  );
  return pattern.test(frontendVersionModule);
}

if (packageJson.version !== contract.version) {
  fail('package.json version drifted from vendor/app-version.json');
}

if (packageLock.version !== contract.version) {
  fail('package-lock.json top-level version drifted from vendor/app-version.json');
}

if (packageLock.packages?.['']?.version !== contract.version) {
  fail('package-lock.json root package entry drifted from vendor/app-version.json');
}

if (!cargoManifest.includes(`version = "${contract.version}"`)) {
  fail('src-tauri/Cargo.toml package version drifted from vendor/app-version.json');
}

if (tauriConfig.version !== contract.version) {
  fail('src-tauri/tauri.conf.json version drifted from vendor/app-version.json');
}

if (!moduleExports('APP_VERSION', contract.version)) {
  fail('src/lib/appVersion.ts drifted from vendor/app-version.json');
}

if (!moduleExports('APP_NAME', contract.displayName)) {
  fail('src/lib/appVersion.ts app name drifted from vendor/app-version.json');
}

if (!moduleExports('APP_PACKAGE_NAME', contract.packageName)) {
  fail('src/lib/appVersion.ts package name drifted from vendor/app-version.json');
}

console.log(`app-version: ok (${contract.version})`);
