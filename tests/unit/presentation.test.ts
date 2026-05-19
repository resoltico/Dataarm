import {
  alertRuleLabel,
  compactStatusLabel,
  deliveryLabel,
  formatCompareBasisLabel,
  formatSourceKindLabel,
  formatSourceLabel,
  formatTimestamp,
  nextScheduledCheckAt,
  pluralize,
  prettyJson,
  schedulePresetLabel,
  selectionLabelForDraft,
  shortenPath,
  sourceLabelForDraft,
  statusLabel,
  statusTone,
  summarizeTarget,
  titleCase,
} from '../../src/lib/presentation';
import { makeDocument, makeTarget, makeWatchProfile } from './fixtures';

describe('presentation helpers', () => {
  it('covers general formatting helpers and status vocab without relying on incidental renders', () => {
    expect(titleCase('release_notes-ready')).toBe('Release Notes Ready');
    expect(pluralize(1, 'target')).toBe('1 target');
    expect(pluralize(2, 'target')).toBe('2 targets');
    expect(pluralize(3, 'analysis', 'analyses')).toBe('3 analyses');
    expect(formatTimestamp(null)).toBe('Not recorded');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('2026-05-15T11:30:00Z')).not.toBe('Not recorded');
    expect(formatSourceLabel('demo')).toBe('Demo library');
    expect(formatSourceLabel('user')).toBe('Your library');
    expect(prettyJson(null)).toBe('No document loaded.');
    expect(prettyJson({ schema_name: 'ffhn.status_report' })).toContain('ffhn.status_report');
    expect(summarizeTarget(null)).toBe('Select a watch or add a new one.');
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
    ] as const;

    const expected = new Map<
      (typeof statusKinds)[number],
      { tone: string; label: string; compact: string }
    >([
      ['ready', { tone: 'success', label: 'Ready to check', compact: 'Ready' }],
      ['changed', { tone: 'warning', label: 'Changed', compact: 'Changed' }],
      ['pending', { tone: 'warning', label: 'First check needed', compact: 'Setup' }],
      ['skipped_disabled', { tone: 'info', label: 'Paused', compact: 'Paused' }],
      ['invalid_config', { tone: 'error', label: 'Needs setup', compact: 'Setup' }],
      ['unavailable_target', { tone: 'error', label: 'Page missing', compact: 'Missing' }],
      ['invalid_state', { tone: 'error', label: 'Needs repair', compact: 'Repair' }],
      [
        'incompatible_baseline',
        { tone: 'error', label: 'Saved version needs repair', compact: 'Repair' },
      ],
      [
        'integrity_mismatch',
        { tone: 'error', label: 'Saved version needs repair', compact: 'Repair' },
      ],
      ['directory_invalid', { tone: 'error', label: 'Watch files unavailable', compact: 'Folder' }],
      ['status_error', { tone: 'error', label: 'Could not check', compact: 'Failed' }],
      ['failed_permanent', { tone: 'error', label: 'Could not check', compact: 'Failed' }],
      ['failed_transient', { tone: 'info', label: 'Retry check', compact: 'Retry' }],
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

    expect(formatSourceKindLabel('http')).toBe('Website page');
    expect(formatSourceKindLabel('file')).toBe('Local file');
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

  it('formats watch schedules, alert rules, delivery, compare basis, and next checks', () => {
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'manual_only', customExpression: null } }),
      ),
    ).toBe('Manual only');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'every_5_minutes', customExpression: null } }),
      ),
    ).toBe('Every 5 minutes');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'every_15_minutes', customExpression: null } }),
      ),
    ).toBe('Every 15 minutes');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'hourly', customExpression: null } }),
      ),
    ).toBe('Hourly');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'daily', customExpression: null } }),
      ),
    ).toBe('Daily');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'weekdays', customExpression: null } }),
      ),
    ).toBe('Weekdays');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'weekends', customExpression: null } }),
      ),
    ).toBe('Weekends');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'custom', customExpression: '0 9 * * 1-5' } }),
      ),
    ).toBe('0 9 * * 1-5');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'custom', customExpression: '   ' } }),
      ),
    ).toBe('Custom schedule');
    expect(
      schedulePresetLabel(
        makeWatchProfile({ schedule: { preset: 'unknown' as never, customExpression: null } }),
      ),
    ).toBe('Every 15 minutes');

    expect(alertRuleLabel(makeWatchProfile())).toBe('Anything changes');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'text_appears',
            textOperand: 'In stock',
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Text appears: In stock');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'text_appears',
            textOperand: '   ',
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Text appears');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'text_disappears',
            textOperand: 'Sold out',
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Text disappears: Sold out');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'text_disappears',
            textOperand: null,
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Text disappears');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'price_drops_below',
            textOperand: null,
            numericOperand: 9.99,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Price drops below 9.99');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'price_drops_below',
            textOperand: null,
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Price drops below');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'price_changes_by',
            textOperand: null,
            numericOperand: 5,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Price changes by 5');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'price_changes_by',
            textOperand: null,
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Price changes by');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'regex_match',
            textOperand: null,
            numericOperand: null,
            regexPattern: 'Release [0-9]+',
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Regular expression matches: Release [0-9]+');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'regex_match',
            textOperand: null,
            numericOperand: null,
            regexPattern: '   ',
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Regular expression matches');
    expect(
      alertRuleLabel(
        makeWatchProfile({
          alertRule: {
            kind: 'unknown' as never,
            textOperand: null,
            numericOperand: null,
            regexPattern: null,
            ignoreTextFragments: [],
          },
        }),
      ),
    ).toBe('Anything changes');

    expect(deliveryLabel(makeWatchProfile({ delivery: 'in_app' }))).toBe('In app');
    expect(deliveryLabel(makeWatchProfile({ delivery: 'system' }))).toBe('System notifications');
    expect(deliveryLabel(makeWatchProfile({ delivery: 'both' }))).toBe('In app and system');
    expect(deliveryLabel(makeWatchProfile({ delivery: 'unknown' as never }))).toBe('In app');

    expect(formatCompareBasisLabel('text')).toBe('Text only');
    expect(formatCompareBasisLabel('inner_html')).toBe('Section HTML');
    expect(formatCompareBasisLabel('outer_html')).toBe('Section with wrapper');
    expect(formatCompareBasisLabel(null)).toBe('—');

    const now = new Date('2026-05-19T12:00:00Z');
    const baseTarget = makeTarget({
      watchProfile: makeWatchProfile({
        schedule: { preset: 'every_15_minutes', customExpression: null },
      }),
      lastRunAt: '2026-05-19T11:45:00Z',
    });
    expect(
      nextScheduledCheckAt(
        { ...baseTarget, watchProfile: makeWatchProfile({ paused: true }) },
        now,
      ),
    ).toBeNull();
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'manual_only', customExpression: null },
          }),
        },
        now,
      ),
    ).toBeNull();
    expect(nextScheduledCheckAt({ ...baseTarget, lastRunAt: 'not-a-date' }, now)).toBeNull();
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'every_5_minutes', customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-19T11:50:00.000Z');
    expect(nextScheduledCheckAt(baseTarget, now)).toBe('2026-05-19T12:00:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'hourly', customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-19T12:45:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({ schedule: { preset: 'daily', customExpression: null } }),
        },
        now,
      ),
    ).toBe('2026-05-20T11:45:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          lastRunAt: '2026-05-15T11:45:00Z',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'weekdays', customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-18T11:45:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          lastRunAt: '2026-05-18T11:45:00Z',
          watchProfile: makeWatchProfile({
            schedule: { preset: 'weekends', customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-23T11:45:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'custom', customExpression: '0 9 * * 1-5' },
          }),
        },
        now,
      ),
    ).toBeNull();
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'unexpected' as never, customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-19T12:00:00.000Z');
    expect(
      nextScheduledCheckAt(
        {
          ...baseTarget,
          lastRunAt: null,
          watchProfile: makeWatchProfile({
            schedule: { preset: 'hourly', customExpression: null },
          }),
        },
        now,
      ),
    ).toBe('2026-05-19T13:00:00.000Z');
  });
});
