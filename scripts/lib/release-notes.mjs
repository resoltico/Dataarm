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
