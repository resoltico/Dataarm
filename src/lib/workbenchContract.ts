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
  http: 'HTTP source',
  file: 'File source',
} as const satisfies Record<TargetSourceKind, string>;

export const TARGET_SELECTION_KIND_LABELS = {
  css_selector: 'CSS selector',
  delimiter_pair: 'Delimiter pair',
} as const satisfies Record<TargetSelectionKind, string>;

export const TARGET_COMPARE_BASIS_LABELS = {
  text: 'Text',
  inner_html: 'Inner HTML',
  outer_html: 'Outer HTML',
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
  ready: 'Ready',
  pending: 'Needs First Run',
  changed: 'Change Detected',
  skipped_disabled: 'Disabled',
  invalid_config: 'Config Error',
  unavailable_target: 'Target Missing',
  invalid_state: 'State Error',
  incompatible_baseline: 'Baseline Incompatible',
  integrity_mismatch: 'Baseline Mismatch',
  directory_invalid: 'Invalid Folder',
  status_error: 'Status Error',
  failed_permanent: 'Run Failed',
  failed_transient: 'Retry Needed',
} as const satisfies Record<TargetStatusKind, string>;

export const TARGET_STATUS_COMPACT_LABELS = {
  ready: 'Ready',
  pending: 'First run',
  changed: 'Changed',
  skipped_disabled: 'Disabled',
  invalid_config: 'Config',
  unavailable_target: 'Missing',
  invalid_state: 'State',
  incompatible_baseline: 'Baseline',
  integrity_mismatch: 'Mismatch',
  directory_invalid: 'Invalid',
  status_error: 'Status',
  failed_permanent: 'Failed',
  failed_transient: 'Retry',
} as const satisfies Record<TargetStatusKind, string>;

export const TARGET_RUN_OUTCOME_LABELS = {
  unchanged: 'Unchanged',
  changed: 'Changed',
  initialized: 'New baseline',
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
