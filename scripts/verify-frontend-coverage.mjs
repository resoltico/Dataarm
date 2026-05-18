#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import coverageLib from 'istanbul-lib-coverage';
import reportLib from 'istanbul-lib-report';
import reports from 'istanbul-reports';

import {
  managedPlaywrightCoverageRoot,
  managedPlaywrightTestResultsRoot,
  repoRoot,
} from './lib/artifact-roots.mjs';
import { ensureManagedRootById } from './lib/hygiene.mjs';

const coverageRoot = ensureManagedRootById('managed-playwright-coverage');
const testResultsRoot = managedPlaywrightTestResultsRoot();
const unitCoverageFile = path.join(coverageRoot, 'unit', 'coverage-final.json');
const { createCoverageMap } = coverageLib;
const { createContext } = reportLib;
const expectedThresholds = {
  lines: 100,
  branches: 100,
};
const ignoredSourceFiles = new Set(['src/types.ts']);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function walkFiles(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }

      files.push(absolutePath);
    }
  }

  files.sort();
  return files;
}

function toPortablePath(value) {
  return value.split(path.sep).join('/');
}

function normalizeCoveragePath(rawPath) {
  const withoutScheme = rawPath.startsWith('file://') ? new URL(rawPath).pathname : rawPath;
  const cleaned = withoutScheme.split('?')[0].split('#')[0];
  return path.resolve(cleaned);
}

function normalizeCoverageObject(rawCoverage) {
  const normalized = {};

  for (const [rawPath, fileCoverage] of Object.entries(rawCoverage)) {
    const absolutePath = normalizeCoveragePath(rawPath);

    if (!absolutePath.startsWith(path.join(repoRoot, 'src'))) {
      continue;
    }

    normalized[absolutePath] = {
      ...fileCoverage,
      path: absolutePath,
    };
  }

  return normalized;
}

function expectedRuntimeSourceFiles() {
  return walkFiles(path.join(repoRoot, 'src'))
    .filter((absolutePath) => absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx'))
    .filter(
      (absolutePath) =>
        !ignoredSourceFiles.has(toPortablePath(path.relative(repoRoot, absolutePath))),
    );
}

const rawCoverageFiles = walkFiles(testResultsRoot).filter((absolutePath) =>
  absolutePath.endsWith('frontend-coverage.json'),
);

if (rawCoverageFiles.length === 0) {
  fail(
    `no Playwright browser coverage payloads were found under ${testResultsRoot}; run npm run test:e2e first`,
  );
}

if (!fs.existsSync(unitCoverageFile)) {
  fail(`missing unit coverage input at ${unitCoverageFile}; run npm run test:unit first`);
}

const coverageMap = createCoverageMap(JSON.parse(fs.readFileSync(unitCoverageFile, 'utf8')));
const playwrightCoveredFiles = new Set();

for (const coverageFile of rawCoverageFiles) {
  const rawCoverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
  const normalizedCoverage = normalizeCoverageObject(rawCoverage);
  for (const coveredFile of Object.keys(normalizedCoverage)) {
    playwrightCoveredFiles.add(coveredFile);
  }
}

if (playwrightCoveredFiles.size === 0) {
  fail(
    `Playwright coverage payloads under ${testResultsRoot} did not capture any runtime source file; check browser instrumentation`,
  );
}

const expectedFiles = expectedRuntimeSourceFiles();
const actualFiles = new Set(coverageMap.files().map((entry) => path.resolve(entry)));
const missingFiles = expectedFiles.filter((absolutePath) => !actualFiles.has(absolutePath));

if (missingFiles.length > 0) {
  fail(
    `frontend coverage never loaded ${missingFiles.length} runtime source file(s):\n${missingFiles
      .map((absolutePath) => `- ${toPortablePath(path.relative(repoRoot, absolutePath))}`)
      .join('\n')}`,
  );
}

const reportContext = createContext({
  dir: coverageRoot,
  coverageMap,
});

reports.create('json-summary').execute(reportContext);
reports.create('lcovonly').execute(reportContext);
reports.create('html').execute(reportContext);
reports.create('text-summary').execute(reportContext);

const summary = coverageMap.getCoverageSummary().toJSON();

for (const [metric, expected] of Object.entries(expectedThresholds)) {
  const pct = summary[metric]?.pct ?? 0;
  if (pct !== expected) {
    fail(`frontend ${metric} coverage is ${pct}% but must be ${expected}%`);
  }
}

console.log(
  `frontend-coverage: ok (${summary.lines.pct}% lines, ${summary.branches.pct}% branches; Playwright observed ${playwrightCoveredFiles.size} runtime file(s))`,
);
