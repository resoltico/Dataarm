import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const packaging = JSON.parse(
  readFileSync(path.join(repoRoot, 'vendor', 'dmg-packaging.json'), 'utf8'),
);
const binariesDir = path.join(repoRoot, 'src-tauri', 'binaries');
const expectedFiles = [`ffhn-${packaging.macosTarget}`, `htmlcut-${packaging.macosTarget}`];

function isExecutable(filePath) {
  if (!existsSync(filePath)) return false;
  if (process.platform === 'win32') return true;
  return (statSync(filePath).mode & 0o111) !== 0;
}

const actualSidecarFiles = readdirSync(binariesDir)
  .filter((name) => /^(ffhn|htmlcut)-/.test(name))
  .sort();

if (JSON.stringify(actualSidecarFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(
    `src-tauri/binaries must contain only ${expectedFiles.join(', ')} as committed sidecar files`,
  );
}

const ffhnPath = path.join(binariesDir, expectedFiles[0]);
const htmlcutPath = path.join(binariesDir, expectedFiles[1]);
const ffhnPresent = existsSync(ffhnPath);
const htmlcutPresent = existsSync(htmlcutPath);
const ffhnExecutable = isExecutable(ffhnPath);
const htmlcutExecutable = isExecutable(htmlcutPath);
const state =
  ffhnExecutable && htmlcutExecutable
    ? 'ready'
    : ffhnPresent || htmlcutPresent
      ? 'partial'
      : 'missing';

console.log(
  JSON.stringify(
    {
      ok: true,
      state,
      targetTriple: packaging.macosTarget,
      ffhn: {
        file: expectedFiles[0],
        present: ffhnPresent,
        executable: ffhnExecutable,
      },
      htmlcut: {
        file: expectedFiles[1],
        present: htmlcutPresent,
        executable: htmlcutExecutable,
      },
    },
    null,
    2,
  ),
);
