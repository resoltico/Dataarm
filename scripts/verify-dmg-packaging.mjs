import fs from 'node:fs';
import path from 'node:path';

import {
  cargoTargetRoot,
  macosAppBundleRoot,
  repoRelativePath,
  repoRoot,
} from './lib/artifact-roots.mjs';

const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const vendor = JSON.parse(fs.readFileSync('vendor/dmg-packaging.json', 'utf8'));
const cargoToml = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (conf.productName !== 'Dataarm') {
  fail('Expected productName Dataarm');
}
if (conf.identifier !== 'com.resoltico.dataarm') {
  fail('Expected identifier com.resoltico.dataarm');
}
if (!Array.isArray(conf.bundle?.targets) || !conf.bundle.targets.includes('dmg')) {
  fail('Expected dmg target');
}
if (conf.bundle?.externalBin) {
  fail('Embedded runtime must not declare externalBin packaging');
}
if (conf.app?.windows?.[0]?.label !== 'main') {
  fail('Main window label must be explicit');
}
if (conf.app?.security?.csp == null) {
  fail('Production CSP must be defined');
}
if (conf.app?.security?.devCsp == null) {
  fail('Development CSP must be defined');
}
if (!pkg.scripts['tauri:build:dmg:macos-silicon']?.includes('aarch64-apple-darwin')) {
  fail('Expected Apple Silicon dmg script');
}
if (conf.build?.frontendDist !== '../../.dataarm-artifacts/dist') {
  fail('Expected tauri frontendDist to point at the managed sibling dist root');
}
if (vendor.displayAppName !== 'Dataarm') {
  fail('Expected Dataarm display name in vendor posture');
}
if (vendor.internalDesktopPackageName !== pkg.name) {
  fail('vendor internalDesktopPackageName must match package.json name');
}
if (vendor.bundleIdentifier !== conf.identifier) {
  fail('vendor bundleIdentifier must match tauri.conf.json identifier');
}
if (conf.bundle?.macOS?.signingIdentity !== '-') {
  fail('tauri.conf.json must pin ad-hoc signingIdentity "-" for macOS packaging');
}
if (vendor.buildScript !== 'npm run tauri:build:dmg:macos-silicon') {
  fail('vendor buildScript is out of sync');
}
if (vendor.macosTarget !== 'aarch64-apple-darwin') {
  fail('Expected Apple Silicon target posture');
}
const expectedAppBundleDir = repoRelativePath(
  macosAppBundleRoot(vendor.macosTarget, vendor.displayAppName),
);
if (vendor.localAppBundleDirectory !== expectedAppBundleDir) {
  fail('Expected vendor localAppBundleDirectory to match the managed Cargo target root');
}
const expectedDmgOutputDir = repoRelativePath(
  path.join(cargoTargetRoot(), vendor.macosTarget, 'release', 'bundle', 'dmg'),
);
if (vendor.localOutputDirectory !== expectedDmgOutputDir) {
  fail('Expected vendor localOutputDirectory to match the managed Cargo target root');
}
if (vendor.appBundleLegalDirectory !== 'Contents/SharedSupport/Legal') {
  fail('Expected appBundleLegalDirectory to pin the bundled legal directory');
}
if (!cargoToml.includes('default-run = "dataarm"')) {
  fail(
    'src-tauri/Cargo.toml must pin default-run = "dataarm" so packaging targets the desktop app',
  );
}
const expectedBundledLegalFiles = {
  'SharedSupport/Legal/LICENSE': '../LICENSE',
  'SharedSupport/Legal/NOTICE': '../NOTICE',
  'SharedSupport/Legal/PATENTS.md': '../PATENTS.md',
  'SharedSupport/Legal/Cargo.lock': './Cargo.lock',
  'SharedSupport/Legal/package-lock.json': '../package-lock.json',
};
const actualMacosFiles = conf.bundle?.macOS?.files;
if (!actualMacosFiles || typeof actualMacosFiles !== 'object' || Array.isArray(actualMacosFiles)) {
  fail('Expected bundle.macOS.files to declare bundled legal files');
}
const normalizedVendorFiles = Object.fromEntries(
  (vendor.bundledLegalFiles ?? []).map((entry) => {
    const bundlePath = String(entry.bundlePath ?? '');
    const sourcePath = String(entry.sourcePath ?? '');
    if (!bundlePath.startsWith('Contents/')) {
      fail(`bundled legal file must live under Contents/: ${bundlePath}`);
    }
    return [bundlePath.replace(/^Contents\//u, ''), sourcePath];
  }),
);
if (JSON.stringify(normalizedVendorFiles) !== JSON.stringify(expectedBundledLegalFiles)) {
  fail('vendor bundledLegalFiles must match the maintained legal bundle inventory');
}
if (JSON.stringify(actualMacosFiles) !== JSON.stringify(expectedBundledLegalFiles)) {
  fail('tauri.conf.json bundle.macOS.files must match the maintained legal bundle inventory');
}
const expectedManifestPath = repoRelativePath(
  path.join(
    path.resolve(repoRoot, '..', '.dataarm-artifacts'),
    'ci-artifacts',
    'github-packaging-manifest.json',
  ),
);
if (vendor.githubArtifactManifest !== expectedManifestPath) {
  fail('Expected vendor githubArtifactManifest to match the managed CI artifact root');
}
if (vendor.signing !== 'ad-hoc') {
  fail('Expected vendor signing posture to remain ad-hoc');
}
if (vendor.nativeSmokeRuntimeContract !== 'embedded-ffhn-core') {
  fail('Expected vendor nativeSmokeRuntimeContract to pin the maintained desktop runtime contract');
}
if (vendor.current !== 'ad-hoc-signed-apple-silicon-dmg-wired') {
  fail('Expected vendor current posture to reflect ad-hoc signed DMG packaging');
}
console.log('verify-dmg-packaging: ok');
