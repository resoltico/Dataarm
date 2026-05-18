import type { JsonValue, TargetSummary, WorkspaceSource } from '../types';

export function titleCase(value: string) {
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function formatSourceLabel(source: WorkspaceSource) {
  return source === 'demo' ? 'Demo workspace' : 'User workspace';
}

export function prettyJson(value: JsonValue | null | undefined) {
  if (value == null) {
    return 'No document loaded.';
  }

  return JSON.stringify(value, null, 2);
}

export function summarizeTarget(target: TargetSummary | null) {
  if (!target) {
    return 'Select a target or create a new one.';
  }

  return target.displayName ?? target.targetId ?? target.directoryName;
}

export function statusTone(statusKind: string) {
  switch (statusKind) {
    case 'ready':
      return 'success';
    case 'changed':
      return 'warning';
    case 'pending':
      return 'warning';
    case 'skipped_disabled':
      return 'info';
    case 'invalid_config':
    case 'unavailable_target':
    case 'invalid_state':
    case 'incompatible_baseline':
    case 'integrity_mismatch':
    case 'directory_invalid':
    case 'status_error':
    case 'failed_permanent':
      return 'error';
    case 'failed_transient':
    default:
      return 'info';
  }
}

export function statusLabel(statusKind: string) {
  switch (statusKind) {
    case 'ready':
      return 'Ready';
    case 'pending':
      return 'Needs First Run';
    case 'changed':
      return 'Change Detected';
    case 'skipped_disabled':
      return 'Disabled';
    case 'invalid_config':
      return 'Config Error';
    case 'unavailable_target':
      return 'Target Missing';
    case 'invalid_state':
      return 'State Error';
    case 'incompatible_baseline':
      return 'Baseline Incompatible';
    case 'integrity_mismatch':
      return 'Baseline Mismatch';
    case 'directory_invalid':
      return 'Invalid Folder';
    case 'status_error':
      return 'Status Error';
    case 'failed_permanent':
      return 'Run Failed';
    case 'failed_transient':
      return 'Retry Needed';
    default:
      return titleCase(statusKind);
  }
}

export function compactStatusLabel(statusKind: string) {
  switch (statusKind) {
    case 'ready':
      return 'Ready';
    case 'pending':
      return 'First run';
    case 'changed':
      return 'Changed';
    case 'skipped_disabled':
      return 'Disabled';
    case 'invalid_config':
      return 'Config';
    case 'unavailable_target':
      return 'Missing';
    case 'invalid_state':
      return 'State';
    case 'incompatible_baseline':
      return 'Baseline';
    case 'integrity_mismatch':
      return 'Mismatch';
    case 'directory_invalid':
      return 'Invalid';
    case 'status_error':
      return 'Status';
    case 'failed_permanent':
      return 'Failed';
    case 'failed_transient':
      return 'Retry';
    default:
      return titleCase(statusKind);
  }
}

export function formatSourceKindLabel(sourceKind: string | null | undefined) {
  switch (sourceKind) {
    case 'http':
      return 'HTTP source';
    case 'file':
      return 'File source';
    default:
      return 'Unknown source';
  }
}

export function shortenPath(value: string, keep = 56) {
  if (value.length <= keep) {
    return value;
  }

  return `${value.slice(0, keep / 2)}…${value.slice(-(keep / 2 - 1))}`;
}
