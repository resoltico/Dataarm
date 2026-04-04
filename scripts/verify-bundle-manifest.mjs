#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(root, 'vendor', 'bundle-manifest.json');
const packagingPath = path.join(root, 'vendor', 'dmg-packaging.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));

if (manifest.schemaVersion !== 1) {
  throw new Error('bundle-manifest schemaVersion must be 1');
}

if (manifest.desktopProduct?.name !== 'ffhn-desktop') {
  throw new Error('bundle-manifest desktopProduct.name must be ffhn-desktop');
}

if (typeof manifest.desktopProduct?.version !== 'string' || !manifest.desktopProduct.version) {
  throw new Error('bundle-manifest desktopProduct.version must be a non-empty string');
}

if ('phase' in (manifest.desktopProduct ?? {})) {
  throw new Error('bundle-manifest must not carry retired desktopProduct.phase metadata');
}

if (manifest.runtimeContract !== 'GUI -> FFHN -> HTMLCUT') {
  throw new Error('bundle-manifest runtimeContract must remain GUI -> FFHN -> HTMLCUT');
}

if (manifest.executionPosture?.current !== 'strict-wrapper-with-bundled-sidecars') {
  throw new Error('bundle-manifest executionPosture.current is out of sync');
}

if (
  !Array.isArray(manifest.supportedTargetTriples) ||
  manifest.supportedTargetTriples.length !== 1
) {
  throw new Error('bundle-manifest must declare exactly one supported target triple today');
}

if (manifest.supportedTargetTriples[0] !== packaging.macosTarget) {
  throw new Error('bundle-manifest supported target must match vendor/dmg-packaging.json');
}

if ('bundleArtifacts' in manifest) {
  throw new Error('bundle-manifest must not carry retired bundleArtifacts metadata');
}

for (const [depName, expectedBasename] of Object.entries({ ffhn: 'ffhn', htmlcut: 'htmlcut' })) {
  const dep = manifest.dependencies?.[depName];
  if (!dep) {
    throw new Error(`Missing dependency manifest entry: ${depName}`);
  }

  for (const field of ['repo', 'ref', 'versionLabel', 'binaryBasename', 'status']) {
    if (typeof dep[field] !== 'string' || !dep[field]) {
      throw new Error(`bundle-manifest dependency ${depName} is missing ${field}`);
    }
  }

  if (dep.binaryBasename !== expectedBasename) {
    throw new Error(`bundle-manifest dependency ${depName} has unexpected binaryBasename`);
  }
}

console.log('Bundle manifest verification passed.');
