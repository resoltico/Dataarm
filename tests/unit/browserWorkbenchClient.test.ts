type BrowserWorkbenchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type BrowserWorkbenchFetch = ReturnType<
  typeof vi.fn<(input: string, init?: RequestInit) => Promise<BrowserWorkbenchResponse>>
>;

type RecordedWorkbenchInit = RequestInit & {
  headers: Record<string, string>;
  body: string;
};

function okResponse(result: unknown): BrowserWorkbenchResponse {
  return {
    ok: true,
    status: 200,
    json: vi.fn(() => Promise.resolve({ ok: true, result })),
  };
}

function errorResponse(status: number, error?: string): BrowserWorkbenchResponse {
  return {
    ok: false,
    status,
    json: vi.fn(() => Promise.resolve({ ok: false, error })),
  };
}

async function loadClient() {
  vi.resetModules();
  return import('../../src/lib/browserWorkbenchClient');
}

function createFetchMock(): BrowserWorkbenchFetch {
  return vi.fn<(input: string, init?: RequestInit) => Promise<BrowserWorkbenchResponse>>();
}

function readRecordedInit(fetchMock: BrowserWorkbenchFetch, index: number): RecordedWorkbenchInit {
  const init = fetchMock.mock.calls[index]?.[1];
  if (
    !init ||
    typeof init.body !== 'string' ||
    !init.headers ||
    Array.isArray(init.headers) ||
    init.headers instanceof Headers
  ) {
    throw new Error(`Expected a recorded request init at index ${String(index)}.`);
  }
  return init as RecordedWorkbenchInit;
}

describe('browserWorkbenchClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('creates, stores, and reuses one workbench session id across requests', async () => {
    const randomUUID = vi.fn(() => 'generated-session');
    const fetch = createFetchMock()
      .mockResolvedValueOnce(okResponse({ appName: 'Dataarm' }))
      .mockResolvedValueOnce(okResponse({ summary: { workspaceName: 'demo-watch-root' } }));

    vi.stubGlobal('crypto', { randomUUID });
    vi.stubGlobal('fetch', fetch);

    const client = await loadClient();

    await client.bootstrapWorkbench();
    await client.refreshWorkspaceWorkbench();

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('dataarm.browserWorkbench.sessionId')).toBe(
      'generated-session',
    );

    const firstInit = readRecordedInit(fetch, 0);
    const secondInit = readRecordedInit(fetch, 1);

    expect(firstInit.headers).toMatchObject({
      'content-type': 'application/json',
      'x-dataarm-workbench-session': 'generated-session',
    });
    expect(secondInit.headers).toMatchObject({
      'x-dataarm-workbench-session': 'generated-session',
    });
    expect(JSON.parse(String(firstInit.body))).toMatchObject({
      sessionId: 'generated-session',
      method: 'bootstrap',
      params: {},
    });
    expect(JSON.parse(String(secondInit.body))).toMatchObject({
      sessionId: 'generated-session',
      method: 'refresh_workspace',
      params: {},
    });
  });

  it('reuses the persisted session id before generating a new one and routes every RPC helper', async () => {
    window.sessionStorage.setItem('dataarm.browserWorkbench.sessionId', 'persisted-session');

    const randomUUID = vi.fn(() => 'unused-session');
    const fetch = createFetchMock().mockImplementation(() => Promise.resolve(okResponse({})));

    vi.stubGlobal('crypto', { randomUUID });
    vi.stubGlobal('fetch', fetch);

    const client = await loadClient();

    const calls: Array<[() => Promise<unknown>, string, Record<string, unknown>]> = [
      [
        () => client.openWorkspaceWorkbench('/tmp/dataarm/demo'),
        'open_workspace',
        { workspacePath: '/tmp/dataarm/demo' },
      ],
      [
        () => client.createWorkspaceWorkbench('/tmp/dataarm/new'),
        'create_workspace',
        { workspacePath: '/tmp/dataarm/new' },
      ],
      [
        () => client.readTargetWorkbench('status_board'),
        'read_target',
        { directoryName: 'status_board' },
      ],
      [() => client.getTargetTemplateWorkbench('http'), 'get_target_template', { kind: 'http' }],
      [
        () => client.previewTargetWorkbench({ rawToml: 'target_id = "preview"\n' }),
        'preview_target',
        { request: { rawToml: 'target_id = "preview"\n' } },
      ],
      [
        () => client.saveTargetWorkbench({ rawToml: 'target_id = "save"\n' }),
        'save_target',
        { request: { rawToml: 'target_id = "save"\n' } },
      ],
      [
        () =>
          client.updateNotificationSettingsWorkbench({
            notifyWhen: 'all_completions',
            delivery: 'both',
          }),
        'update_notification_settings',
        { settings: { notifyWhen: 'all_completions', delivery: 'both' } },
      ],
      [() => client.clearNotificationFeedWorkbench(), 'clear_notification_feed', {}],
      [
        () => client.deleteTargetWorkbench('release_notes'),
        'delete_target',
        { directoryName: 'release_notes' },
      ],
      [
        () => client.runTargetWorkbench('release_notes'),
        'run_target',
        { directoryName: 'release_notes' },
      ],
      [() => client.runWorkspaceWorkbench(4), 'run_workspace', { maxConcurrency: 4 }],
      [() => client.openWorkspacePathWorkbench(), 'open_workspace_path', {}],
      [
        () => client.openTargetPathWorkbench('release_notes'),
        'open_target_path',
        { directoryName: 'release_notes' },
      ],
    ];

    for (const [invoke, method, params] of calls) {
      await invoke();
      const init = readRecordedInit(fetch, fetch.mock.calls.length - 1);
      expect(init.headers).toMatchObject({
        'x-dataarm-workbench-session': 'persisted-session',
      });
      expect(JSON.parse(String(init.body))).toEqual({
        sessionId: 'persisted-session',
        method,
        params,
      });
    }

    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('surfaces HTTP transport and payload failures with actionable messages', async () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'session-1') });
    const fetch = createFetchMock()
      .mockResolvedValueOnce(errorResponse(503, 'Bridge unavailable'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn(() => Promise.reject(new Error('not json'))),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn(() => Promise.resolve({ ok: false })),
      });
    vi.stubGlobal('fetch', fetch);

    const client = await loadClient();

    await expect(client.bootstrapWorkbench()).rejects.toThrow('Bridge unavailable');
    await expect(client.refreshWorkspaceWorkbench()).rejects.toThrow(
      'Browser workbench request refresh_workspace failed with HTTP 500.',
    );
    await expect(client.openWorkspacePathWorkbench()).rejects.toThrow(
      'Browser workbench request open_workspace_path failed.',
    );
  });

  it('works without a browser window when the client runs outside jsdom storage helpers', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'headless-session') });
    const fetch = createFetchMock().mockResolvedValue(okResponse({}));
    vi.stubGlobal('fetch', fetch);

    const client = await loadClient();
    await client.bootstrapWorkbench();

    const init = readRecordedInit(fetch, 0);

    expect(JSON.parse(String(init.body))).toMatchObject({
      sessionId: 'headless-session',
      method: 'bootstrap',
    });
  });
});
