import {
  assessWatchSetup,
  explainSourceInspectionError,
  previewCanBeSaved,
} from '../../src/lib/watchSetupAssessment';
import type { TargetPreview } from '../../src/types';
import { makeDocument, makeSnapshotArtifact } from './fixtures';

function makePreview(overrides: Partial<TargetPreview> = {}): TargetPreview {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected a guided session in the preview fixture.');
  }

  return {
    targetId: 'release_notes',
    displayName: 'Release notes',
    canonicalToml: 'target_id = "release_notes"\n',
    draftSession: document.guidedSession,
    statusReport: { schema_name: 'ffhn.status_report' },
    dryRunReport: {
      schema_name: 'ffhn.run_report',
      extraction: { candidate_count: 1 },
      fetch: {
        final_url: 'https://example.com/releases',
        http_status: 200,
      },
      result: { kind: 'initialized' },
    },
    previewSnapshot: makeSnapshotArtifact(),
    previewArtifactIssues: [],
    ...overrides,
  };
}

describe('watchSetupAssessment', () => {
  it('treats a successful setup check as saveable', () => {
    const assessment = assessWatchSetup(makePreview());

    expect(assessment.canSave).toBe(true);
    expect(assessment.title).toBe('Section ready');
    expect(previewCanBeSaved(makePreview())).toBe(true);
  });

  it('turns network failures into repair guidance', () => {
    const preview = makePreview({
      dryRunReport: {
        schema_name: 'ffhn.run_report',
        fetch: { final_url: null, http_status: null },
        result: {
          kind: 'failed_transient',
          cause: 'fetch_network_error',
          error_detail: { message: 'io: Connection refused' },
        },
      },
      previewSnapshot: null,
    });

    const assessment = assessWatchSetup(preview);

    expect(assessment.canSave).toBe(false);
    expect(assessment.title).toBe('Could not reach the page');
    expect(assessment.actionHint).toBe('Check the page URL or server and try again.');
  });

  it('turns selector misses into a section-not-found result', () => {
    const preview = makePreview({
      dryRunReport: {
        schema_name: 'ffhn.run_report',
        fetch: { final_url: 'https://example.com/releases', http_status: 200 },
        result: {
          kind: 'failed_permanent',
          cause: 'selection_no_match',
          error_detail: { message: 'HTMLCut execution failed with NoMatch' },
        },
      },
      previewSnapshot: null,
    });

    const assessment = assessWatchSetup(preview);

    expect(assessment.canSave).toBe(false);
    expect(assessment.title).toBe('Section not found');
    expect(assessment.body).toBe('Dataarm reached the page, but the chosen section was not found.');
  });

  it('treats multi-match setup checks as not ready and preserves the plural section count', () => {
    const preview = makePreview({
      dryRunReport: {
        schema_name: 'ffhn.run_report',
        extraction: { candidate_count: 3 },
        fetch: { final_url: 'https://example.com/releases', http_status: 200 },
        result: { kind: 'initialized' },
      },
      previewSnapshot: null,
    });

    const assessment = assessWatchSetup(preview);

    expect(assessment.canSave).toBe(false);
    expect(assessment.title).toBe('Watch setup needs changes');
    expect(assessment.actionHint).toBeNull();
    expect(assessment.candidateSummary).toBe('Matched 3 sections.');
  });

  it('humanizes page-preview transport errors', () => {
    expect(
      explainSourceInspectionError('Failed to fetch http://127.0.0.1:9/: Connection refused'),
    ).toBe('Dataarm could not reach this page. Check the page URL or server and try again.');
    expect(explainSourceInspectionError('request timed out after 15000ms')).toBe(
      'The page took too long to respond. Try again or raise the timeout in advanced page settings.',
    );
    expect(
      explainSourceInspectionError(
        'Failed to fetch https://example.com: status client error (404 Not Found)',
      ),
    ).toBe('The page returned HTTP 404. Check the page URL or try again later.');
    expect(explainSourceInspectionError('Failed to read /tmp/missing.html')).toBe(
      'Dataarm could not load this page preview. Check the page URL and try again.',
    );
  });

  it('turns HTTP error responses into repair guidance', () => {
    const preview = makePreview({
      dryRunReport: {
        schema_name: 'ffhn.run_report',
        fetch: { final_url: 'https://example.com/missing', http_status: 500 },
        result: {
          kind: 'failed_permanent',
          cause: 'fetch_http_error',
          error_detail: { message: 'HTTP 500' },
        },
      },
      previewSnapshot: null,
    });

    const assessment = assessWatchSetup(preview);

    expect(assessment.canSave).toBe(false);
    expect(assessment.title).toBe('Page returned HTTP 500');
    expect(assessment.actionHint).toBe(
      'Review the page URL or try again when the site is healthy.',
    );
  });

  it('treats timeout-style dry-run failures as page reachability problems', () => {
    const preview = makePreview({
      dryRunReport: {
        schema_name: 'ffhn.run_report',
        fetch: { final_url: 'https://example.com/slow', http_status: null },
        result: {
          kind: 'failed_transient',
          cause: 'fetch_failed',
          error_detail: { message: 'request timed out after 15000ms' },
        },
      },
      previewSnapshot: null,
    });

    const assessment = assessWatchSetup(preview);

    expect(assessment.canSave).toBe(false);
    expect(assessment.title).toBe('Could not reach the page');
    expect(assessment.actionHint).toBe('Check the page URL or server and try again.');
  });
});
