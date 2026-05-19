import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useDashboardState } from '../../../src/hooks/useDashboardState';
import { makeNotificationRecord } from '../fixtures';
import { configureApi, makeWorkspace, waitForLoadedState } from './harness';

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

vi.mock('../../../src/lib/api', () => api);

describe('useDashboardState run flows', () => {
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
    configureApi(api);
  });

  it('runs targets and workspaces across notification, feedback, and recovery branches', async () => {
    const workspace = makeWorkspace();
    const refreshWorkspace = makeWorkspace([
      {
        ...workspace.targets[0],
        directoryName: 'alpha',
        targetId: 'alpha',
        displayName: 'Alpha',
        statusKind: 'ready',
        lastRunOutcome: 'changed',
      },
    ]);

    api.refreshWorkspace.mockResolvedValue(refreshWorkspace);
    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDraftField('displayName', 'Alpha dirty');
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Save or reset the draft before checking the saved watch.',
    });

    act(() => {
      result.current.handleResetDraft();
    });
    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
      notification: makeNotificationRecord({
        title: 'Target change detected.',
        deliveredChannels: ['in_app'],
      }),
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Target change detected.',
    });

    act(() => {
      result.current.setActionFeedback(null);
    });
    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
      notification: {
        ...makeNotificationRecord(),
        deliveredChannels: ['system'],
      },
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Run finished with outcome changed.',
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report' },
      notification: null,
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Run finished.',
    });

    api.runTarget.mockReset();
    api.runTarget.mockRejectedValueOnce(new Error('Run exploded'));
    api.refreshWorkspace.mockRejectedValueOnce(new Error('Refresh exploded'));
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    await waitFor(() => {
      expect(result.current.lastRun.error).toBe('Run exploded');
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Run exploded',
      });
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'changed' } },
      notification: null,
    });
    await act(async () => {
      await result.current.handleStartNewTarget('http');
    });
    await act(async () => {
      await result.current.handleRunSelectedTarget();
      await result.current.handleDeleteSelectedTarget();
      await result.current.handleOpenSelectedTargetPath();
    });
    expect(api.deleteTarget).toHaveBeenCalledTimes(0);

    api.openWorkspace.mockResolvedValueOnce(workspace);
    await act(async () => {
      await result.current.handleOpenRecentWorkspace('/tmp/dataarm/back-to-workspace');
    });
    await waitFor(() => {
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });

    api.runTarget.mockReset();
    api.runTarget.mockRejectedValueOnce(new Error('Recovered run failure'));
    api.refreshWorkspace.mockResolvedValueOnce(refreshWorkspace);
    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });
    await waitFor(() => {
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Recovered run failure',
      });
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });

    act(() => {
      result.current.setDraftField('displayName', 'Alpha workspace dirty');
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'Save or reset the draft before checking all watches.',
    });

    act(() => {
      result.current.handleResetDraft();
    });
    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace,
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: makeNotificationRecord({
        scopeKind: 'workspace_run',
        title: 'All-watch check found 1 changed watch.',
        targetDisplayName: null,
        deliveredChannels: ['in_app'],
      }),
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'warning',
      message: 'All-watch check found 1 changed watch.',
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace,
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'success',
      message: 'Workspace batch run finished.',
    });

    api.refreshWorkspace.mockRejectedValueOnce(new Error('Refresh exploded'));
    api.runWorkspace.mockRejectedValueOnce(new Error('Workspace run exploded'));
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    expect(result.current.lastBatch.error).toBe('Workspace run exploded');
    expect(result.current.actionFeedback).toMatchObject({
      tone: 'error',
      message: 'Workspace run exploded',
    });

    api.runWorkspace.mockRejectedValueOnce(new Error('Workspace recovered failure'));
    api.refreshWorkspace.mockResolvedValueOnce(refreshWorkspace);
    await act(async () => {
      await result.current.handleRunWorkspace();
    });
    await waitFor(() => {
      expect(result.current.actionFeedback).toMatchObject({
        tone: 'error',
        message: 'Workspace recovered failure',
      });
      expect(result.current.selectedDirectoryName).toBe('alpha');
    });
  });

  it('preserves the operator workbench tab when runs refresh the selected target document', async () => {
    const workspace = makeWorkspace([
      {
        ...makeWorkspace().targets[0],
        directoryName: 'alpha',
        targetId: 'alpha',
        displayName: 'Alpha',
        statusKind: 'ready',
        lastRunOutcome: 'unchanged',
      },
    ]);

    const { result } = renderHook(() => useDashboardState());
    await waitForLoadedState(result);

    act(() => {
      result.current.setDetailTab('artifacts');
      result.current.setArtifactTab('run');
    });

    api.runTarget.mockResolvedValueOnce({
      workspace,
      directoryName: 'alpha',
      statusReport: { schema_name: 'ffhn.status_report' },
      runReport: { schema_name: 'ffhn.run_report', result: { kind: 'unchanged' } },
      notification: null,
    });

    await act(async () => {
      await result.current.handleRunSelectedTarget();
    });

    expect(result.current.detailTab).toBe('artifacts');
    expect(result.current.artifactTab).toBe('run');

    act(() => {
      result.current.setArtifactTab('batch');
    });

    api.runWorkspace.mockResolvedValueOnce({
      workspace,
      batchReport: { schema_name: 'ffhn.batch_run_report', entries: [] },
      skippedDirectories: [],
      notification: null,
    });

    await act(async () => {
      await result.current.handleRunWorkspace();
    });

    expect(result.current.detailTab).toBe('artifacts');
    expect(result.current.artifactTab).toBe('batch');
  });
});
