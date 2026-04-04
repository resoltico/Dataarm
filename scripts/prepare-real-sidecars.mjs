#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(root, 'vendor', 'bundle-manifest.json');
const packagingPath = path.join(root, 'vendor', 'dmg-packaging.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));

console.log('Preparing sidecar bundle contract for FFHN Desktop');
console.log(`Desktop version: ${manifest.desktopProduct.version}`);
console.log(`Supported packaging target: ${packaging.macosTarget}`);
for (const [name, dep] of Object.entries(manifest.dependencies)) {
  console.log(`- ${name}: ${dep.repo} @ ${dep.ref} (${dep.versionLabel})`);
}
console.log('');
console.log('Release path:');
console.log('  npm run record:release-sidecar-checksums');
console.log('  npm run fetch:release-sidecars');
console.log(
  '  First refresh vendor/checksums/expected-upstream-release-checksums.json from the pinned upstream .sha256 assets,',
);
console.log(
  '  then download the pinned upstream sidecars, verify their published checksums and local hashes,',
);
console.log('  and hydrate src-tauri/binaries for packaging.');
console.log('');
console.log('Local dev path:');
console.log('  npm run sync-sidecars');
console.log('  This copies sibling standalone builds from ../ffhn/dist and ../HTMLCut/dist.');
console.log('');
console.log('Hydrated sidecars live at:');
console.log(`  src-tauri/binaries/ffhn-${packaging.macosTarget}`);
console.log(`  src-tauri/binaries/htmlcut-${packaging.macosTarget}`);
console.log('');
console.log('Commit the refreshed checksum receipt before tagging a desktop release.');
