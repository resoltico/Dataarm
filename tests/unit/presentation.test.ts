import { buildCompareDiffView } from '../../src/lib/compareHistory';
import {
  compactStatusLabel,
  formatSourceKindLabel,
  formatSourceLabel,
  formatTimestamp,
  pluralize,
  prettyJson,
  shortenPath,
  statusLabel,
  statusTone,
  summarizeTarget,
  titleCase,
} from '../../src/lib/presentation';
import { makeTarget } from './fixtures';

describe('presentation helpers', () => {
  it('formats human labels and summaries across the supported branches', () => {
    expect(titleCase('failed_transient-state')).toBe('Failed Transient State');
    expect(pluralize(1, 'target')).toBe('1 target');
    expect(pluralize(2, 'target')).toBe('2 targets');
    expect(formatSourceLabel('demo')).toBe('Demo workspace');
    expect(formatSourceLabel('user')).toBe('User workspace');
    expect(prettyJson(null)).toBe('No document loaded.');
    expect(prettyJson({ ok: true })).toContain('"ok": true');
    expect(summarizeTarget(null)).toBe('Select a target or create a new one.');
    expect(summarizeTarget(makeTarget({ displayName: 'Readable' }))).toBe('Readable');
    expect(summarizeTarget(makeTarget({ displayName: null, targetId: 'target_id' }))).toBe(
      'target_id',
    );
    expect(
      summarizeTarget(makeTarget({ displayName: null, targetId: null, directoryName: 'folder' })),
    ).toBe('folder');
  });

  it('formats timestamps, source kinds, and path shortening edge cases', () => {
    expect(formatTimestamp(null)).toBe('Not recorded');
    expect(formatTimestamp(undefined)).toBe('Not recorded');
    expect(formatTimestamp('invalid-date')).toBe('invalid-date');
    expect(formatTimestamp('2026-05-15T11:30:00Z')).toMatch(/2026|May/);
    expect(formatSourceKindLabel('http')).toBe('HTTP source');
    expect(formatSourceKindLabel('file')).toBe('File source');
    expect(formatSourceKindLabel('ftp')).toBe('Unknown source');
    expect(prettyJson(undefined)).toBe('No document loaded.');
    expect(shortenPath('/tmp/dataarm/omitted-default')).toBe('/tmp/dataarm/omitted-default');
    expect(shortenPath('/tmp/dataarm/demo', 56)).toBe('/tmp/dataarm/demo');
    expect(shortenPath('/tmp/dataarm/'.repeat(10), 20)).toContain('…');
  });

  it('maps every status tone and label branch', () => {
    const cases = [
      ['ready', 'success', 'Ready', 'Ready'],
      ['changed', 'warning', 'Change Detected', 'Changed'],
      ['pending', 'warning', 'Needs First Run', 'First run'],
      ['skipped_disabled', 'info', 'Disabled', 'Disabled'],
      ['invalid_config', 'error', 'Config Error', 'Config'],
      ['unavailable_target', 'error', 'Target Missing', 'Missing'],
      ['invalid_state', 'error', 'State Error', 'State'],
      ['incompatible_baseline', 'error', 'Baseline Incompatible', 'Baseline'],
      ['integrity_mismatch', 'error', 'Baseline Mismatch', 'Mismatch'],
      ['directory_invalid', 'error', 'Invalid Folder', 'Invalid'],
      ['status_error', 'error', 'Status Error', 'Status'],
      ['failed_permanent', 'error', 'Run Failed', 'Failed'],
      ['failed_transient', 'info', 'Retry Needed', 'Retry'],
    ] as const;

    for (const [value, tone, fullLabel, compactLabel] of cases) {
      expect(statusTone(value)).toBe(tone);
      expect(statusLabel(value)).toBe(fullLabel);
      expect(compactStatusLabel(value)).toBe(compactLabel);
    }

    expect(statusTone('surprising_status')).toBe('info');
    expect(statusLabel('custom_status')).toBe('Custom Status');
    expect(compactStatusLabel('custom_status')).toBe('Custom Status');
  });
});

describe('compare history diff view', () => {
  it('reports unchanged text', () => {
    expect(buildCompareDiffView('same\ntext', 'same\ntext')).toEqual({
      previousLineCount: 2,
      currentLineCount: 2,
      commonPrefixLines: 2,
      commonSuffixLines: 0,
      previousChangedLines: [],
      currentChangedLines: [],
      changed: false,
    });
  });

  it('reports changed middle lines with shared prefix and suffix', () => {
    expect(buildCompareDiffView('alpha\nold\nomega', 'alpha\nnew\nomega')).toEqual({
      previousLineCount: 3,
      currentLineCount: 3,
      commonPrefixLines: 1,
      commonSuffixLines: 1,
      previousChangedLines: ['old'],
      currentChangedLines: ['new'],
      changed: true,
    });
  });

  it('normalizes carriage returns and line-count differences', () => {
    const diff = buildCompareDiffView('alpha\r\nbeta', 'alpha\nbeta\ngamma');
    expect(diff.previousLineCount).toBe(2);
    expect(diff.currentLineCount).toBe(3);
    expect(diff.commonPrefixLines).toBe(2);
    expect(diff.commonSuffixLines).toBe(0);
    expect(diff.previousChangedLines).toEqual([]);
    expect(diff.currentChangedLines).toEqual(['gamma']);
    expect(diff.changed).toBe(true);
  });
});
