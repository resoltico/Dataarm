import {
  addDraftCanonicalizer,
  cloneDraftSession,
  cloneWatchProfile,
  createFeedback,
  dashboardStats,
  defaultWatchProfile,
  editorSignature,
  errorMessage,
  initialState,
  normalizeDraftForKind,
  normalizeDraftForSelectionKind,
  notificationFeedback,
  readRunOutcome,
  removeDraftCanonicalizer,
  updateDraftCanonicalizer,
  updateDraftField,
} from '../../src/hooks/dashboardState.helpers';
import { makeDocument, makeNotificationRecord, makeTarget, makeWatchProfile } from './fixtures';

describe('dashboard state helpers', () => {
  it('covers async state, feedback, cloning, and outcome parsing helpers', () => {
    expect(initialState()).toEqual({ loading: true, error: null, data: null });
    expect(initialState(false)).toEqual({ loading: false, error: null, data: null });

    expect(createFeedback('warning', 'Needs setup.')).toEqual({
      tone: 'warning',
      message: 'Needs setup.',
    });
    expect(notificationFeedback(makeNotificationRecord())).toEqual({
      tone: 'warning',
      message: 'Change detected in Demo status board.',
    });

    expect(readRunOutcome(null)).toBeNull();
    expect(readRunOutcome({ result: { kind: 'changed' } })).toBe('changed');
    expect(readRunOutcome({ result: { kind: 7 } })).toBeNull();

    const document = makeDocument();
    const clonedSession = cloneDraftSession(document.guidedSession);
    if (!clonedSession || !document.guidedSession) {
      throw new Error('Expected a guided session fixture.');
    }
    expect(clonedSession).toEqual(document.guidedSession);
    expect(clonedSession).not.toBe(document.guidedSession);

    const clonedProfile = cloneWatchProfile(document.watchProfile);
    if (!clonedProfile) {
      throw new Error('Expected a watch profile fixture.');
    }
    expect(clonedProfile).toEqual(document.watchProfile);
    expect(clonedProfile).not.toBe(document.watchProfile);
    expect(cloneDraftSession(null)).toBeNull();
    expect(cloneWatchProfile(null)).toBeNull();
  });

  it('creates default watch profiles and stable editor signatures', () => {
    const document = makeDocument();
    const profile = defaultWatchProfile();

    expect(profile).toEqual({
      schemaName: 'dataarm.watch_profile',
      schemaVersion: 1,
      paused: false,
      folderName: null,
      tags: [],
      schedule: {
        preset: 'every_15_minutes',
        customExpression: null,
      },
      alertRule: {
        kind: 'any_change',
        textOperand: null,
        numericOperand: null,
        regexPattern: null,
        ignoreTextFragments: [],
      },
      delivery: 'in_app',
    });

    const draftSignature = editorSignature(document.guidedSession, '', document.watchProfile);
    const rawTomlSignature = editorSignature(null, 'target_id = "repair"\n', null);

    expect(draftSignature).toContain('"contractSeedToml"');
    expect(rawTomlSignature).toContain('"toml":"target_id = \\"repair\\"\\n"');
    expect(editorSignature(document.guidedSession, '', document.watchProfile)).toBe(draftSignature);
    expect(
      editorSignature(document.guidedSession, '', makeWatchProfile({ paused: true })),
    ).not.toBe(draftSignature);
  });

  it('normalizes draft kinds, selection kinds, fields, and canonicalizers without shims', () => {
    const document = makeDocument();
    if (!document.guidedSession) {
      throw new Error('Expected a guided session fixture.');
    }
    const baseDraft = document.guidedSession.draft;

    const httpDraft = normalizeDraftForKind(
      {
        ...baseDraft,
        kind: 'file',
        sourceLocator: 'relative/path.html',
        fetchMethod: null,
        fetchTimeoutMs: null,
        fetchUserAgent: null,
        fetchFollowRedirects: null,
        fetchAccept: null,
      },
      'http',
    );
    expect(httpDraft.kind).toBe('http');
    expect(httpDraft.sourceLocator).toBe('https://example.com');
    expect(httpDraft.fetchMethod).toBe('GET');
    expect(httpDraft.fetchTimeoutMs).toBe(15000);
    expect(httpDraft.fetchUserAgent).toBe('dataarm/template');
    expect(httpDraft.fetchFollowRedirects).toBe(true);
    expect(httpDraft.fetchAccept).toBe('text/html,application/xhtml+xml');

    const fileDraft = normalizeDraftForKind(
      {
        ...baseDraft,
        kind: 'http',
        sourceLocator: 'example.com/release',
        fetchMethod: 'GET',
        fetchTimeoutMs: 15000,
        fetchUserAgent: 'dataarm/template',
        fetchFollowRedirects: true,
        fetchAccept: 'text/html',
      },
      'file',
    );
    expect(fileDraft.kind).toBe('file');
    expect(fileDraft.sourceLocator).toBe('/absolute/path/to/page.html');
    expect(fileDraft.fetchMethod).toBeNull();
    expect(fileDraft.fetchTimeoutMs).toBeNull();
    expect(fileDraft.fetchUserAgent).toBeNull();
    expect(fileDraft.fetchFollowRedirects).toBeNull();
    expect(fileDraft.fetchAccept).toBeNull();

    const selectorDraft = normalizeDraftForSelectionKind(
      {
        ...baseDraft,
        selectionKind: 'delimiter_pair',
        selectionSelector: null,
        selectionStart: null,
        selectionEnd: null,
        selectionDelimiterMode: 'literal',
        selectionIncludeStart: false,
        selectionIncludeEnd: false,
      },
      'css_selector',
    );
    expect(selectorDraft.selectionKind).toBe('css_selector');
    expect(selectorDraft.selectionSelector).toBe('main');
    expect(selectorDraft.selectionStart).toBeNull();
    expect(selectorDraft.selectionEnd).toBeNull();

    const delimiterDraft = normalizeDraftForSelectionKind(
      {
        ...baseDraft,
        selectionKind: 'css_selector',
        selectionSelector: '.release-card',
        selectionStart: null,
        selectionEnd: null,
        selectionDelimiterMode: null,
        selectionIncludeStart: null,
        selectionIncludeEnd: null,
      },
      'delimiter_pair',
    );
    expect(delimiterDraft.selectionKind).toBe('delimiter_pair');
    expect(delimiterDraft.selectionSelector).toBeNull();
    expect(delimiterDraft.selectionStart).toBe('<main>');
    expect(delimiterDraft.selectionEnd).toBe('</main>');
    expect(delimiterDraft.selectionDelimiterMode).toBe('literal');
    expect(delimiterDraft.selectionIncludeStart).toBe(false);
    expect(delimiterDraft.selectionIncludeEnd).toBe(false);

    const renamedDraft = updateDraftField(baseDraft, 'displayName', 'Release digest');
    expect(renamedDraft.displayName).toBe('Release digest');

    const withCanonicalizer = addDraftCanonicalizer({
      ...baseDraft,
      compareCanonicalizers: [],
    });
    expect(withCanonicalizer.compareCanonicalizers).toEqual([
      { kind: 'trim', pattern: null, flags: [] },
    ]);

    const updatedCanonicalizer = updateDraftCanonicalizer(
      {
        ...baseDraft,
        compareCanonicalizers: [
          { kind: 'strip_regex', pattern: 'Status:', flags: [] },
          { kind: 'trim', pattern: null, flags: [] },
        ],
      },
      0,
      (canonicalizer) => ({
        ...canonicalizer,
        pattern: 'Release:',
        flags: ['case_insensitive'],
      }),
    );
    expect(updatedCanonicalizer.compareCanonicalizers[0]).toEqual({
      kind: 'strip_regex',
      pattern: 'Release:',
      flags: ['case_insensitive'],
    });

    const withoutCanonicalizer = removeDraftCanonicalizer(updatedCanonicalizer, 1);
    expect(withoutCanonicalizer.compareCanonicalizers).toHaveLength(1);
  });

  it('computes dashboard stats and error formatting from the real watch outcomes', () => {
    const snapshot = {
      targets: [
        makeTarget({
          directoryName: 'ready',
          statusKind: 'ready',
          lastRunOutcome: 'unchanged',
        }),
        makeTarget({
          directoryName: 'changed',
          statusKind: 'changed',
          lastRunOutcome: 'changed',
        }),
        makeTarget({
          directoryName: 'pending',
          targetId: null,
          statusKind: 'pending',
          lastRunOutcome: null,
          runnableTargetId: null,
        }),
        makeTarget({
          directoryName: 'attention',
          statusKind: 'failed_transient',
          lastRunOutcome: null,
          errorMessage: 'Fetch failed',
        }),
      ],
    };

    expect(dashboardStats(null)).toEqual({
      total: 0,
      runnable: 0,
      ready: 0,
      changed: 0,
      firstRun: 0,
      attention: 0,
    });
    expect(dashboardStats(snapshot)).toEqual({
      total: 4,
      runnable: 3,
      ready: 1,
      changed: 1,
      firstRun: 1,
      attention: 1,
    });

    expect(errorMessage(new Error('Broken'))).toBe('Broken');
    expect(errorMessage('Plain failure')).toBe('Plain failure');
  });
});
