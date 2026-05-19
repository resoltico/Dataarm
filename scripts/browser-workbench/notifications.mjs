function pluralize(count, singular) {
  return `${String(count)} ${count === 1 ? singular : `${singular}s`}`;
}

function permissionStateMessage(permissionState) {
  switch (permissionState) {
    case 'denied':
      return 'System delivery was denied by the platform.';
    case 'prompt':
      return 'System delivery is waiting for a platform permission prompt.';
    case 'prompt_with_rationale':
      return 'System delivery needs a platform permission prompt with rationale.';
    case 'unknown':
    default:
      return 'System delivery is unavailable on this runtime.';
  }
}

function deliveryResult(state) {
  const delivery = state.notificationCenter.settings.delivery;
  const permissionState = state.notificationCenter.permissionState;

  switch (delivery) {
    case 'both':
      return permissionState === 'granted'
        ? { deliveredChannels: ['in_app', 'system'], deliveryError: null }
        : {
            deliveredChannels: ['in_app'],
            deliveryError: permissionStateMessage(permissionState),
          };
    case 'system':
      return permissionState === 'granted'
        ? { deliveredChannels: ['system'], deliveryError: null }
        : {
            deliveredChannels: [],
            deliveryError: permissionStateMessage(permissionState),
          };
    case 'in_app':
    default:
      return { deliveredChannels: ['in_app'], deliveryError: null };
  }
}

function appendNotification(state, entry) {
  state.notificationSequence += 1;
  const delivery = deliveryResult(state);
  const record = {
    id: `browser-workbench-alert-${String(state.notificationSequence)}`,
    createdAt: new Date().toISOString(),
    tone: entry.tone,
    scopeKind: entry.scopeKind,
    title: entry.title,
    body: entry.body,
    workspaceName: entry.workspaceName,
    targetDisplayName: entry.targetDisplayName,
    deliveredChannels: delivery.deliveredChannels,
    deliveryError: delivery.deliveryError,
  };
  state.notificationCenter.items = [record, ...state.notificationCenter.items].slice(0, 24);
  return record;
}

function readRunOutcome(runReport) {
  return typeof runReport?.result?.kind === 'string' ? runReport.result.kind : null;
}

export function recordTargetRunNotification(state, workspaceName, targetDisplayName, runReport) {
  const outcome = readRunOutcome(runReport);
  if (!outcome) {
    return null;
  }

  const policy = state.notificationCenter.settings.notifyWhen;
  if (
    policy === 'off' ||
    policy === 'errors_only' ||
    (policy === 'changes_and_errors' && outcome === 'unchanged')
  ) {
    return null;
  }

  if (outcome === 'changed') {
    return appendNotification(state, {
      tone: 'warning',
      scopeKind: 'target_run',
      title: `Change detected in ${targetDisplayName}.`,
      body: `The live run in ${workspaceName} recorded content changes for ${targetDisplayName}.`,
      workspaceName,
      targetDisplayName,
    });
  }

  if (outcome === 'initialized') {
    return appendNotification(state, {
      tone: 'success',
      scopeKind: 'target_run',
      title: `First check saved for ${targetDisplayName}.`,
      body: `The first live run in ${workspaceName} saved the starting reference for ${targetDisplayName}.`,
      workspaceName,
      targetDisplayName,
    });
  }

  if (outcome === 'unchanged' && policy === 'all_completions') {
    return appendNotification(state, {
      tone: 'success',
      scopeKind: 'target_run',
      title: `No change in ${targetDisplayName}.`,
      body: `The live run in ${workspaceName} matched the saved reference for ${targetDisplayName}.`,
      workspaceName,
      targetDisplayName,
    });
  }

  if (policy === 'all_completions') {
    return appendNotification(state, {
      tone: 'info',
      scopeKind: 'target_run',
      title: `Run completed for ${targetDisplayName}.`,
      body: `The live run in ${workspaceName} finished for ${targetDisplayName} with outcome ${outcome}.`,
      workspaceName,
      targetDisplayName,
    });
  }

  return null;
}

export function recordWorkspaceRunNotification(
  state,
  workspaceName,
  batchReport,
  skippedDirectories,
) {
  const policy = state.notificationCenter.settings.notifyWhen;
  if (policy === 'off') {
    return null;
  }

  if (skippedDirectories.length > 0) {
    return appendNotification(state, {
      tone: 'error',
      scopeKind: 'workspace_run',
      title:
        skippedDirectories.length === 1
          ? 'All-watch check skipped 1 watch.'
          : `All-watch check skipped ${String(skippedDirectories.length)} watches.`,
      body: `${workspaceName} skipped ${pluralize(
        skippedDirectories.length,
        'watch',
      )} because some saved watch files were invalid or unreadable.`,
      workspaceName,
      targetDisplayName: null,
    });
  }

  if (policy === 'errors_only') {
    return null;
  }

  const counts = { changed: 0, initialized: 0, unchanged: 0, other: 0 };
  for (const entry of batchReport?.entries ?? []) {
    switch (entry?.run_report?.result?.kind) {
      case 'changed':
        counts.changed += 1;
        break;
      case 'initialized':
        counts.initialized += 1;
        break;
      case 'unchanged':
        counts.unchanged += 1;
        break;
      default:
        counts.other += 1;
        break;
    }
  }

  if (counts.changed + counts.initialized > 0) {
    const details = [
      counts.changed > 0 ? pluralize(counts.changed, 'changed watch') : null,
      counts.initialized > 0 ? pluralize(counts.initialized, 'new saved reference') : null,
    ]
      .filter(Boolean)
      .join(' and ');

    return appendNotification(state, {
      tone: 'warning',
      scopeKind: 'workspace_run',
      title: `All-watch check found ${details}.`,
      body: `${workspaceName} finished checking all watches with ${details}.`,
      workspaceName,
      targetDisplayName: null,
    });
  }

  if (policy !== 'all_completions') {
    return null;
  }

  return appendNotification(state, {
    tone: 'success',
    scopeKind: 'workspace_run',
    title:
      counts.unchanged > 0 && counts.other === 0
        ? 'All-watch check completed with no changes.'
        : 'All-watch check completed.',
    body:
      counts.unchanged > 0 && counts.other === 0
        ? `${workspaceName} checked ${pluralize(counts.unchanged, 'watch')} and found no changes.`
        : `${workspaceName} completed the full check across ${pluralize(
            counts.changed + counts.initialized + counts.unchanged + counts.other,
            'watch',
          )}.`,
    workspaceName,
    targetDisplayName: null,
  });
}
