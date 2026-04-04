#!/usr/bin/env node

/**
 * sync-local-sidecars.mjs
 *
 * Synchronizes standalone `ffhn` and `htmlcut` binaries from sibling repositories
 * into the `src-tauri/binaries/` directory that Tauri uses for sidecar bundling.
 *
 * Expected workspace topology (see docs/developer-guide.md for full details):
 *
 *   <parent>/
 *     ├── ffhn/             ← git clone git@github.com:resoltico/ffhn.git
 *     ├── HTMLCut/          ← git clone git@github.com:resoltico/HTMLCut.git
 *     └── ffhn-desktop/     ← this repository
 *
 * Two resolution modes are supported:
 *
 *   A. Sibling repositories (default):
 *      Reads from `../ffhn/dist/ffhn-<target>` and `../HTMLCut/dist/htmlcut-<target>`.
 *      These paths are relative to this repository's root.
 *
 *   B. Explicit environment variable overrides:
 *      Set FFHN_DESKTOP_FFHN_BIN and FFHN_DESKTOP_HTMLCUT_BIN to absolute paths.
 *      Useful in CI environments or non-standard workspace layouts.
 *      Example:
 *        FFHN_DESKTOP_FFHN_BIN=/custom/path/ffhn \
 *        FFHN_DESKTOP_HTMLCUT_BIN=/custom/path/htmlcut \
 *        npm run sync-sidecars
 *
 * Usage:
 *   npm run sync-sidecars
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const binariesDir = path.join(root, 'src-tauri', 'binaries');
const packagingPath = path.join(root, 'vendor', 'dmg-packaging.json');

// --- Read packaging config to determine the expected target triple ---
let packaging;
try {
  packaging = JSON.parse(fs.readFileSync(packagingPath, 'utf8'));
} catch (err) {
  console.error(`❌ Could not read vendor/dmg-packaging.json: ${err.message}`);
  console.error('   Ensure you are running this script from inside ffhn-desktop/.');
  process.exit(1);
}

const macosTarget = packaging.macosTarget; // e.g. "aarch64-apple-darwin"

// --- Resolve source paths ---
// Mode B: explicit env var overrides take priority over sibling paths
const ffhnSource =
  process.env.FFHN_DESKTOP_FFHN_BIN ?? resolveSiblingBinary(['ffhn'], 'ffhn', macosTarget);

const htmlcutSource =
  process.env.FFHN_DESKTOP_HTMLCUT_BIN ??
  resolveSiblingBinary(['HTMLCut', 'htmlcut'], 'htmlcut', macosTarget);

const resolvedViaEnv = {
  ffhn: !!process.env.FFHN_DESKTOP_FFHN_BIN,
  htmlcut: !!process.env.FFHN_DESKTOP_HTMLCUT_BIN,
};

// --- Destination paths (Tauri sidecar naming convention) ---
const ffhnDest = path.join(binariesDir, `ffhn-${macosTarget}`);
const htmlcutDest = path.join(binariesDir, `htmlcut-${macosTarget}`);

// --- Sync function ---
function syncBinary(source, dest, name, viaEnv) {
  const modeLabel = viaEnv ? '(env override)' : '(sibling repo)';

  if (!fs.existsSync(source)) {
    console.error(`❌ ${name}: source binary not found ${modeLabel}`);
    console.error(`   Expected at: ${source}`);
    if (!viaEnv) {
      console.error(
        `   Fix: run 'npm install && npm run build:standalone:macos-silicon' inside the ${name} repository first.`,
      );
      console.error(
        `   Alternatively, set ${`FFHN_DESKTOP_${name.toUpperCase()}_BIN`} to an explicit path.`,
      );
    } else {
      console.error(
        `   Fix: verify the path set in FFHN_DESKTOP_${name.toUpperCase()}_BIN exists.`,
      );
    }
    return false;
  }

  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Remove stale destination first to avoid partial-copy states
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }

  try {
    fs.copyFileSync(source, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`✅ ${name} ${modeLabel}`);
    console.log(`   ${source}`);
    console.log(`   → ${dest}`);
    return true;
  } catch (err) {
    console.error(`❌ ${name}: copy failed — ${err.message}`);
    return false;
  }
}

// --- Main ---
console.log('── FFHN Desktop Sidecar Sync ──────────────────────────────────');
console.log(`Target triple: ${macosTarget}`);
console.log('');

const ffhnOk = syncBinary(ffhnSource, ffhnDest, 'ffhn', resolvedViaEnv.ffhn);
console.log('');
const htmlcutOk = syncBinary(htmlcutSource, htmlcutDest, 'htmlcut', resolvedViaEnv.htmlcut);
console.log('');

if (ffhnOk && htmlcutOk) {
  console.log('🎉 Both sidecars synced successfully.');
  console.log('   Run `npm run tauri:dev` — the UI will confirm "Execution Mode: sidecar-live".');
} else {
  console.error('❌ Sync incomplete. Resolve the errors above before running the desktop.');
  process.exit(1);
}

function resolveSiblingBinary(repoNames, binaryName, targetTriple) {
  for (const repoName of repoNames) {
    const candidate = path.resolve(root, '..', repoName, 'dist', `${binaryName}-${targetTriple}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(root, '..', repoNames[0], 'dist', `${binaryName}-${targetTriple}`);
}
