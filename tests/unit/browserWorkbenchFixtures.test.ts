import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type BridgeCall = {
  method: string;
  params: Record<string, unknown> | undefined;
};

type FixtureBridge = {
  request: (method: string, params?: Record<string, unknown>) => Promise<null>;
};

type FixturePaths = {
  demoRoot: string;
  fixtureReleaseNotesPath: string;
};

type FixtureModule = {
  ensureBrowserWorkbenchFixtures: (
    bridge: FixtureBridge,
    sessionId: string,
  ) => Promise<FixturePaths>;
  prepareBrowserWorkbenchTemplate: (bridge: FixtureBridge) => Promise<FixturePaths>;
};

function tempWorkbenchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dataarm-browser-workbench-fixtures-'));
}

async function loadFixtureModule(root: string): Promise<FixtureModule> {
  vi.resetModules();
  vi.stubEnv('DATAARM_BROWSER_WORKBENCH_ROOT', root);
  const loaded: unknown = await import('../../scripts/browser-workbench/fixtures.mjs');
  return loaded as FixtureModule;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('browser workbench fixture preparation', () => {
  it('primes the demo template once and clones it for later sessions without rerunning targets', async () => {
    const workbenchRoot = tempWorkbenchRoot();
    const calls: BridgeCall[] = [];
    const request = vi.fn((method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params });
      return Promise.resolve(null);
    });
    const bridge: FixtureBridge = { request };

    const { ensureBrowserWorkbenchFixtures, prepareBrowserWorkbenchTemplate } =
      await loadFixtureModule(workbenchRoot);

    await prepareBrowserWorkbenchTemplate(bridge);

    expect(
      calls
        .filter((call) => call.method === 'run_target')
        .map((call) => call.params?.directory_name),
    ).toEqual(['release_notes', 'status_board', 'status_board']);
    expect(calls.some((call) => call.method === 'retarget_demo_fixture_workspace')).toBe(false);

    const templateCalls = calls.length;
    await prepareBrowserWorkbenchTemplate(bridge);
    expect(calls).toHaveLength(templateCalls);

    calls.length = 0;
    const sessionId = '11111111-1111-1111-1111-111111111111';
    const paths = await ensureBrowserWorkbenchFixtures(bridge, sessionId);

    expect(paths.demoRoot).toContain(sessionId);
    expect(fs.existsSync(path.join(paths.demoRoot, 'status_board', 'target.toml'))).toBe(true);
    expect(fs.existsSync(path.join(paths.demoRoot, 'release_notes', 'target.toml'))).toBe(true);
    expect(calls).toEqual([]);

    fs.rmSync(workbenchRoot, { force: true, recursive: true });
  });
});
