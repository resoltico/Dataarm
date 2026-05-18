import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { makeNotificationCenter } from './fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderApp(overrides: Record<string, unknown> = {}) {
  vi.resetModules();
  vi.doMock('../../src/lib/api', async () => {
    const actual = await import('../../src/lib/mockDesktop');

    return {
      bootstrap: actual.bootstrapMock,
      openWorkspace: actual.openWorkspaceMock,
      refreshWorkspace: actual.refreshWorkspaceMock,
      createWorkspace: actual.createWorkspaceMock,
      readTarget: actual.readTargetMock,
      getTargetTemplate: actual.getTargetTemplateMock,
      previewTarget: actual.previewTargetMock,
      saveTarget: actual.saveTargetMock,
      updateNotificationSettings: actual.updateNotificationSettingsMock,
      clearNotificationFeed: actual.clearNotificationFeedMock,
      deleteTarget: actual.deleteTargetMock,
      runTarget: actual.runTargetMock,
      runWorkspace: actual.runWorkspaceMock,
      openWorkspacePath: actual.openWorkspacePathMock,
      openTargetPath: actual.openTargetPathMock,
      ...overrides,
    };
  });

  const { default: App } = await import('../../src/App');
  return render(<App />);
}

function targetRow(label: string) {
  const cell = screen.getByText(label);
  const row = cell.closest('tr');
  if (!row) {
    throw new Error(`Expected a target row for ${label}.`);
  }
  return row;
}

describe('App integration', () => {
  it('supports authoring, previewing, saving, and updating notification settings', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    await renderApp();

    await screen.findByRole('heading', { level: 2, name: 'Demo status board' });

    fireEvent.click(screen.getByRole('button', { name: 'New HTTP' }));
    await screen.findByText('New HTTP target');
    await screen.findByText('Loaded the http target template.');

    fireEvent.click(screen.getByRole('button', { name: 'Preview target' }));
    await screen.findByText('Preview ready', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Config' }));

    fireEvent.change(screen.getByLabelText('Target TOML editor'), {
      target: {
        value: [
          'target_id = "release_digest"',
          'display_name = "Release digest"',
          '[target]',
          'kind = "file"',
          'file_path = "/tmp/release-digest.html"',
        ].join('\n'),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save target' }));
    await screen.findByText('Target saved. Baseline artifacts were reset for a clean next run.');
    await screen.findByRole('heading', { level: 2, name: 'Release digest' });

    fireEvent.change(screen.getByLabelText('Deliver via'), {
      target: { value: 'both' },
    });
    await screen.findByText('Notification settings updated.');
  });

  it('surfaces authoring warnings, draft discard decisions, notification warnings, and deletions', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    const actual = await import('../../src/lib/mockDesktop');
    const notificationWarningPayload = await actual.bootstrapMock();
    notificationWarningPayload.workspace.notificationCenter = makeNotificationCenter({
      settings: { notifyWhen: 'changes_and_errors', delivery: 'both' },
      permissionState: 'prompt',
    });

    const previewTarget = vi.fn().mockRejectedValue(new Error('Preview exploded'));
    const updateNotificationSettings = vi
      .fn()
      .mockResolvedValue(notificationWarningPayload.workspace);

    await renderApp({
      previewTarget,
      updateNotificationSettings,
    });

    await screen.findByRole('heading', { level: 2, name: 'Demo status board' });

    fireEvent.click(screen.getByRole('button', { name: 'New HTTP' }));
    await screen.findByText('New HTTP target');
    await screen.findByText('Loaded the http target template.');

    fireEvent.change(screen.getByLabelText('Target TOML editor'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview target' }));
    await screen.findByText('The target document is empty.');

    fireEvent.change(screen.getByLabelText('Target TOML editor'), {
      target: { value: 'target_id = "preview_failure"' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview target' }));
    await screen.findAllByText('Preview exploded');

    fireEvent.click(targetRow('Demo release notes'));
    await screen.findByText('New HTTP target');
    expect(confirm).toHaveBeenCalled();

    confirm.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true);

    fireEvent.click(targetRow('Demo release notes'));
    await screen.findByRole('heading', { level: 2, name: 'Demo release notes' });

    fireEvent.change(screen.getByLabelText('Deliver via'), {
      target: { value: 'both' },
    });
    await screen.findByText('System delivery is not ready on this runtime.');

    fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    await screen.findByRole('heading', { level: 2, name: 'Demo release notes' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    await screen.findByText('Target deleted.');
  });

  it('shows workspace and path failures without dropping the current workspace state', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    const actual = await import('../../src/lib/mockDesktop');
    const bootstrapPayload = await actual.bootstrapMock();
    bootstrapPayload.workspace.recentWorkspaces = [
      ...bootstrapPayload.workspace.recentWorkspaces,
      {
        workspaceName: 'archive-watch-root',
        workspacePath: '/tmp/dataarm/archive-watch-root',
        workspaceSource: 'user',
        lastOpenedAt: '2026-05-16T11:30:00Z',
      },
    ];

    const openWorkspacePath = vi.fn().mockRejectedValue(new Error('Workspace path unavailable'));
    const openTargetPath = vi.fn().mockRejectedValue(new Error('Target path unavailable'));
    const openWorkspace = vi.fn().mockRejectedValue(new Error('Workspace open exploded'));
    const createWorkspace = vi.fn().mockRejectedValue(new Error('Workspace create exploded'));
    const bootstrap = vi.fn().mockResolvedValue(bootstrapPayload);

    await renderApp({
      bootstrap,
      openWorkspacePath,
      openTargetPath,
      openWorkspace,
      createWorkspace,
    });

    await screen.findByRole('heading', { level: 2, name: 'Demo status board' });
    fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    await screen.findByLabelText('Target TOML editor');

    const openFolderButtons = screen.getAllByRole('button', { name: 'Open folder' });
    const primaryOpenFolderButton = openFolderButtons[0];
    if (!primaryOpenFolderButton) {
      throw new Error('Expected the primary open-folder button.');
    }
    fireEvent.click(primaryOpenFolderButton);
    await screen.findByText('Workspace path unavailable');

    fireEvent.change(screen.getByLabelText('Switch watch root'), {
      target: { value: '/tmp/dataarm/new-watch-root' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open watch root' }));
    await screen.findByText('Workspace open exploded');

    fireEvent.click(screen.getByRole('button', { name: 'Create watch root' }));
    await screen.findByText('Workspace create exploded');

    fireEvent.click(screen.getByRole('button', { name: 'archive-watch-root' }));
    await screen.findByText('Workspace open exploded');
    expect(screen.getByRole('heading', { level: 2, name: 'Demo status board' })).toBeTruthy();
  });
});
