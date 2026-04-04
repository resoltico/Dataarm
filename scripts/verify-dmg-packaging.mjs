import fs from 'node:fs';

const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const vendor = JSON.parse(fs.readFileSync('vendor/dmg-packaging.json', 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (conf.productName !== 'FFHN') fail('Expected productName FFHN');
if (conf.identifier !== 'com.resoltico.ffhn') fail('Expected identifier com.resoltico.ffhn');
if (!Array.isArray(conf.bundle?.targets) || !conf.bundle.targets.includes('dmg'))
  fail('Expected dmg target');
if (!pkg.scripts['tauri:build:dmg:macos-silicon']?.includes('aarch64-apple-darwin'))
  fail('Expected Apple Silicon dmg script');
if (vendor.displayAppName !== 'FFHN') fail('Expected FFHN display name in vendor posture');
if (vendor.macosTarget !== 'aarch64-apple-darwin') fail('Expected Apple Silicon target posture');
console.log('verify-dmg-packaging: ok');
