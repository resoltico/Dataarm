import type {
  ActionFeedback,
  AsyncState,
  NotificationRecord,
  TargetDraft,
  TargetDraftCanonicalizer,
  TargetDraftSession,
  TargetTemplateKind,
  WorkspaceSnapshot,
} from '../types';
import { isChangedTargetStatus, isTargetErrorStatus } from '../lib/workbenchContract';

export type DetailTab = 'changes' | 'config' | 'artifacts';
export type ArtifactTab = 'preview' | 'run' | 'state' | 'batch';

export function initialState<T>(loading = true): AsyncState<T> {
  return { loading, error: null, data: null };
}

export function createFeedback(tone: ActionFeedback['tone'], message: string): ActionFeedback {
  return { tone, message };
}

export function notificationFeedback(record: NotificationRecord): ActionFeedback {
  return createFeedback(record.tone, record.title);
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readRunOutcome(value: unknown) {
  const report = asRecord(value);
  const result = asRecord(report?.result);
  return typeof result?.kind === 'string' ? result.kind : null;
}

export function cloneDraftSession(session: TargetDraftSession | null) {
  return session == null ? null : structuredClone(session);
}

export function editorSignature(session: TargetDraftSession | null, toml: string) {
  return session == null
    ? toml
    : JSON.stringify({
        draft: session.draft,
        contractSeedToml: session.contractSeedToml,
      });
}

export function normalizeDraftForKind(draft: TargetDraft, kind: TargetTemplateKind): TargetDraft {
  if (kind === 'http') {
    return {
      ...draft,
      kind,
      sourceLocator:
        draft.sourceLocator.startsWith('http://') || draft.sourceLocator.startsWith('https://')
          ? draft.sourceLocator
          : 'https://example.com',
      fetchMethod: 'GET',
      fetchTimeoutMs: draft.fetchTimeoutMs ?? 15000,
      fetchUserAgent: draft.fetchUserAgent ?? 'dataarm/template',
      fetchFollowRedirects: draft.fetchFollowRedirects ?? true,
      fetchAccept: draft.fetchAccept ?? 'text/html,application/xhtml+xml',
    };
  }

  return {
    ...draft,
    kind,
    sourceLocator: draft.sourceLocator.startsWith('/')
      ? draft.sourceLocator
      : '/absolute/path/to/page.html',
    fetchMethod: null,
    fetchTimeoutMs: null,
    fetchUserAgent: null,
    fetchFollowRedirects: null,
    fetchAccept: null,
  };
}

export function normalizeDraftForSelectionKind(
  draft: TargetDraft,
  selectionKind: TargetDraft['selectionKind'],
): TargetDraft {
  if (selectionKind === 'css_selector') {
    return {
      ...draft,
      selectionKind,
      selectionSelector: draft.selectionSelector ?? 'main',
      selectionStart: null,
      selectionEnd: null,
      selectionDelimiterMode: null,
      selectionIncludeStart: null,
      selectionIncludeEnd: null,
      selectionRegexFlags: [],
    };
  }

  return {
    ...draft,
    selectionKind,
    selectionSelector: null,
    selectionStart: draft.selectionStart ?? '<main>',
    selectionEnd: draft.selectionEnd ?? '</main>',
    selectionDelimiterMode: draft.selectionDelimiterMode ?? 'literal',
    selectionIncludeStart: draft.selectionIncludeStart ?? false,
    selectionIncludeEnd: draft.selectionIncludeEnd ?? false,
    selectionRegexFlags: draft.selectionRegexFlags,
  };
}

export function updateDraftField<K extends keyof TargetDraft>(
  draft: TargetDraft,
  field: K,
  value: TargetDraft[K],
): TargetDraft {
  return {
    ...draft,
    [field]: value,
  };
}

export function addDraftCanonicalizer(draft: TargetDraft): TargetDraft {
  return {
    ...draft,
    compareCanonicalizers: [
      ...draft.compareCanonicalizers,
      { kind: 'trim', pattern: null, flags: [] },
    ],
  };
}

export function updateDraftCanonicalizer(
  draft: TargetDraft,
  index: number,
  updater: (canonicalizer: TargetDraftCanonicalizer) => TargetDraftCanonicalizer,
): TargetDraft {
  return {
    ...draft,
    compareCanonicalizers: draft.compareCanonicalizers.map((canonicalizer, currentIndex) =>
      currentIndex === index ? updater(canonicalizer) : canonicalizer,
    ),
  };
}

export function removeDraftCanonicalizer(draft: TargetDraft, index: number): TargetDraft {
  return {
    ...draft,
    compareCanonicalizers: draft.compareCanonicalizers.filter(
      (_, currentIndex) => currentIndex !== index,
    ),
  };
}

export function dashboardStats(snapshot: WorkspaceSnapshot | null) {
  const targets = snapshot?.targets ?? [];

  return {
    total: targets.length,
    runnable: targets.filter((target) => target.runnableTargetId != null).length,
    ready: targets.filter((target) => target.statusKind === 'ready').length,
    changed: targets.filter((target) =>
      isChangedTargetStatus(target.statusKind, target.lastRunOutcome),
    ).length,
    firstRun: targets.filter((target) => target.statusKind === 'pending').length,
    attention: targets.filter(
      (target) => target.errorMessage != null || isTargetErrorStatus(target.statusKind),
    ).length,
  };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
