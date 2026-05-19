import fs from 'node:fs';
import prettier from 'prettier';

import {
  appVersionContractPath,
  cargoManifestPath,
  frontendVersionModulePath,
  packageJsonPath,
  packageLockPath,
  readAppVersionContract,
  renderFrontendVersionModule,
  replaceCargoPackageVersion,
  tauriConfigPath,
} from './lib/app-version.mjs';

const contract = readAppVersionContract();

async function writeFormattedFile(filePath, contents) {
  const resolvedConfig = (await prettier.resolveConfig(filePath)) ?? {};
  const formatted = await prettier.format(contents, {
    ...resolvedConfig,
    filepath: filePath,
  });
  fs.writeFileSync(filePath, formatted);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = contract.version;
await writeFormattedFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
packageLock.version = contract.version;
if (
  !packageLock.packages ||
  typeof packageLock.packages !== 'object' ||
  !packageLock.packages['']
) {
  throw new Error('package-lock.json does not expose the root package entry');
}
packageLock.packages[''].version = contract.version;
await writeFormattedFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);

const cargoManifest = fs.readFileSync(cargoManifestPath, 'utf8');
fs.writeFileSync(cargoManifestPath, replaceCargoPackageVersion(cargoManifest, contract.version));

const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
tauriConfig.version = contract.version;
await writeFormattedFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

await writeFormattedFile(frontendVersionModulePath, renderFrontendVersionModule(contract));

console.log(
  `sync-app-version: synced ${contract.version} from ${appVersionContractPath} into package.json, package-lock.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json, and src/lib/appVersion.ts`,
);
