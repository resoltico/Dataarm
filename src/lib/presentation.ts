import type {
  JsonValue,
  TargetDraft,
  TargetStatusKind,
  TargetSummary,
  WorkspaceSource,
} from '../types';
import {
  TARGET_SOURCE_KIND_LABELS,
  TARGET_STATUS_COMPACT_LABELS,
  TARGET_STATUS_LABELS,
  TARGET_STATUS_TONES,
} from './workbenchContract';

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

export function statusTone(statusKind: TargetStatusKind) {
  return TARGET_STATUS_TONES[statusKind];
}

export function statusLabel(statusKind: TargetStatusKind) {
  return TARGET_STATUS_LABELS[statusKind];
}

export function compactStatusLabel(statusKind: TargetStatusKind) {
  return TARGET_STATUS_COMPACT_LABELS[statusKind];
}

export function formatSourceKindLabel(sourceKind: TargetSummary['sourceKind']) {
  return sourceKind == null ? 'Unknown source' : TARGET_SOURCE_KIND_LABELS[sourceKind];
}

export function shortenPath(value: string, keep = 56) {
  if (value.length <= keep) {
    return value;
  }

  return `${value.slice(0, keep / 2)}…${value.slice(-(keep / 2 - 1))}`;
}

export function selectionLabelForDraft(draft: TargetDraft) {
  if (draft.selectionKind === 'css_selector') {
    const selector = draft.selectionSelector ?? 'selector';
    if (draft.selectionMatch === 'nth') {
      return `${selector} (nth ${String(draft.selectionIndex ?? 1)})`;
    }
    return `${selector} (${draft.selectionMatch})`;
  }

  const start = draft.selectionStart ?? 'start delimiter';
  const end = draft.selectionEnd ?? 'end delimiter';
  if (draft.selectionMatch === 'nth') {
    return `${start} … ${end} (nth ${String(draft.selectionIndex ?? 1)})`;
  }
  return `${start} … ${end} (${draft.selectionMatch})`;
}

export function sourceLabelForDraft(draft: TargetDraft) {
  return draft.sourceLocator.trim().length > 0 ? draft.sourceLocator : 'Source not configured yet.';
}
