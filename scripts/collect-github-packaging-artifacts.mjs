import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dmgOutputRoot, ensureManagedCiArtifactsRoot, repoRoot } from './lib/hygiene.mjs';
import { readAppVersion } from './lib/app-version.mjs';

const root = repoRoot;
const posturePath = path.join(root, 'vendor', 'dmg-packaging.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function detachMount(mountPath) {
  for (const args of [
    ['detach', mountPath],
    ['detach', '-force', mountPath],
  ]) {
    try {
      childProcess.execFileSync('hdiutil', args, { stdio: 'pipe' });
      return;
    } catch {
      // fall through to the next detach attempt
    }
  }

  fail(`failed to detach mounted dmg at ${mountPath}`);
}

function withMountedDmg(dmgPath, callback) {
  const mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dataarm-dmg-'));

  try {
    childProcess.execFileSync(
      'hdiutil',
      ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPath, dmgPath],
      { stdio: 'pipe' },
    );
    return callback(mountPath);
  } finally {
    try {
      detachMount(mountPath);
    } finally {
      fs.rmSync(mountPath, { force: true, recursive: true });
    }
  }
}

function removeRepoOsDetritus() {
  for (const candidate of [
    path.join(repoRoot, '.DS_Store'),
    path.join(repoRoot, 'docs', '.DS_Store'),
    path.join(repoRoot, '.codex', '.DS_Store'),
    path.join(repoRoot, 'src-tauri', '.DS_Store'),
  ]) {
    fs.rmSync(candidate, { force: true });
  }
}

for (const required of [posturePath]) {
  if (!fs.existsSync(required)) {
    fail(`missing required file: ${required}`);
  }
}

const posture = JSON.parse(fs.readFileSync(posturePath, 'utf8'));
const arch = posture.macosTarget.split('-')[0];
const dmgName = `${posture.displayAppName}_${readAppVersion()}_${arch}.dmg`;
const dmgPath = path.join(dmgOutputRoot(posture.macosTarget), dmgName);

if (!fs.existsSync(dmgPath)) {
  fail(`missing expected packaging artifact: ${dmgPath}`);
}

const artifactBytes = fs.readFileSync(dmgPath);
const manifestPath = ensureManagedCiArtifactsRoot();
const bundledLegalFiles = withMountedDmg(dmgPath, (mountPath) => {
  const appBundlePath = path.join(mountPath, `${posture.displayAppName}.app`);
  if (!fs.existsSync(appBundlePath)) {
    fail(`mounted dmg is missing ${posture.displayAppName}.app`);
  }

  return (posture.bundledLegalFiles ?? []).map((entry) => {
    const relativeBundlePath = String(entry.bundlePath ?? '');
    const absolutePath = path.join(appBundlePath, relativeBundlePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`missing bundled legal file in dmg app bundle: ${absolutePath}`);
    }
    const fileBytes = fs.readFileSync(absolutePath);
    return {
      bundlePath: relativeBundlePath,
      sourcePath: String(entry.sourcePath ?? ''),
      sizeBytes: fileBytes.length,
      sha256: crypto.createHash('sha256').update(fileBytes).digest('hex'),
    };
  });
});

const manifest = {
  schemaVersion: 1,
  artifactKind: 'github-unsigned-macos-packaging',
  generatedAtUtc: new Date().toISOString(),
  workflow: posture.githubWorkflow,
  buildScript: 'npm run package:unsigned:dmg:macos-silicon',
  productName: posture.displayAppName,
  packageName: posture.internalDesktopPackageName,
  bundleIdentifier: posture.bundleIdentifier,
  targetTriple: posture.macosTarget,
  signing: posture.signing,
  notarization: posture.notarization,
  artifact: {
    relativePath: path.relative(repoRoot, dmgPath).split(path.sep).join('/'),
    fileName: path.basename(dmgPath),
    sizeBytes: artifactBytes.length,
    sha256: crypto.createHash('sha256').update(artifactBytes).digest('hex'),
  },
  appBundle: {
    bundlePathWithinDmg: `${posture.displayAppName}.app`,
    legalDirectory: posture.appBundleLegalDirectory,
    bundledLegalFiles,
  },
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
removeRepoOsDetritus();
console.log(
  `OK: packaging manifest written to ${path.relative(repoRoot, manifestPath).split(path.sep).join('/')}`,
);
