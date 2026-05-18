async function loadMockDesktop() {
  vi.resetModules();
  return import('../../src/lib/mockDesktop');
}

describe('mock desktop backend', () => {
  it('bootstraps the demo workspace and trims opened workspaces', async () => {
    const mockDesktop = await loadMockDesktop();

    const bootstrap = await mockDesktop.bootstrapMock();
    expect(bootstrap.app.appName).toBe('Dataarm');
    expect(bootstrap.workspace.summary.workspaceName).toBe('demo-watch-root');
    expect(bootstrap.workspace.targets).toHaveLength(2);

    const workspace = await mockDesktop.openWorkspaceMock('  /tmp/dataarm/custom-workspace  ');
    expect(workspace.summary.workspacePath).toBe('/tmp/dataarm/custom-workspace');
    expect(workspace.summary.workspaceSource).toBe('user');

    const reopenedDemo = await mockDesktop.openWorkspaceMock();
    expect(reopenedDemo.summary.workspacePath).toBe('/tmp/dataarm/demo-watch-root');
    expect(reopenedDemo.summary.workspaceSource).toBe('demo');
  });

  it('returns templates, previews targets, and persists renamed saves', async () => {
    const mockDesktop = await loadMockDesktop();

    const httpTemplate = await mockDesktop.getTargetTemplateMock('http');
    expect(httpTemplate.kind).toBe('http');
    expect(httpTemplate.draftSession.draft.targetId).toBe('website_watch');
    expect(httpTemplate.canonicalToml).toContain('target_id = "website_watch"');

    const fileTemplate = await mockDesktop.getTargetTemplateMock('file');
    expect(fileTemplate.kind).toBe('file');
    expect(fileTemplate.draftSession.draft.targetId).toBe('file_watch');
    expect(fileTemplate.canonicalToml).toContain('target_id = "file_watch"');

    const preview = await mockDesktop.previewTargetMock({
      rawToml: [
        'schema_name = "ffhn.target"',
        'schema_version = 4',
        'target_id = "release_notes"',
        'display_name = "Release notes"',
        '[target]',
        'kind = "file"',
        'file_path = "/tmp/release-notes.html"',
        '[fetch]',
        'engine = "file"',
        'max_bytes = 2000000',
        '[selection]',
        'kind = "css_selector"',
        'selector = "main"',
        'match = "single"',
        '[compare]',
        'basis = "text"',
        'whitespace = "normalize"',
        'rewrite_urls = false',
      ].join('\n'),
    });
    expect(preview.targetId).toBe('release_notes');
    expect(preview.displayName).toBe('Release notes');
    expect(preview.canonicalToml.endsWith('\n')).toBe(true);
    expect(preview.previewSnapshot?.compareText).toContain('Release notes');
    await expect(
      mockDesktop.previewTargetMock({
        rawToml: 'display_name = "Missing ID"\n',
      }),
    ).rejects.toThrow('target_id is required.');

    const firstSave = await mockDesktop.saveTargetMock({
      rawToml:
        'target_id = "release_notes"\ndisplay_name = "Release notes"\n[target]\nkind = "file"\nfile_path = "/tmp/release-notes.html"\n',
    });
    expect(firstSave.directoryName).toBe('release_notes');
    expect(firstSave.workspace.targets[0]?.directoryName).toBe('release_notes');

    const renamed = await mockDesktop.saveTargetMock({
      previousDirectoryName: 'release_notes',
      rawToml:
        'target_id = "release_digest"\ndisplay_name = "Release digest"\n[target]\nkind = "file"\nfile_path = "/tmp/release-digest.html"\n',
    });
    expect(renamed.directoryName).toBe('release_digest');
    expect(
      renamed.workspace.targets.some((target) => target.directoryName === 'release_notes'),
    ).toBe(false);

    const record = await mockDesktop.readTargetMock('release_digest');
    expect(record.directoryName).toBe('release_digest');
    expect(record.displayName).toBe('Release digest');
    await expect(mockDesktop.readTargetMock('missing_target')).rejects.toThrow(/missing_target/u);

    const minimalSave = await mockDesktop.saveTargetMock({
      rawToml: [
        'schema_name = "ffhn.target"',
        'schema_version = 4',
        'target_id = "minimal_watch"',
        'display_name = "Minimal watch"',
        '[target]',
        'kind = "file"',
        'file_path = "/tmp/minimal-watch.html"',
        '[fetch]',
        'engine = "file"',
        'max_bytes = 2000000',
        '[selection]',
        'kind = "css_selector"',
        'selector = "main"',
        'match = "single"',
        '[compare]',
        'basis = "text"',
        'whitespace = "normalize"',
        'rewrite_urls = false',
      ].join('\n'),
    });
    const minimalTarget = minimalSave.workspace.targets.find(
      (target) => target.directoryName === 'minimal_watch',
    );
    expect(minimalTarget).toMatchObject({
      displayName: 'Minimal watch',
      sourceKind: 'file',
      sourceLocator: '/tmp/minimal-watch.html',
      selectionLabel: 'main (single)',
      compareBasis: 'text',
    });
  });

  it('records notifications, clears them, and suppresses them when policy is off', async () => {
    const mockDesktop = await loadMockDesktop();

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'changes_and_errors',
      delivery: 'both',
    });
    const changedRun = await mockDesktop.runTargetMock('release_notes');
    expect(changedRun.notification?.title).toContain('Change detected');
    expect(changedRun.notification?.deliveredChannels).toEqual(['in_app', 'system']);

    const withNotification = await mockDesktop.refreshWorkspaceMock();
    expect(withNotification.notificationCenter.items).toHaveLength(1);

    const cleared = await mockDesktop.clearNotificationFeedMock();
    expect(cleared.notificationCenter.items).toHaveLength(0);

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'off',
      delivery: 'in_app',
    });
    const silentRun = await mockDesktop.runTargetMock('release_notes');
    expect(silentRun.notification).toBeNull();
  });

  it('runs whole workspaces, deletes targets, and validates open-path requests', async () => {
    const mockDesktop = await loadMockDesktop();

    const statusBoardRun = await mockDesktop.runTargetMock('status_board');
    expect(statusBoardRun.workspace.targets[0]?.directoryName).toBe('status_board');
    expect(statusBoardRun.workspace.targets[0]?.lastRunOutcome).toBe('changed');

    const batch = await mockDesktop.runWorkspaceMock();
    expect(batch.batchReport).toMatchObject({ schema_name: 'ffhn.batch_run_report' });
    expect(batch.notification?.title).toContain('Workspace run found');

    const afterDelete = await mockDesktop.deleteTargetMock('release_notes');
    expect(afterDelete.targets.some((target) => target.directoryName === 'release_notes')).toBe(
      false,
    );

    await expect(mockDesktop.openWorkspacePathMock()).resolves.toBeUndefined();
    await expect(mockDesktop.openTargetPathMock('status_board')).resolves.toBeUndefined();
    await expect(mockDesktop.openTargetPathMock('missing_target')).rejects.toThrow(
      /missing_target/u,
    );
  });

  it('covers empty-workspace notifications and watch-root fallback creation', async () => {
    const mockDesktop = await loadMockDesktop();

    const blankWorkspace = await mockDesktop.createWorkspaceMock('   ');
    expect(blankWorkspace.summary.workspaceName).toBe('watch-root');
    expect(blankWorkspace.summary.workspacePath).toBe('');

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'all_completions',
      delivery: 'system',
    });
    const emptyBatch = await mockDesktop.runWorkspaceMock();
    expect(emptyBatch.notification).toMatchObject({
      title: 'Workspace run completed with no changes.',
      deliveredChannels: ['system'],
    });

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'changes_and_errors',
      delivery: 'in_app',
    });
    const quietEmptyBatch = await mockDesktop.runWorkspaceMock();
    expect(quietEmptyBatch.notification).toBeNull();

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'errors_only',
      delivery: 'in_app',
    });
    const mutedBatch = await mockDesktop.runWorkspaceMock();
    expect(mutedBatch.notification).toBeNull();
  });

  it('exposes helper semantics for parsing, summary fallback, and ordering', async () => {
    const mockDesktop = await loadMockDesktop();
    const internal = mockDesktop.__mockDesktopInternals;

    expect(internal.workspaceSourceForPath('/tmp/dataarm/demo-watch-root')).toBe('demo');
    expect(internal.workspaceSourceForPath('/tmp/dataarm/custom')).toBe('user');
    expect(internal.pathBasename('/')).toBe('watch-root');

    const noCurrentHistory = internal.buildArtifactHistory('helper_watch', 'text', null, []);
    expect(noCurrentHistory?.currentSnapshot).toBeNull();

    const malformedWorkspace = internal.createEmptyWorkspace('/tmp/dataarm/helpers', 'user');
    const malformedDocument = internal.makeDocument(
      malformedWorkspace.workspacePath,
      'helper_watch',
      'target_id = "helper_watch"\n[target]\nkind = "http"\nsource_url = "https://example.com"\n',
      {
        targetId: 'helper_watch',
        displayName: 'Helper watch',
        sourceLocator: 'https://example.com',
        statusKind: 'ready',
        baselinePhase: 'has_baseline',
        lastRunOutcome: null,
        lastRunAt: null,
      },
    );
    malformedDocument.statusReport = { status: { kind: 42 } };
    malformedDocument.stateDocument = {
      baseline_phase: 42,
      last_run: { run_at: 123, outcome: false },
    };
    malformedDocument.lastRunSnapshot = null;

    expect(internal.documentToSummary(malformedDocument)).toMatchObject({
      sourceKind: 'http',
      sourceLocator: 'https://example.com',
      selectionLabel: 'Selection preview unavailable',
      compareBasis: 'text',
      statusKind: 'pending',
      baselinePhase: null,
      lastRunOutcome: null,
      lastRunAt: null,
    });

    const orderWorkspace = internal.createEmptyWorkspace('/tmp/dataarm/ordering', 'user');
    const anchoredDocument = internal.makeDocument(
      orderWorkspace.workspacePath,
      'anchored',
      'target_id = "anchored"\n',
      {
        targetId: 'anchored',
        displayName: 'Anchored',
        sourceLocator: '/tmp/anchored.html',
        statusKind: 'ready',
        baselinePhase: 'never_succeeded',
        lastRunOutcome: null,
        lastRunAt: null,
      },
    );
    const appendedDocument = internal.makeDocument(
      orderWorkspace.workspacePath,
      'appended',
      'target_id = "appended"\n',
      {
        targetId: 'appended',
        displayName: 'Appended',
        sourceLocator: '/tmp/appended.html',
        statusKind: 'ready',
        baselinePhase: 'never_succeeded',
        lastRunOutcome: null,
        lastRunAt: null,
      },
    );
    const trailingDocument = internal.makeDocument(
      orderWorkspace.workspacePath,
      'trailing',
      'target_id = "trailing"\n',
      {
        targetId: 'trailing',
        displayName: 'Trailing',
        sourceLocator: '/tmp/trailing.html',
        statusKind: 'ready',
        baselinePhase: 'never_succeeded',
        lastRunOutcome: null,
        lastRunAt: null,
      },
    );
    orderWorkspace.targets = [internal.documentToSummary(anchoredDocument)];
    orderWorkspace.documents.set(anchoredDocument.directoryName, anchoredDocument);
    orderWorkspace.documents.set(appendedDocument.directoryName, appendedDocument);
    orderWorkspace.documents.set(trailingDocument.directoryName, trailingDocument);

    internal.recalculateWorkspace(orderWorkspace);

    expect(orderWorkspace.targets.map((target) => target.directoryName)).toEqual([
      'anchored',
      'appended',
      'trailing',
    ]);
  });

  it('normalizes delayed thrown values and formats notification helper output', async () => {
    const mockDesktop = await loadMockDesktop();
    const internal = mockDesktop.__mockDesktopInternals;

    await expect(
      internal.resolveDelayedMock(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- deliberately exercises non-Error normalization in resolveDelayedMock.
        throw 'string explosion';
      }, 0),
    ).rejects.toThrow('string explosion');

    await mockDesktop.updateNotificationSettingsMock({
      notifyWhen: 'all_completions',
      delivery: 'both',
    });

    expect(
      internal.recordTargetRunNotification('demo-watch-root', 'Release digest', 'changed'),
    ).toMatchObject({
      tone: 'warning',
      title: 'Change detected in Release digest.',
      deliveredChannels: ['in_app', 'system'],
    });
    expect(
      internal.recordTargetRunNotification('demo-watch-root', 'Release digest', 'initialized'),
    ).toMatchObject({
      tone: 'success',
      title: 'Baseline captured for Release digest.',
      body: 'The first live run in demo-watch-root established a baseline for Release digest.',
    });
    expect(
      internal.recordTargetRunNotification('demo-watch-root', 'Release digest', 'unchanged'),
    ).toMatchObject({
      tone: 'success',
      title: 'No change in Release digest.',
      body: 'The live run in demo-watch-root matched the current baseline for Release digest.',
    });

    expect(
      internal.recordWorkspaceRunNotification('demo-watch-root', {
        changed: 2,
        initialized: 0,
        unchanged: 0,
      }),
    ).toMatchObject({
      title: 'Workspace run found 2 changed targets.',
      body: 'demo-watch-root finished a live batch run with 2 changed targets.',
    });
    expect(
      internal.recordWorkspaceRunNotification('demo-watch-root', {
        changed: 1,
        initialized: 1,
        unchanged: 0,
      }),
    ).toMatchObject({
      title: 'Workspace run found 1 changed target and 1 new baseline.',
      body: 'demo-watch-root finished a live batch run with 1 changed target and 1 new baseline.',
    });

    expect(internal.pluralize(1, 'target')).toBe('1 target');
    expect(internal.pluralize(2, 'target')).toBe('2 targets');
  });
});
