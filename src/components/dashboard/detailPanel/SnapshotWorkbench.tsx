import { useState } from 'react';

import type { SnapshotArtifactRecord } from '../../../types';
import { buildCompareDiffView } from '../../../lib/compareHistory';
import { formatTimestamp, prettyJson } from '../../../lib/presentation';

function CodeWindow({
  title,
  value,
  emptyMessage,
}: {
  title: string;
  value: string | null | undefined;
  emptyMessage: string;
}) {
  return (
    <div className="code-window">
      <div className="code-window-title">{title}</div>
      <pre>{value && value.trim().length > 0 ? value : emptyMessage}</pre>
    </div>
  );
}

function extractionDisplayValue(record: SnapshotArtifactRecord['extractionRecord'], key: string) {
  const value =
    record && typeof record === 'object' && !Array.isArray(record)
      ? (record as Record<string, unknown>)[key]
      : null;
  if (typeof value === 'string') {
    return value.length > 0 ? value : '—';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function SnapshotWorkbench({
  currentSnapshot,
  previousSnapshot,
  heading,
}: {
  currentSnapshot: SnapshotArtifactRecord;
  previousSnapshot: SnapshotArtifactRecord | null;
  heading: string;
}) {
  const [focus, setFocus] = useState<'rendered' | 'compare' | 'extraction'>(
    previousSnapshot ? 'compare' : 'rendered',
  );
  const compareDiff = previousSnapshot
    ? buildCompareDiffView(previousSnapshot.compareText, currentSnapshot.compareText)
    : null;

  return (
    <div className="snapshot-workbench">
      <div className="snapshot-workbench-head">
        <div>
          <strong>{heading}</strong>
          <p>Dataarm is reading the saved check records directly from this watch.</p>
        </div>
        <div className="artifact-sub-tabs">
          {[
            ['rendered', 'Rendered'],
            ['compare', 'Compare'],
            ['extraction', 'Extraction'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`artifact-sub-tab ${focus === id ? 'artifact-sub-tab-active' : ''}`}
              onClick={() => {
                setFocus(id as typeof focus);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="changes-meta">
        <div className="changes-meta-row">
          <span className="changes-meta-key">Captured</span>
          <span className="changes-meta-val">{formatTimestamp(currentSnapshot.capturedAt)}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Compare digest</span>
          <span className="changes-meta-val">{currentSnapshot.compareDigestSha256}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Outer HTML digest</span>
          <span className="changes-meta-val">{currentSnapshot.outerHtmlSha256}</span>
        </div>
      </div>

      {focus === 'rendered' ? (
        <div className="snapshot-rendered-grid">
          <div className="rendered-preview-frame-shell">
            <div className="code-window-title">Rendered fragment</div>
            <iframe
              aria-label="Rendered fragment preview"
              className="rendered-preview-frame"
              srcDoc={`<!doctype html><html><body>${currentSnapshot.outerHtml}</body></html>`}
              sandbox=""
              title="Rendered fragment preview"
            />
          </div>
          <CodeWindow
            title="Current rendered HTML"
            value={currentSnapshot.outerHtml}
            emptyMessage="No rendered HTML is available."
          />
        </div>
      ) : null}

      {focus === 'compare' ? (
        <div className="changes-diff">
          {compareDiff && previousSnapshot ? (
            <>
              <div className="changes-meta">
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Comparing against</span>
                  <span className="changes-meta-val">
                    {formatTimestamp(previousSnapshot.capturedAt)}
                  </span>
                </div>
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Stable prefix lines</span>
                  <span className="changes-meta-val">{String(compareDiff.commonPrefixLines)}</span>
                </div>
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Stable suffix lines</span>
                  <span className="changes-meta-val">{String(compareDiff.commonSuffixLines)}</span>
                </div>
              </div>

              <CodeWindow
                title="Previous saved text"
                value={
                  compareDiff.previousChangedLines.length > 0
                    ? compareDiff.previousChangedLines.join('\n')
                    : '(no changed lines on the previous side)'
                }
                emptyMessage="No previous saved text is available."
              />
            </>
          ) : null}
          <CodeWindow
            title="Current saved text"
            value={
              compareDiff
                ? compareDiff.currentChangedLines.length > 0
                  ? compareDiff.currentChangedLines.join('\n')
                  : '(no changed lines on the current side)'
                : currentSnapshot.compareText
            }
            emptyMessage="No current saved text is available."
          />
        </div>
      ) : null}

      {focus === 'extraction' ? (
        <>
          <div className="changes-meta">
            <div className="changes-meta-row">
              <span className="changes-meta-key">Selection kind</span>
              <span className="changes-meta-val">
                {extractionDisplayValue(currentSnapshot.extractionRecord, 'selection_kind')}
              </span>
            </div>
            <div className="changes-meta-row">
              <span className="changes-meta-key">Selection match</span>
              <span className="changes-meta-val">
                {extractionDisplayValue(currentSnapshot.extractionRecord, 'selection_match')}
              </span>
            </div>
            <div className="changes-meta-row">
              <span className="changes-meta-key">Selected candidate</span>
              <span className="changes-meta-val">
                {extractionDisplayValue(
                  currentSnapshot.extractionRecord,
                  'selected_candidate_index',
                )}
              </span>
            </div>
            <div className="changes-meta-row">
              <span className="changes-meta-key">Candidate count</span>
              <span className="changes-meta-val">
                {extractionDisplayValue(currentSnapshot.extractionRecord, 'candidate_count')}
              </span>
            </div>
            <div className="changes-meta-row">
              <span className="changes-meta-key">Compare basis</span>
              <span className="changes-meta-val">
                {extractionDisplayValue(currentSnapshot.extractionRecord, 'compare_basis')}
              </span>
            </div>
          </div>
          <CodeWindow
            title="Current extraction details"
            value={prettyJson(currentSnapshot.extractionRecord)}
            emptyMessage="No extraction record is available."
          />
        </>
      ) : null}
    </div>
  );
}

export { CodeWindow };
