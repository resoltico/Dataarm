import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const packaging = JSON.parse(
  fs.readFileSync(path.join(repo, 'vendor', 'dmg-packaging.json'), 'utf8'),
);
const hostTriple = packaging.macosTarget;
const ffhnTarget = path.join(repo, 'src-tauri', 'binaries', `ffhn-${hostTriple}`);
const htmlcutTarget = path.join(repo, 'src-tauri', 'binaries', `htmlcut-${hostTriple}`);

console.log('Preparing exact first-platform binary intake paths.');
console.log('Hydrate the real first-platform binaries into:');
console.log(`  ${ffhnTarget}`);
console.log(`  ${htmlcutTarget}`);
console.log(
  'Prefer `npm run fetch:release-sidecars` for release intake or `npm run sync-sidecars` for local sibling builds, then refresh vendor/upstream-intake.json, vendor/real-binary-activation.json, and the active checksum receipts under vendor/checksums/.',
);
