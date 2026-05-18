import os from 'node:os';
import path from 'node:path';

export const BROWSER_WORKBENCH_MODE = 'browser_workbench';
export const BROWSER_WORKBENCH_RPC_PATH = '/__dataarm/workbench/rpc';
export const BROWSER_WORKBENCH_SESSION_COOKIE = 'dataarm-browser-workbench-session';
export const BROWSER_WORKBENCH_SESSION_HEADER = 'x-dataarm-workbench-session';
export const BROWSER_WORKBENCH_ROOT =
  process.env.DATAARM_BROWSER_WORKBENCH_ROOT ??
  path.join(os.tmpdir(), 'dataarm', 'browser-workbench');
export const BROWSER_WORKBENCH_SESSIONS_ROOT = path.join(BROWSER_WORKBENCH_ROOT, 'sessions');
export const BROWSER_WORKBENCH_FIXTURE_ROOT = path.join(BROWSER_WORKBENCH_ROOT, 'sources');
export const BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES = path.join(
  BROWSER_WORKBENCH_FIXTURE_ROOT,
  'browser-release-notes.html',
);
export const BROWSER_WORKBENCH_VERSION = '2026-05-18.2';

export function browserWorkbenchSessionRoot(sessionId) {
  return path.join(BROWSER_WORKBENCH_SESSIONS_ROOT, sessionId);
}

export function browserWorkbenchDemoRoot(sessionId) {
  return path.join(browserWorkbenchSessionRoot(sessionId), 'demo-watch-root');
}
