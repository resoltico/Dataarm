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

function plistJson(plistPath) {
  const bytes = childProcess.execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], {
    stdio: 'pipe',
  });
  return JSON.parse(bytes.toString('utf8'));
}

function codesignDisplay(targetPath) {
  const result = childProcess.spawnSync('codesign', ['-dv', targetPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(`codesign inspection failed for ${targetPath}: ${result.stderr || result.stdout}`);
  }
  return `${result.stdout}${result.stderr}`;
}

function nativeSmoke(appBundlePath, bundleExecutable) {
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dataarm-native-smoke-'));
  const smokeFile = path.join(smokeRoot, 'bootstrap.json');
  const executablePath = path.join(appBundlePath, 'Contents', 'MacOS', bundleExecutable);
  const result = childProcess.spawnSync(executablePath, [], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DATAARM_NATIVE_SMOKE_FILE: smokeFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });

  try {
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      fail(
        `native app smoke launch failed for ${executablePath}: ${result.stderr || result.stdout || `exit ${String(result.status)}`}`,
      );
    }
    if (!fs.existsSync(smokeFile)) {
      fail(`native app smoke launch did not materialize ${smokeFile}`);
    }

    const payload = JSON.parse(fs.readFileSync(smokeFile, 'utf8'));
    if (payload.appName !== posture.displayAppName) {
      fail(`native app smoke payload must report ${posture.displayAppName} as appName`);
    }
    if (payload.appVersion !== readAppVersion()) {
      fail(`native app smoke payload must report version ${readAppVersion()}`);
    }
    if (payload.runtimeContract !== 'embedded-ffhn-core') {
      fail('native app smoke payload must report embedded-ffhn-core as runtimeContract');
    }
    return payload;
  } finally {
    fs.rmSync(smokeRoot, { force: true, recursive: true });
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
const appBundleInspection = withMountedDmg(dmgPath, (mountPath) => {
  const appBundlePath = path.join(mountPath, `${posture.displayAppName}.app`);
  if (!fs.existsSync(appBundlePath)) {
    fail(`mounted dmg is missing ${posture.displayAppName}.app`);
  }

  const infoPlist = plistJson(path.join(appBundlePath, 'Contents', 'Info.plist'));
  const bundleExecutable = String(infoPlist.CFBundleExecutable ?? '');
  if (bundleExecutable !== posture.internalDesktopPackageName) {
    fail(
      `mounted dmg app bundle must execute ${posture.internalDesktopPackageName}, found ${bundleExecutable}`,
    );
  }
  const mainExecutablePath = path.join(appBundlePath, 'Contents', 'MacOS', bundleExecutable);
  if (!fs.existsSync(mainExecutablePath)) {
    fail(`mounted dmg is missing expected app executable: ${mainExecutablePath}`);
  }
  const bundledExecutables = fs
    .readdirSync(path.join(appBundlePath, 'Contents', 'MacOS'))
    .filter((entry) => fs.statSync(path.join(appBundlePath, 'Contents', 'MacOS', entry)).isFile())
    .sort();
  if (JSON.stringify(bundledExecutables) !== JSON.stringify([posture.internalDesktopPackageName])) {
    fail(
      `mounted dmg must expose only ${posture.internalDesktopPackageName} in Contents/MacOS, found ${bundledExecutables.join(', ')}`,
    );
  }
  const codesignOutput = codesignDisplay(appBundlePath);
  if (posture.signing === 'ad-hoc' && !codesignOutput.includes('Signature=adhoc')) {
    fail('mounted dmg app bundle is not ad-hoc signed as required by packaging posture');
  }

  const bundledLegalFiles = (posture.bundledLegalFiles ?? []).map((entry) => {
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

  const nativeSmokePayload = nativeSmoke(appBundlePath, bundleExecutable);

  return {
    bundleExecutable,
    bundledExecutables,
    codesignSummary: codesignOutput
      .split('\n')
      .filter((line) => line.startsWith('Identifier=') || line.startsWith('Signature='))
      .join('\n'),
    bundledLegalFiles,
    nativeSmokePayload,
  };
});

const manifest = {
  schemaVersion: 1,
  artifactKind: 'github-ad-hoc-signed-macos-packaging',
  generatedAtUtc: new Date().toISOString(),
  workflow: posture.githubWorkflow,
  buildScript: 'npm run package:adhoc-signed:dmg:macos-silicon',
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
    bundleExecutable: appBundleInspection.bundleExecutable,
    bundledExecutables: appBundleInspection.bundledExecutables,
    codesignSummary: appBundleInspection.codesignSummary,
    legalDirectory: posture.appBundleLegalDirectory,
    bundledLegalFiles: appBundleInspection.bundledLegalFiles,
    nativeSmokePayload: appBundleInspection.nativeSmokePayload,
  },
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
removeRepoOsDetritus();
console.log(
  `OK: packaging manifest written to ${path.relative(repoRoot, manifestPath).split(path.sep).join('/')}`,
);
