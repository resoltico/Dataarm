import type {
  FeedbackTone,
  TargetBaselinePhase,
  TargetCompareBasis,
  TargetRunOutcome,
  TargetSelectionKind,
  TargetSourceKind,
  TargetStatusKind,
} from '../types';

export const TARGET_SOURCE_KINDS = ['http', 'file'] as const satisfies readonly TargetSourceKind[];

export const TARGET_STATUS_KINDS = [
  'ready',
  'pending',
  'changed',
  'skipped_disabled',
  'invalid_config',
  'unavailable_target',
  'invalid_state',
  'incompatible_baseline',
  'integrity_mismatch',
  'directory_invalid',
  'status_error',
  'failed_permanent',
  'failed_transient',
] as const satisfies readonly TargetStatusKind[];

export const TARGET_BASELINE_PHASES = [
  'never_succeeded',
  'has_baseline',
] as const satisfies readonly TargetBaselinePhase[];

export const TARGET_RUN_OUTCOMES = [
  'unchanged',
  'changed',
  'initialized',
] as const satisfies readonly TargetRunOutcome[];

export const TARGET_SOURCE_KIND_LABELS = {
  http: 'Website page',
  file: 'Local file',
} as const satisfies Record<TargetSourceKind, string>;

export const TARGET_SELECTION_KIND_LABELS = {
  css_selector: 'Section selector',
  delimiter_pair: 'Text markers',
} as const satisfies Record<TargetSelectionKind, string>;

export const TARGET_COMPARE_BASIS_LABELS = {
  text: 'Text',
  inner_html: 'Section HTML',
  outer_html: 'Section plus wrapper',
} as const satisfies Record<TargetCompareBasis, string>;

export const TARGET_STATUS_TONES = {
  ready: 'success',
  pending: 'warning',
  changed: 'warning',
  skipped_disabled: 'info',
  invalid_config: 'error',
  unavailable_target: 'error',
  invalid_state: 'error',
  incompatible_baseline: 'error',
  integrity_mismatch: 'error',
  directory_invalid: 'error',
  status_error: 'error',
  failed_permanent: 'error',
  failed_transient: 'info',
} as const satisfies Record<TargetStatusKind, FeedbackTone>;

export const TARGET_STATUS_LABELS = {
  ready: 'Ready to check',
  pending: 'First check needed',
  changed: 'Changed',
  skipped_disabled: 'Paused',
  invalid_config: 'Needs setup',
  unavailable_target: 'Page missing',
  invalid_state: 'Needs repair',
  incompatible_baseline: 'Saved version needs repair',
  integrity_mismatch: 'Saved version needs repair',
  directory_invalid: 'Watch files unavailable',
  status_error: 'Could not check',
  failed_permanent: 'Could not check',
  failed_transient: 'Retry check',
} as const satisfies Record<TargetStatusKind, string>;

export const TARGET_STATUS_COMPACT_LABELS = {
  ready: 'Ready',
  pending: 'Setup',
  changed: 'Changed',
  skipped_disabled: 'Paused',
  invalid_config: 'Setup',
  unavailable_target: 'Missing',
  invalid_state: 'Repair',
  incompatible_baseline: 'Repair',
  integrity_mismatch: 'Repair',
  directory_invalid: 'Folder',
  status_error: 'Failed',
  failed_permanent: 'Failed',
  failed_transient: 'Retry',
} as const satisfies Record<TargetStatusKind, string>;

export const TARGET_RUN_OUTCOME_LABELS = {
  unchanged: 'No change',
  changed: 'Changed',
  initialized: 'First check',
} as const satisfies Record<TargetRunOutcome, string>;

export const TARGET_ERROR_STATUS_KINDS = new Set<TargetStatusKind>([
  'invalid_config',
  'unavailable_target',
  'invalid_state',
  'incompatible_baseline',
  'integrity_mismatch',
  'directory_invalid',
  'status_error',
  'failed_permanent',
  'failed_transient',
]);

export function isTargetErrorStatus(statusKind: TargetStatusKind) {
  return TARGET_ERROR_STATUS_KINDS.has(statusKind);
}

export function isChangedTargetStatus(
  statusKind: TargetStatusKind,
  lastRunOutcome: TargetRunOutcome | null,
) {
  return statusKind === 'changed' || lastRunOutcome === 'changed';
}
