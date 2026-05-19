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
export const BROWSER_WORKBENCH_TEMPLATE_SESSION_ID = '00000000-0000-0000-0000-000000000000';
export const BROWSER_WORKBENCH_FIXTURE_RELEASE_NOTES = path.join(
  BROWSER_WORKBENCH_FIXTURE_ROOT,
  'browser-release-notes.html',
);
export const BROWSER_WORKBENCH_VERSION = '2026-05-19.2';

export function browserWorkbenchSessionRoot(sessionId) {
  return path.join(BROWSER_WORKBENCH_SESSIONS_ROOT, sessionId);
}

export function browserWorkbenchDemoRoot(sessionId) {
  return path.join(browserWorkbenchSessionRoot(sessionId), 'demo-watch-root');
}

export function browserWorkbenchLibraryRoot(sessionId) {
  return path.join(browserWorkbenchSessionRoot(sessionId), 'watch-library');
}

export function browserWorkbenchExamplesRoot(sessionId) {
  return path.join(browserWorkbenchLibraryRoot(sessionId), '.dataarm', 'examples');
}

export function browserWorkbenchTemplateSessionRoot() {
  return browserWorkbenchSessionRoot(BROWSER_WORKBENCH_TEMPLATE_SESSION_ID);
}

export function browserWorkbenchTemplateDemoRoot() {
  return browserWorkbenchDemoRoot(BROWSER_WORKBENCH_TEMPLATE_SESSION_ID);
}

export function browserWorkbenchTemplateLibraryRoot() {
  return browserWorkbenchLibraryRoot(BROWSER_WORKBENCH_TEMPLATE_SESSION_ID);
}

export function browserWorkbenchTemplateExamplesRoot() {
  return browserWorkbenchExamplesRoot(BROWSER_WORKBENCH_TEMPLATE_SESSION_ID);
}
