import type {
  JsonValue,
  TargetDraft,
  TargetStatusKind,
  TargetSummary,
  WatchProfile,
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
  return source === 'demo' ? 'Demo library' : 'Your library';
}

export function prettyJson(value: JsonValue | null | undefined) {
  if (value == null) {
    return 'No document loaded.';
  }

  return JSON.stringify(value, null, 2);
}

export function summarizeTarget(target: TargetSummary | null) {
  if (!target) {
    return 'Select a watch or add a new one.';
  }

  return target.displayName ?? target.targetId ?? target.directoryName;
}

export function schedulePresetLabel(profile: WatchProfile) {
  switch (profile.schedule.preset) {
    case 'manual_only':
      return 'Manual only';
    case 'every_5_minutes':
      return 'Every 5 minutes';
    case 'every_15_minutes':
      return 'Every 15 minutes';
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'custom':
      return profile.schedule.customExpression?.trim() || 'Custom schedule';
    default:
      return 'Every 15 minutes';
  }
}

export function alertRuleLabel(profile: WatchProfile) {
  const { alertRule } = profile;
  switch (alertRule.kind) {
    case 'any_change':
      return 'Anything changes';
    case 'text_appears':
      return alertRule.textOperand?.trim()
        ? `Text appears: ${alertRule.textOperand.trim()}`
        : 'Text appears';
    case 'text_disappears':
      return alertRule.textOperand?.trim()
        ? `Text disappears: ${alertRule.textOperand.trim()}`
        : 'Text disappears';
    case 'price_drops_below':
      return alertRule.numericOperand != null
        ? `Price drops below ${String(alertRule.numericOperand)}`
        : 'Price drops below';
    case 'price_changes_by':
      return alertRule.numericOperand != null
        ? `Price changes by ${String(alertRule.numericOperand)}`
        : 'Price changes by';
    case 'regex_match':
      return alertRule.regexPattern?.trim()
        ? `Regular expression matches: ${alertRule.regexPattern.trim()}`
        : 'Regular expression matches';
    default:
      return 'Anything changes';
  }
}

export function deliveryLabel(profile: WatchProfile) {
  switch (profile.delivery) {
    case 'in_app':
      return 'In app';
    case 'system':
      return 'System notifications';
    case 'both':
      return 'In app and system';
    default:
      return 'In app';
  }
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

export function formatCompareBasisLabel(compareBasis: TargetSummary['compareBasis']) {
  switch (compareBasis) {
    case 'text':
      return 'Text only';
    case 'inner_html':
      return 'Section HTML';
    case 'outer_html':
      return 'Section with wrapper';
    default:
      return '—';
  }
}

export function shortenPath(value: string, keep = 56) {
  if (value.length <= keep) {
    return value;
  }

  return `${value.slice(0, keep / 2)}…${value.slice(-(keep / 2 - 1))}`;
}

export function nextScheduledCheckAt(target: TargetSummary, now = new Date()) {
  if (target.watchProfile.paused || target.watchProfile.schedule.preset === 'manual_only') {
    return null;
  }

  const reference = target.lastRunAt ? new Date(target.lastRunAt) : now;
  if (Number.isNaN(reference.valueOf())) {
    return null;
  }

  const next = new Date(reference);
  switch (target.watchProfile.schedule.preset) {
    case 'every_5_minutes':
      next.setMinutes(next.getMinutes() + 5);
      break;
    case 'every_15_minutes':
      next.setMinutes(next.getMinutes() + 15);
      break;
    case 'hourly':
      next.setHours(next.getHours() + 1);
      break;
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekdays':
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekends':
      next.setDate(next.getDate() + 1);
      while (next.getDay() !== 0 && next.getDay() !== 6) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'custom':
      return null;
    default:
      next.setMinutes(next.getMinutes() + 15);
      break;
  }
  return next.toISOString();
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
