import fs from 'node:fs';
import path from 'node:path';

import { repoRoot } from './artifact-roots.mjs';

export const appVersionContractPath = path.join(repoRoot, 'vendor', 'app-version.json');
export const packageJsonPath = path.join(repoRoot, 'package.json');
export const packageLockPath = path.join(repoRoot, 'package-lock.json');
export const cargoManifestPath = path.join(repoRoot, 'src-tauri', 'Cargo.toml');
export const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
export const frontendVersionModulePath = path.join(repoRoot, 'src', 'lib', 'appVersion.ts');

export function readAppVersionContract() {
  const contract = JSON.parse(fs.readFileSync(appVersionContractPath, 'utf8'));
  if (contract.current !== 'version-contract-wired') {
    throw new Error(`Unexpected app-version policy state: ${String(contract.current)}`);
  }
  if (typeof contract.version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(contract.version)) {
    throw new Error('vendor/app-version.json must declare a semantic version string');
  }
  if (contract.packageName !== 'dataarm') {
    throw new Error('vendor/app-version.json must pin packageName dataarm');
  }
  if (contract.displayName !== 'Dataarm') {
    throw new Error('vendor/app-version.json must pin displayName Dataarm');
  }
  return contract;
}

export function readAppVersion() {
  return readAppVersionContract().version;
}

function toSingleQuotedTsString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function replaceCargoPackageVersion(contents, nextVersion) {
  let inPackageSection = false;
  let replaced = false;
  const lines = contents.split(/\r?\n/u).map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inPackageSection = trimmed === '[package]';
      return line;
    }
    if (!inPackageSection || replaced) {
      return line;
    }
    if (/^version\s*=\s*"[^"]+"$/u.test(trimmed)) {
      replaced = true;
      return line.replace(/(^\s*version\s*=\s*")[^"]+(".*$)/u, `$1${nextVersion}$2`);
    }
    return line;
  });
  if (!replaced) {
    throw new Error('src-tauri/Cargo.toml package version field was not found');
  }
  return `${lines.join('\n')}\n`;
}

export function renderFrontendVersionModule(contract) {
  return [
    `export const APP_NAME = ${toSingleQuotedTsString(contract.displayName)};`,
    `export const APP_PACKAGE_NAME = ${toSingleQuotedTsString(contract.packageName)};`,
    `export const APP_VERSION = ${toSingleQuotedTsString(contract.version)};`,
    '',
  ].join('\n');
}
