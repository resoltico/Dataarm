import fs from 'node:fs';
import path from 'node:path';

import { repoRoot } from './artifact-roots.mjs';

function readChangelogLines() {
  return fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8').split(/\r?\n/u);
}

export function changelogSectionFor(version) {
  const headingPrefix = `## [${version}]`;
  const lines = readChangelogLines();
  const startIndex = lines.findIndex((line) => line.startsWith(headingPrefix));

  if (startIndex === -1) {
    throw new Error(`CHANGELOG.md is missing a section for version ${version}`);
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith('## ['));
  const sectionLines = lines.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex);
  const notes = sectionLines.join('\n').trim();

  if (!notes) {
    throw new Error(`CHANGELOG.md section for version ${version} is empty`);
  }

  return notes;
}

export function releaseNotesFor(version, installGuideUrl = null) {
  const notes = changelogSectionFor(version);

  if (!installGuideUrl) {
    return notes;
  }

  return [
    notes,
    '## First Launch On macOS',
    'Current public macOS builds are ad-hoc signed but not notarized by Apple.',
    'After dragging Dataarm into `/Applications`, use Finder `Open` or `System Settings` -> `Privacy & Security` -> `Open Anyway` if macOS blocks the first launch.',
    'Terminal fallback after copying the app into `/Applications`: `xattr -dr com.apple.quarantine "/Applications/Dataarm.app"`',
    `Terminal fallback and full install guidance: ${installGuideUrl}`,
  ].join('\n\n');
}
