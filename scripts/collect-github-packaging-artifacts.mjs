import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const posturePath = path.join(root, 'vendor', 'dmg-packaging.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const required of [packageJsonPath, posturePath]) {
  if (!fs.existsSync(required)) fail(`missing required file: ${required}`);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const posture = JSON.parse(fs.readFileSync(posturePath, 'utf8'));
const arch = posture.macosTarget.split('-')[0];
const dmgName = `${posture.displayAppName}_${pkg.version}_${arch}.dmg`;
const dmgPath = path.join(
  root,
  'src-tauri',
  'target',
  posture.macosTarget,
  'release',
  'bundle',
  'dmg',
  dmgName,
);

if (!fs.existsSync(dmgPath)) fail(`missing expected dmg artifact: ${dmgPath}`);

const artifactBytes = fs.readFileSync(dmgPath);
const outputDir = path.join(root, 'src-tauri', 'target', 'ci-artifacts');
const manifestPath = path.join(outputDir, 'github-packaging-manifest.json');

fs.mkdirSync(outputDir, { recursive: true });

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
    relativePath: path.relative(root, dmgPath),
    fileName: path.basename(dmgPath),
    sizeBytes: artifactBytes.length,
    sha256: crypto.createHash('sha256').update(artifactBytes).digest('hex'),
  },
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`OK: packaging manifest written to ${path.relative(root, manifestPath)}`);
