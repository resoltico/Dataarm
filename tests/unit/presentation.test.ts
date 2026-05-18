import {
  compactStatusLabel,
  formatSourceKindLabel,
  formatSourceLabel,
  formatTimestamp,
  pluralize,
  prettyJson,
  selectionLabelForDraft,
  shortenPath,
  sourceLabelForDraft,
  statusLabel,
  statusTone,
  summarizeTarget,
  titleCase,
} from '../../src/lib/presentation';
import { makeDocument, makeTarget } from './fixtures';

describe('presentation helpers', () => {
  it('covers general formatting helpers and status vocab without relying on incidental renders', () => {
    expect(titleCase('release_notes-ready')).toBe('Release Notes Ready');
    expect(pluralize(1, 'target')).toBe('1 target');
    expect(pluralize(2, 'target')).toBe('2 targets');
    expect(pluralize(3, 'analysis', 'analyses')).toBe('3 analyses');
    expect(formatTimestamp(null)).toBe('Not recorded');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('2026-05-15T11:30:00Z')).not.toBe('Not recorded');
    expect(formatSourceLabel('demo')).toBe('Demo workspace');
    expect(formatSourceLabel('user')).toBe('User workspace');
    expect(prettyJson(null)).toBe('No document loaded.');
    expect(prettyJson({ schema_name: 'ffhn.status_report' })).toContain('ffhn.status_report');
    expect(summarizeTarget(null)).toBe('Select a target or create a new one.');
    expect(
      summarizeTarget(
        makeTarget({
          displayName: null,
          targetId: null,
          directoryName: 'fallback_directory',
        }),
      ),
    ).toBe('fallback_directory');
    expect(
      shortenPath(
        '/tmp/dataarm/release/really/long/path/with/more/segments/than/the/default/window/source.html',
      ),
    ).toContain('…');
    expect(shortenPath('/tmp/dataarm/release.html', 128)).toBe('/tmp/dataarm/release.html');
    expect(shortenPath('/tmp/dataarm/release/really/long/path/source.html', 12)).toContain('…');

    const statusKinds = [
      'ready',
      'changed',
      'pending',
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
      'custom_status',
    ] as const;

    const expected = new Map<
      (typeof statusKinds)[number],
      { tone: string; label: string; compact: string }
    >([
      ['ready', { tone: 'success', label: 'Ready', compact: 'Ready' }],
      ['changed', { tone: 'warning', label: 'Change Detected', compact: 'Changed' }],
      ['pending', { tone: 'warning', label: 'Needs First Run', compact: 'First run' }],
      ['skipped_disabled', { tone: 'info', label: 'Disabled', compact: 'Disabled' }],
      ['invalid_config', { tone: 'error', label: 'Config Error', compact: 'Config' }],
      ['unavailable_target', { tone: 'error', label: 'Target Missing', compact: 'Missing' }],
      ['invalid_state', { tone: 'error', label: 'State Error', compact: 'State' }],
      [
        'incompatible_baseline',
        { tone: 'error', label: 'Baseline Incompatible', compact: 'Baseline' },
      ],
      ['integrity_mismatch', { tone: 'error', label: 'Baseline Mismatch', compact: 'Mismatch' }],
      ['directory_invalid', { tone: 'error', label: 'Invalid Folder', compact: 'Invalid' }],
      ['status_error', { tone: 'error', label: 'Status Error', compact: 'Status' }],
      ['failed_permanent', { tone: 'error', label: 'Run Failed', compact: 'Failed' }],
      ['failed_transient', { tone: 'info', label: 'Retry Needed', compact: 'Retry' }],
      ['custom_status', { tone: 'info', label: 'Custom Status', compact: 'Custom Status' }],
    ]);

    for (const statusKind of statusKinds) {
      const expectation = expected.get(statusKind);
      if (!expectation) {
        throw new Error(`Missing status expectation for ${statusKind}.`);
      }
      expect(statusTone(statusKind)).toBe(expectation.tone);
      expect(statusLabel(statusKind)).toBe(expectation.label);
      expect(compactStatusLabel(statusKind)).toBe(expectation.compact);
    }

    expect(formatSourceKindLabel('http')).toBe('HTTP source');
    expect(formatSourceKindLabel('file')).toBe('File source');
    expect(formatSourceKindLabel(null)).toBe('Unknown source');
  });

  it('formats selector and delimiter selection labels across match variants', () => {
    const document = makeDocument();
    const selectorDraft = {
      ...document.guidedSession.draft,
      selectionKind: 'css_selector' as const,
      selectionSelector: '.release-card',
      selectionMatch: 'nth' as const,
      selectionIndex: null,
    };
    expect(selectionLabelForDraft(selectorDraft)).toBe('.release-card (nth 1)');

    const delimiterNthDraft = {
      ...document.guidedSession.draft,
      selectionKind: 'delimiter_pair' as const,
      selectionMatch: 'nth' as const,
      selectionIndex: null,
      selectionStart: null,
      selectionEnd: null,
    };
    expect(selectionLabelForDraft(delimiterNthDraft)).toBe(
      'start delimiter … end delimiter (nth 1)',
    );

    const delimiterSingleDraft = {
      ...delimiterNthDraft,
      selectionMatch: 'single' as const,
      selectionStart: '<main>',
      selectionEnd: '</main>',
    };
    expect(selectionLabelForDraft(delimiterSingleDraft)).toBe('<main> … </main> (single)');
  });

  it('falls back when the source locator is still blank', () => {
    const document = makeDocument();
    expect(
      sourceLabelForDraft({
        ...document.guidedSession.draft,
        sourceLocator: '   ',
      }),
    ).toBe('Source not configured yet.');
  });
});
