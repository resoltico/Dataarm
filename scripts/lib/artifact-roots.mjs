import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(moduleDir, '..', '..');
export const managedArtifactRoot = path.resolve(repoRoot, '..', '.dataarm-artifacts');
export const cargoConfigPath = path.join(repoRoot, '.cargo', 'config.toml');

function parseBuildStringField(contents, fieldName) {
  let inBuildSection = false;

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.replace(/\s+#.*$/u, '').trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inBuildSection = trimmed === '[build]';
      continue;
    }

    if (!inBuildSection) {
      continue;
    }

    const match = trimmed.match(new RegExp(`^${fieldName}\\s*=\\s*"([^"]+)"$`, 'u'));
    if (match) {
      return match[1];
    }
  }

  return null;
}

function readCargoBuildField(fieldName) {
  if (!fs.existsSync(cargoConfigPath)) {
    return null;
  }

  try {
    const contents = fs.readFileSync(cargoConfigPath, 'utf8');
    return parseBuildStringField(contents, fieldName);
  } catch {
    return null;
  }
}

function resolvePathFromRepo(configuredPath, fallbackPath) {
  if (!configuredPath) {
    return fallbackPath;
  }

  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(repoRoot, configuredPath);
}

export function cargoTargetRoot() {
  return resolvePathFromRepo(
    readCargoBuildField('target-dir'),
    path.join(repoRoot, 'src-tauri', 'target'),
  );
}

export function cargoBuildRoot() {
  return resolvePathFromRepo(readCargoBuildField('build-dir'), cargoTargetRoot());
}

export function managedDistRoot() {
  return path.join(managedArtifactRoot, 'dist');
}

export function managedPlaywrightReportRoot() {
  return path.join(managedArtifactRoot, 'playwright-report');
}

export function managedPlaywrightTestResultsRoot() {
  return path.join(managedArtifactRoot, 'test-results');
}

export function managedPlaywrightCoverageRoot() {
  return path.join(managedArtifactRoot, 'coverage');
}

export function managedCiArtifactsRoot() {
  return path.join(managedArtifactRoot, 'ci-artifacts');
}

export function githubPackagingManifestPath() {
  return path.join(managedCiArtifactsRoot(), 'github-packaging-manifest.json');
}

export function dmgOutputRoot(targetTriple) {
  return path.join(cargoTargetRoot(), targetTriple, 'release', 'bundle', 'dmg');
}

export function macosAppBundleRoot(targetTriple, productName) {
  return path.join(
    cargoTargetRoot(),
    targetTriple,
    'release',
    'bundle',
    'macos',
    `${productName}.app`,
  );
}

export function toPortablePath(value) {
  return value.split(path.sep).join('/');
}

export function repoRelativePath(absolutePath) {
  return toPortablePath(path.relative(repoRoot, absolutePath));
}
