import type { FeedbackTone, JsonValue, TargetPreview } from '../types';

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

export type WatchSetupAssessment = {
  canSave: boolean;
  tone: FeedbackTone;
  badge: string;
  title: string;
  body: string;
  actionHint: string | null;
  candidateSummary: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
};

type RunReportFacts = {
  resultKind: string | null;
  resultCause: string | null;
  errorMessage: string | null;
  candidateCount: number | null;
  finalUrl: string | null;
  httpStatus: number | null;
};

function readRunReportFacts(report: JsonValue) {
  const root = asRecord(report);
  const result = asRecord(root?.result);
  const errorDetail = asRecord(result?.error_detail);
  const extraction = asRecord(root?.extraction);
  const fetch = asRecord(root?.fetch);

  return {
    resultKind: asString(result?.kind),
    resultCause: asString(result?.cause),
    errorMessage: asString(errorDetail?.message),
    candidateCount: asNumber(extraction?.candidate_count),
    finalUrl: asString(fetch?.final_url),
    httpStatus: asNumber(fetch?.http_status),
  } satisfies RunReportFacts;
}

function candidateSummaryForCount(candidateCount: number | null) {
  if (candidateCount == null) {
    return null;
  }
  return `Matched ${pluralize(candidateCount, 'section')}.`;
}

export function explainSourceInspectionError(message: string) {
  if (/Connection refused/i.test(message)) {
    return 'Dataarm could not reach this page. Check the page URL or server and try again.';
  }
  if (/timed out/i.test(message)) {
    return 'The page took too long to respond. Try again or raise the timeout in advanced page settings.';
  }
  const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
  const httpStatus = statusMatch?.[1];
  if (httpStatus) {
    return `The page returned HTTP ${httpStatus}. Check the page URL or try again later.`;
  }
  if (/Failed to fetch /i.test(message) || /Failed to read /i.test(message)) {
    return 'Dataarm could not load this page preview. Check the page URL and try again.';
  }
  return message;
}

function failureAssessment(facts: RunReportFacts): WatchSetupAssessment {
  const candidateSummary = candidateSummaryForCount(facts.candidateCount);
  const technicalMessage = facts.errorMessage;

  if (facts.resultCause === 'selection_no_match') {
    return {
      canSave: false,
      tone: 'error',
      badge: 'FIX',
      title: 'Section not found',
      body: 'Dataarm reached the page, but the chosen section was not found.',
      actionHint:
        'Load the page preview again and choose a section, or edit the selector manually.',
      candidateSummary,
      finalUrl: facts.finalUrl,
      httpStatus: facts.httpStatus,
    };
  }

  if (facts.httpStatus != null && facts.httpStatus >= 400) {
    return {
      canSave: false,
      tone: 'error',
      badge: 'ERR',
      title: `Page returned HTTP ${String(facts.httpStatus)}`,
      body: 'Dataarm reached the server, but the page did not load successfully.',
      actionHint: 'Review the page URL or try again when the site is healthy.',
      candidateSummary,
      finalUrl: facts.finalUrl,
      httpStatus: facts.httpStatus,
    };
  }

  if (
    facts.resultCause === 'fetch_network_error' ||
    (technicalMessage != null && /Connection refused|dns|timed out/i.test(technicalMessage))
  ) {
    return {
      canSave: false,
      tone: 'error',
      badge: 'ERR',
      title: 'Could not reach the page',
      body: 'Dataarm could not connect to this page.',
      actionHint: 'Check the page URL or server and try again.',
      candidateSummary,
      finalUrl: facts.finalUrl,
      httpStatus: facts.httpStatus,
    };
  }

  return {
    canSave: false,
    tone: 'warning',
    badge: 'FIX',
    title: 'Watch setup needs changes',
    body: technicalMessage ?? 'Dataarm could not validate this watch setup yet.',
    actionHint: null,
    candidateSummary,
    finalUrl: facts.finalUrl,
    httpStatus: facts.httpStatus,
  };
}

export function assessWatchSetup(preview: TargetPreview): WatchSetupAssessment {
  const facts = readRunReportFacts(preview.dryRunReport);
  const candidateSummary = candidateSummaryForCount(facts.candidateCount);

  if (
    (facts.resultKind === 'initialized' ||
      facts.resultKind === 'unchanged' ||
      facts.resultKind === 'changed') &&
    (preview.draftSession.draft.selectionMatch !== 'single' ||
      facts.candidateCount == null ||
      facts.candidateCount === 1)
  ) {
    return {
      canSave: true,
      tone: 'success',
      badge: 'OK',
      title: 'Section ready',
      body: 'Dataarm reached the page and extracted the chosen section. You can save this watch now.',
      actionHint: candidateSummary,
      candidateSummary,
      finalUrl: facts.finalUrl,
      httpStatus: facts.httpStatus,
    };
  }

  return failureAssessment(facts);
}

export function previewCanBeSaved(preview: TargetPreview | null) {
  return preview != null && assessWatchSetup(preview).canSave;
}
