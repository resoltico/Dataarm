import fs from 'node:fs';
import path from 'node:path';

import {
  cargoBuildRoot,
  cargoTargetRoot,
  dmgOutputRoot,
  githubPackagingManifestPath,
  macosAppBundleRoot,
  managedCiArtifactsRoot,
  managedDistRoot,
  managedPlaywrightReportRoot,
  managedPlaywrightTestResultsRoot,
  managedPlaywrightCoverageRoot,
  managedArtifactRoot,
  repoRelativePath,
  repoRoot,
} from './artifact-roots.mjs';

const KIB = 1024;
const MIB = 1024 * KIB;
const GIB = 1024 * MIB;
const CACHEDIR_TAG_NAME = 'CACHEDIR.TAG';
const CACHEDIR_TAG_CONTENTS =
  'Signature: 8a477f597d28d172789f06886806bc55\n# This directory stores disposable Dataarm build cache data.\n';
const ARTIFACT_MANIFEST_NAME = '.dataarm-artifact.json';
const REPORT_SCHEMA = 'dataarm.hygiene-report@1';
const ARTIFACT_SCHEMA = 'dataarm.artifact-root@1';

function managedEntries() {
  return [
    {
      id: 'managed-cargo-target',
      kind: 'cargo-target',
      path: cargoTargetRoot(),
      budgetBytes: 8 * GIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Rust and Tauri target output for maintained workspace commands.',
    },
    {
      id: 'managed-cargo-build',
      kind: 'cargo-build',
      path: cargoBuildRoot(),
      budgetBytes: 24 * GIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Rust compiler build cache for maintained workspace commands.',
    },
    {
      id: 'managed-frontend-dist',
      kind: 'frontend-dist',
      path: managedDistRoot(),
      budgetBytes: 256 * MIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Vite production frontend output consumed by Tauri packaging.',
    },
    {
      id: 'managed-playwright-report',
      kind: 'playwright-report',
      path: managedPlaywrightReportRoot(),
      budgetBytes: 256 * MIB,
      managed: true,
      safeToDelete: true,
      purpose: 'HTML report output from Playwright end-to-end runs.',
    },
    {
      id: 'managed-playwright-test-results',
      kind: 'playwright-test-results',
      path: managedPlaywrightTestResultsRoot(),
      budgetBytes: 512 * MIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Trace, screenshot, and raw result output from Playwright runs.',
    },
    {
      id: 'managed-playwright-coverage',
      kind: 'playwright-coverage',
      path: managedPlaywrightCoverageRoot(),
      budgetBytes: 256 * MIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Merged Istanbul coverage reports collected from maintained Playwright GUI runs.',
    },
    {
      id: 'managed-ci-artifacts',
      kind: 'ci-artifacts',
      path: managedCiArtifactsRoot(),
      budgetBytes: 128 * MIB,
      managed: true,
      safeToDelete: true,
      purpose: 'Collected packaging manifests and related CI handoff artifacts.',
    },
  ];
}

function managedEntryById(id) {
  return managedEntries().find((entry) => entry.id === id) ?? null;
}

