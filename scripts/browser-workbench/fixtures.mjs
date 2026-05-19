import fs from 'node:fs';
import path from 'node:path';

import {
  BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES,
  BROWSER_WORKBENCH_FIXTURE_ROOT,
  BROWSER_WORKBENCH_ROOT,
  BROWSER_WORKBENCH_VERSION,
  browserWorkbenchExamplesRoot,
  browserWorkbenchLibraryRoot,
  browserWorkbenchSessionRoot,
  browserWorkbenchTemplateExamplesRoot,
  browserWorkbenchTemplateLibraryRoot,
  browserWorkbenchTemplateSessionRoot,
} from './constants.mjs';
import { repoRoot } from '../lib/artifact-roots.mjs';

const demoStatusBoardHtml = fs.readFileSync(
  path.join(repoRoot, 'vendor', 'workbench-fixtures', 'demo-status-board.html'),
  'utf8',
);
const demoReleaseNotesHtml = fs.readFileSync(
  path.join(repoRoot, 'vendor', 'workbench-fixtures', 'demo-release-notes.html'),
  'utf8',
);
const demoStatusBoardTargetTemplate = fs.readFileSync(
  path.join(repoRoot, 'vendor', 'workbench-fixtures', 'demo-status-board.target.toml'),
  'utf8',
);
const demoReleaseNotesTargetTemplate = fs.readFileSync(
  path.join(repoRoot, 'vendor', 'workbench-fixtures', 'demo-release-notes.target.toml'),
  'utf8',
);

const browserReleaseNotesHtml = `<!doctype html>
<html>
  <body>
    <main>
      <article class="release">
        Browser workbench fixture release notes
      </article>
    </main>
  </body>
</html>
`;

const demoStatusBoardBaselineHtml = demoStatusBoardHtml
  .replace('Green', 'Yellow')
  .replace('Embedded ffhn-core path active.', 'Runtime upgrade pending.');

const demoReleaseNotesBaselineHtml = demoReleaseNotesHtml
  .replace('Release 7.0.0', 'Release 6.9.0')
  .replace(
    'Dataarm now runs the embedded runtime directly in process.',
    'Dataarm continues the bundled sidecar runtime delivery path.',
  );

function replaceDemoToken(template, demoRoot) {
  return template.replaceAll('__DATAARM_DEMO_PATH__', demoRoot);
}

function browserWorkbenchVersionPath() {
  return path.join(BROWSER_WORKBENCH_ROOT, '.browser-workbench-version');
}

function ensureSharedFixtures() {
  fs.mkdirSync(BROWSER_WORKBENCH_FIXTURE_ROOT, { recursive: true });
  fs.writeFileSync(BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES, browserReleaseNotesHtml);
}

function refreshWorkbenchRootIfNeeded() {
  const versionPath = browserWorkbenchVersionPath();
  const refresh =
    !fs.existsSync(versionPath) ||
    fs.readFileSync(versionPath, 'utf8').trim() !== BROWSER_WORKBENCH_VERSION;

  if (refresh && fs.existsSync(BROWSER_WORKBENCH_ROOT)) {
    fs.rmSync(BROWSER_WORKBENCH_ROOT, { force: true, recursive: true });
  }

  fs.mkdirSync(BROWSER_WORKBENCH_ROOT, { recursive: true });
  fs.writeFileSync(versionPath, `${BROWSER_WORKBENCH_VERSION}\n`);
}

function resetDirectory(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { force: true, recursive: true });
  }
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeTarget(workspaceRoot, directoryName, rawToml) {
  const targetRoot = path.join(workspaceRoot, directoryName);
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'target.toml'), rawToml.trimEnd() + '\n');
}

function writeDemoSources(demoRoot, statusBoardHtml, releaseNotesHtml) {
  const sourcesRoot = path.join(demoRoot, 'sources');
  fs.mkdirSync(sourcesRoot, { recursive: true });
  fs.writeFileSync(path.join(sourcesRoot, 'status-board.html'), statusBoardHtml);
  fs.writeFileSync(path.join(sourcesRoot, 'release-notes.html'), releaseNotesHtml);
}

async function primeDemoRuntimeArtifacts(bridge, demoRoot) {
  await bridge.request('run_target', {
    workspace_path: demoRoot,
    directory_name: 'release_notes',
  });

  writeDemoSources(demoRoot, demoStatusBoardBaselineHtml, demoReleaseNotesHtml);
  await bridge.request('run_target', {
    workspace_path: demoRoot,
    directory_name: 'status_board',
  });

  writeDemoSources(demoRoot, demoStatusBoardHtml, demoReleaseNotesHtml);
  await bridge.request('run_target', {
    workspace_path: demoRoot,
    directory_name: 'status_board',
  });
}

export function browserWorkbenchFixtureReleaseNotesPath() {
  return BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES;
}

export async function prepareBrowserWorkbenchTemplate(bridge) {
  refreshWorkbenchRootIfNeeded();
  ensureSharedFixtures();

  const sessionRoot = browserWorkbenchTemplateSessionRoot();
  const libraryRoot = browserWorkbenchTemplateLibraryRoot();
  const examplesRoot = browserWorkbenchTemplateExamplesRoot();
  if (fs.existsSync(libraryRoot)) {
    return {
      examplesRoot,
      fixtureReleaseNotesPath: BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES,
      libraryRoot,
    };
  }

  resetDirectory(sessionRoot);
  fs.mkdirSync(libraryRoot, { recursive: true });
  writeDemoSources(examplesRoot, demoStatusBoardHtml, demoReleaseNotesBaselineHtml);
  writeTarget(
    examplesRoot,
    'status_board',
    replaceDemoToken(demoStatusBoardTargetTemplate, examplesRoot),
  );
  writeTarget(
    examplesRoot,
    'release_notes',
    replaceDemoToken(demoReleaseNotesTargetTemplate, examplesRoot),
  );

  await primeDemoRuntimeArtifacts(bridge, examplesRoot);

  return {
    examplesRoot,
    fixtureReleaseNotesPath: BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES,
    libraryRoot,
  };
}

export async function ensureBrowserWorkbenchFixtures(bridge, sessionId) {
  await prepareBrowserWorkbenchTemplate(bridge);

  const sessionRoot = browserWorkbenchSessionRoot(sessionId);
  const libraryRoot = browserWorkbenchLibraryRoot(sessionId);
  const examplesRoot = browserWorkbenchExamplesRoot(sessionId);
  const templateSessionRoot = browserWorkbenchTemplateSessionRoot();

  resetDirectory(sessionRoot);
  fs.cpSync(templateSessionRoot, sessionRoot, { recursive: true });

  return {
    examplesRoot,
    fixtureReleaseNotesPath: BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES,
    libraryRoot,
  };
}
