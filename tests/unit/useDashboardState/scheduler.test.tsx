import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import type * as DashboardStateSchedulerModule from '../../../src/hooks/dashboardState.scheduler';
import { configureApi, deferred, makeWorkspace } from './harness';

const api = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  clearNotificationFeed: vi.fn(),
  createWorkspace: vi.fn(),
  deleteTarget: vi.fn(),
  getTargetTemplate: vi.fn(),
  inspectSource: vi.fn(),
  openTargetPath: vi.fn(),
  openWorkspacePath: vi.fn(),
  openWorkspace: vi.fn(),
  previewTarget: vi.fn(),
  readTarget: vi.fn(),
  refreshWorkspace: vi.fn(),
  runTarget: vi.fn(),
  runWorkspace: vi.fn(),
  saveTarget: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));
const { runDueScheduledWatches } = vi.hoisted(() => ({
  runDueScheduledWatches: vi.fn(),
}));

vi.mock('../../../src/lib/api', () => api);
vi.mock('../../../src/hooks/dashboardState.scheduler', async () => {
  const actual = await vi.importActual<typeof DashboardStateSchedulerModule>(
    '../../../src/hooks/dashboardState.scheduler',
  );
  return {
    ...actual,
    runDueScheduledWatches,
  };
});

describe('useDashboardState scheduling flows', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  it('seeds a new website watch when an opened library has no watches yet', async () => {
    configureApi(api, makeWorkspace([]));

    const { result } = renderHook(() => useDashboardState());

    await waitFor(() => {
      expect(result.current.workspace.loading).toBe(false);
      expect(result.current.targets).toHaveLength(0);
      expect(result.current.selectedDirectoryName).toBeNull();
      expect(result.current.editorMode).toBe('http');
      expect(result.current.isDraftContext).toBe(true);
      expect(result.current.guidedDraft?.kind).toBe('http');
    });

    expect(api.getTargetTemplate).toHaveBeenCalledWith('http');
  });

  it('delegates periodic scheduling ticks through the scheduler helper once the workbench is live', async () => {
    configureApi(api, makeWorkspace());
    const intervalCallbacks: Array<() => void> = [];
    const realSetInterval = window.setInterval.bind(window);
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (typeof handler !== 'function') {
        throw new Error('Expected a function interval handler.');
      }
      if (timeout === 60_000) {
        intervalCallbacks.push(handler as () => void);
      }
      return realSetInterval(handler, timeout);
    });

    const { result } = renderHook(() => useDashboardState());

    await waitFor(() => {
      expect(result.current.workspace.loading).toBe(false);
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });

    const tick = intervalCallbacks[0];
    if (!tick) {
      throw new Error('Expected the scheduler interval callback.');
    }
    tick();

    expect(runDueScheduledWatches.mock.calls.length).toBeGreaterThan(0);
    expect(runDueScheduledWatches.mock.calls.at(-1)?.[0]).toMatchObject({
      selectedTargetDirectoryName: 'alpha',
    });
  });

  it('creates a default watch profile before bootstrap hydration completes', async () => {
    const bootstrap = deferred<Awaited<ReturnType<typeof api.bootstrap>>>();
    configureApi(api, makeWorkspace());
    api.bootstrap.mockReset();
    api.bootstrap.mockReturnValueOnce(bootstrap.promise);

    const { result } = renderHook(() => useDashboardState());

    act(() => {
      result.current.updateWatchProfile((current) => ({
        ...current,
        paused: true,
        schedule: {
          preset: 'hourly',
          customExpression: null,
        },
      }));
    });

    expect(result.current.watchProfile).toMatchObject({
      paused: true,
      schedule: {
        preset: 'hourly',
        customExpression: null,
      },
    });

    act(() => {
      bootstrap.resolve({
        app: {
          appName: 'Dataarm',
          appVersion: '0.0.0-test',
          runtimeContract: 'embedded-ffhn-core',
        },
        workspace: makeWorkspace(),
      });
    });

    await waitFor(() => {
      expect(result.current.workspace.loading).toBe(false);
    });
  });
});