function unmanagedEntries() {
  return [
    {
      id: 'workspace-node-modules',
      kind: 'node-modules',
      path: path.join(repoRoot, 'node_modules'),
      budgetBytes: 2 * GIB,
      managed: false,
      safeToDelete: true,
      details: ['Installed npm dependency tree for local development and CI.'],
      violationWhenPresent: false,
    },
    {
      id: 'legacy-repo-src-tauri-target',
      kind: 'legacy-cargo-target',
      path: path.join(repoRoot, 'src-tauri', 'target'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: [
        'Legacy repo-local Cargo target tree. Managed builds now belong in the sibling artifact root.',
      ],
      violationWhenPresent: true,
    },
    {
      id: 'legacy-repo-dist',
      kind: 'legacy-frontend-dist',
      path: path.join(repoRoot, 'dist'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: [
        'Legacy repo-local Vite build output. Managed frontend build output now belongs in the sibling artifact root.',
      ],
      violationWhenPresent: true,
    },
    {
      id: 'legacy-repo-playwright-report',
      kind: 'legacy-playwright-report',
      path: path.join(repoRoot, 'playwright-report'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: ['Legacy repo-local Playwright HTML report output.'],
      violationWhenPresent: true,
    },
    {
      id: 'legacy-repo-test-results',
      kind: 'legacy-playwright-results',
      path: path.join(repoRoot, 'test-results'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: ['Legacy repo-local Playwright raw result output.'],
      violationWhenPresent: true,
    },
    {
      id: 'repo-src-tauri-gen',
      kind: 'tauri-generated-schema',
      path: path.join(repoRoot, 'src-tauri', 'gen'),
      budgetBytes: 16 * MIB,
      managed: false,
      safeToDelete: true,
      details: [
        'Framework-generated Tauri schema output required by the capability schema references. Repo-local by tool design, disposable between runs, and kept under a small budget.',
      ],
      violationWhenPresent: false,
    },
    {
      id: 'repo-temp',
      kind: 'repo-temp',
      path: path.join(repoRoot, 'temp'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: [
        'Repository-local temporary workspace mandated for disposable investigations when needed.',
      ],
      violationWhenPresent: true,
    },
    {
      id: 'repo-tmp',
      kind: 'repo-tmp',
      path: path.join(repoRoot, 'tmp'),
      budgetBytes: 0,
      managed: false,
      safeToDelete: true,
      details: [
        'Repository-local temporary workspace mandated for disposable investigations when needed.',
      ],
      violationWhenPresent: true,
    },
  ];
}

function cargoLikeTemporaryRoots() {
  const tempRoots = [path.join(repoRoot, 'tmp'), path.join(repoRoot, 'temp')];
  const roots = [];

  for (const tempRoot of tempRoots) {
    if (!fs.existsSync(tempRoot) || !fs.statSync(tempRoot).isDirectory()) {
      continue;
    }

    for (const entry of fs.readdirSync(tempRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = path.join(tempRoot, entry.name);
      if (looksLikeCargoTargetRoot(candidate)) {
        roots.push(candidate);
      }
    }
  }

  roots.sort();
  return roots;
}

function looksLikeCargoTargetRoot(candidate) {
  return [
    '.fingerprint',
    '.rustc_info.json',
    'debug',
    'release',
    'bundle',
    'dist',
    CACHEDIR_TAG_NAME,
  ].some((component) => fs.existsSync(path.join(candidate, component)));
}

function knownOsDetritus() {
  const roots = [repoRoot];
  const ignoredDirs = new Set([
    '.git',
    'node_modules',
    'src-tauri/target',
    'dist',
    'playwright-report',
    'test-results',
    'tmp',
    'temp',
  ]);
  const matches = [];

  while (roots.length > 0) {
    const current = roots.pop();
    const relative = repoRelativePath(current);

    if (ignoredDirs.has(relative)) {
      continue;
    }

    const metadata = fs.lstatSync(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const childPath = path.join(current, entry.name);
      const childRelative = repoRelativePath(childPath);

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(childRelative)) {
          roots.push(childPath);
        }
        continue;
      }

      if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') {
        matches.push(childRelative);
      }
    }
  }

  matches.sort();
  return matches;
}

function writeCachedirTag(rootPath) {
  const tagPath = path.join(rootPath, CACHEDIR_TAG_NAME);
  if (fs.existsSync(tagPath)) {
    return;
  }

  fs.writeFileSync(tagPath, CACHEDIR_TAG_CONTENTS);
}

function writeArtifactManifest(entry) {
  const manifestPath = path.join(entry.path, ARTIFACT_MANIFEST_NAME);
  const manifest = {
    schema: ARTIFACT_SCHEMA,
    id: entry.id,
    kind: entry.kind,
    repoRoot,
    purpose: entry.purpose,
    safeToDelete: entry.safeToDelete,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function ensureManagedRoot(entry) {
  fs.mkdirSync(entry.path, { recursive: true });
  writeCachedirTag(entry.path);
  writeArtifactManifest(entry);
}

export function ensureManagedRootById(id) {
  const entry = managedEntryById(id);
  if (!entry) {
    throw new Error(`Unknown managed artifact root id: ${id}`);
  }
  ensureManagedRoot(entry);
  return entry.path;
}

function reconcileManagedRootsIfPresent() {
  for (const entry of managedEntries()) {
    if (fs.existsSync(entry.path)) {
      ensureManagedRoot(entry);
    }
  }
}

function missingManagedMarkers(rootPath) {
  const missing = [];
  if (!fs.existsSync(path.join(rootPath, CACHEDIR_TAG_NAME))) {
    missing.push(CACHEDIR_TAG_NAME);
  }
  if (!fs.existsSync(path.join(rootPath, ARTIFACT_MANIFEST_NAME))) {
    missing.push(ARTIFACT_MANIFEST_NAME);
  }
  return missing;
}

function dirSizeBytes(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return 0;
  }

  const metadata = fs.lstatSync(rootPath);
  if (metadata.isSymbolicLink()) {
    return 0;
  }
  if (metadata.isFile()) {
    return metadata.size;
  }
  if (!metadata.isDirectory()) {
    return 0;
  }

  let total = 0;
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    total += dirSizeBytes(path.join(rootPath, entry.name));
  }
  return total;
}

function buildEntry(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    path: repoRelativePath(entry.path),
    present: fs.existsSync(entry.path),
    bytes: dirSizeBytes(entry.path),
    budgetBytes: entry.budgetBytes ?? null,
    managed: entry.managed,
    safeToDelete: entry.safeToDelete,
    details: entry.details ?? [],
    violationWhenPresent: entry.violationWhenPresent ?? false,
  };
}

function formatBytes(bytes) {
  if (bytes >= GIB) {
    return `${(bytes / GIB).toFixed(1)} GiB`;
  }
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  if (bytes >= KIB) {
    return `${(bytes / KIB).toFixed(1)} KiB`;
  }
  return `${bytes} B`;
}

export function buildHygieneReport() {
  reconcileManagedRootsIfPresent();

  const entries = [...managedEntries().map(buildEntry), ...unmanagedEntries().map(buildEntry)];
  const tempCargoRoots = cargoLikeTemporaryRoots();

  entries.push({
    id: 'repo-temp-cargo-targets',
    kind: 'repo-temp-cargo-targets',
    path: '.',
    present: tempCargoRoots.length > 0,
    bytes: tempCargoRoots.reduce((total, entryPath) => total + dirSizeBytes(entryPath), 0),
    budgetBytes: null,
    managed: false,
    safeToDelete: true,
    details: tempCargoRoots.map((entryPath) => repoRelativePath(entryPath)),
    violationWhenPresent: tempCargoRoots.length > 0,
  });

  const osDetritus = knownOsDetritus();
  entries.push({
    id: 'repo-os-detritus',
    kind: 'repo-os-detritus',
    path: '.',
    present: osDetritus.length > 0,
    bytes: osDetritus.reduce(
      (total, entryPath) => total + dirSizeBytes(path.join(repoRoot, entryPath)),
      0,
    ),
    budgetBytes: null,
    managed: false,
    safeToDelete: true,
    details: osDetritus,
    violationWhenPresent: osDetritus.length > 0,
  });

  const violations = [];
  for (const entry of entries) {
    if (entry.managed && entry.present) {
      const missing = missingManagedMarkers(path.resolve(repoRoot, entry.path));
      if (missing.length > 0) {
        violations.push({
          id: entry.id,
          message: `${entry.path} is missing managed-artifact markers: ${missing.join(', ')}`,
        });
      }
    }

    if (entry.violationWhenPresent && entry.present) {
      violations.push({
        id: entry.id,
        message: `${entry.path} must not be populated under the maintained hygiene policy`,
      });
    }

    if (entry.budgetBytes !== null && entry.bytes > entry.budgetBytes) {
      violations.push({
        id: entry.id,
        message: `${entry.path} exceeds its ${formatBytes(entry.budgetBytes)} budget (${formatBytes(entry.bytes)})`,
      });
    }
  }

  return {
    schema: REPORT_SCHEMA,
    repoRoot,
    managedArtifactRoot: repoRelativePath(managedArtifactRoot),
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    entries,
    violations,
  };
}

export function renderHygieneReport(report) {
  const lines = [
    `schema: ${report.schema}`,
    `repoRoot: ${report.repoRoot}`,
    `managedArtifactRoot: ${report.managedArtifactRoot}`,
    `totalBytes: ${report.totalBytes} (${formatBytes(report.totalBytes)})`,
    'entries:',
  ];

  for (const entry of report.entries) {
    const budget = entry.budgetBytes === null ? 'n/a' : formatBytes(entry.budgetBytes);
    lines.push(
      `- ${entry.id} | ${entry.kind} | ${entry.path} | present=${entry.present} | bytes=${entry.bytes} (${formatBytes(entry.bytes)}) | budget=${budget} | managed=${entry.managed} | safeToDelete=${entry.safeToDelete}`,
    );
    for (const detail of entry.details) {
      lines.push(`  detail: ${detail}`);
    }
  }

  if (report.violations.length === 0) {
    lines.push('violations: none');
  } else {
    lines.push('violations:');
    for (const violation of report.violations) {
      lines.push(`- ${violation.id}: ${violation.message}`);
    }
  }

  return lines.join('\n');
}

export function ensureHygiene() {
  const report = buildHygieneReport();
  if (report.violations.length === 0) {
    return report;
  }

  throw new Error(
    `artifact hygiene policy failed.\n${renderHygieneReport(report)}\n\nRepair with \`npm run hygiene:report\` and \`npm run hygiene:clean:rebuildable\`.`,
  );
}

function removePathIfPresent(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return { removed: false, reclaimedBytes: 0 };
  }

  const reclaimedBytes = dirSizeBytes(rootPath);
  fs.rmSync(rootPath, { recursive: true, force: false });
  return { removed: true, reclaimedBytes };
}

function pruneEmptyManagedArtifactRoot() {
  if (!fs.existsSync(managedArtifactRoot)) {
    return;
  }

  const entries = fs.readdirSync(managedArtifactRoot);
  if (entries.length === 0) {
    fs.rmdirSync(managedArtifactRoot);
  }
}

export function cleanHygiene(mode) {
  const safePaths = [
    managedDistRoot(),
    managedPlaywrightReportRoot(),
    managedPlaywrightTestResultsRoot(),
    managedCiArtifactsRoot(),
    path.join(repoRoot, 'src-tauri', 'target'),
    path.join(repoRoot, 'dist'),
    path.join(repoRoot, 'playwright-report'),
    path.join(repoRoot, 'test-results'),
    path.join(repoRoot, 'src-tauri', 'gen'),
    path.join(repoRoot, 'temp'),
    path.join(repoRoot, 'tmp'),
    path.join(repoRoot, '.DS_Store'),
    path.join(repoRoot, 'docs', '.DS_Store'),
    path.join(repoRoot, '.codex', '.DS_Store'),
    path.join(repoRoot, 'src-tauri', '.DS_Store'),
  ];
  const rebuildablePaths =
    mode === 'rebuildable'
      ? [cargoTargetRoot(), cargoBuildRoot(), path.join(repoRoot, 'node_modules')]
      : [];

  const removedPaths = [];
  let reclaimedBytes = 0;

  for (const candidate of [...safePaths, ...rebuildablePaths]) {
    const { removed, reclaimedBytes: removedBytes } = removePathIfPresent(candidate);
    if (removed) {
      removedPaths.push(repoRelativePath(candidate));
      reclaimedBytes += removedBytes;
    }
  }

  pruneEmptyManagedArtifactRoot();

  return { removedPaths, reclaimedBytes };
}

export function ensureManagedCiArtifactsRoot() {
  const entry = managedEntryById('managed-ci-artifacts');
  if (!entry) {
    throw new Error('managed-ci-artifacts entry is not configured');
  }
  ensureManagedRoot(entry);
  return githubPackagingManifestPath();
}

export { dmgOutputRoot, macosAppBundleRoot, repoRelativePath, repoRoot };
