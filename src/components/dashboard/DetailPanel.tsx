import { useState } from 'react';
import { TargetEditor } from './TargetEditor';
import { StatusPill } from '../StatusPill';
import {
  formatTimestamp,
  prettyJson,
  selectionLabelForDraft,
  summarizeTarget,
} from '../../lib/presentation';
import { buildCompareDiffView } from '../../lib/compareHistory';
import type { SnapshotArtifactRecord } from '../../types';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;
type DetailTab = StateType['detailTab'];
type ArtifactTab = StateType['artifactTab'];

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

function SnapshotWorkbench({
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
          <p>
            Dataarm is reading the canonical FFHN snapshot artifacts directly from the target
            directory.
          </p>
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
            title="Current outer.html"
            value={currentSnapshot.outerHtml}
            emptyMessage="No rendered outer.html artifact is available."
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
                title="Previous compare.txt"
                value={
                  compareDiff.previousChangedLines.length > 0
                    ? compareDiff.previousChangedLines.join('\n')
                    : '(no changed lines on the previous side)'
                }
                emptyMessage="No previous compare payload is available."
              />
            </>
          ) : null}
          <CodeWindow
            title="Current compare.txt"
            value={
              compareDiff
                ? compareDiff.currentChangedLines.length > 0
                  ? compareDiff.currentChangedLines.join('\n')
                  : '(no changed lines on the current side)'
                : currentSnapshot.compareText
            }
            emptyMessage="No current compare payload is available."
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
            title="Current extraction.json"
            value={prettyJson(currentSnapshot.extractionRecord)}
            emptyMessage="No extraction record is available."
          />
        </>
      ) : null}
    </div>
  );
}

function ArtifactsTab({ state }: { state: StateType }) {
  const activeArtifactTab = state.artifactTab;
  const artifactHistory = state.document.data?.artifactHistory;
  const currentSnapshot = artifactHistory?.currentSnapshot ?? null;
  const previewStatus = state.preview.data ? prettyJson(state.preview.data.statusReport) : null;
  const previewRun = state.preview.data ? prettyJson(state.preview.data.dryRunReport) : null;
  const lastRunReport = state.lastRun.data ? prettyJson(state.lastRun.data.runReport) : null;
  const lastRunStatus = state.lastRun.data ? prettyJson(state.lastRun.data.statusReport) : null;
  const persistedStatus = prettyJson(state.document.data?.statusReport);
  const stateDocument = prettyJson(state.document.data?.stateDocument);
  const batchReport = state.lastBatch.data ? prettyJson(state.lastBatch.data.batchReport) : null;
  const skippedDirectories = state.lastBatch.data?.skippedDirectories ?? [];
  const skippedReport = skippedDirectories.length
    ? JSON.stringify(skippedDirectories, null, 2)
    : null;

  const artifactTabs: Array<{ id: ArtifactTab; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'run', label: 'Last run' },
    { id: 'state', label: 'State' },
    { id: 'batch', label: 'Batch' },
  ];

  return (
    <div className="artifacts-tab">
      <div className="artifact-sub-tabs">
        {artifactTabs.map((t) => (
          <button
            key={t.id}
            className={`artifact-sub-tab ${activeArtifactTab === t.id ? 'artifact-sub-tab-active' : ''}`}
            onClick={() => {
              state.setArtifactTab(t.id);
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="artifact-content">
        {activeArtifactTab === 'preview' ? (
          <>
            {state.preview.error ? <p className="error">{state.preview.error}</p> : null}
            {state.previewArtifactIssues.map((issue) => (
              <p key={issue} className="error">
                {issue}
              </p>
            ))}
            <CodeWindow
              title="Status report"
              value={previewStatus}
              emptyMessage="Preview to inspect the canonical ffhn.status_report."
            />
            <CodeWindow
              title="Dry-run report"
              value={previewRun}
              emptyMessage="Preview to inspect the canonical ffhn.run_report."
            />
          </>
        ) : null}
        {activeArtifactTab === 'run' ? (
          <>
            {state.lastRun.error ? <p className="error">{state.lastRun.error}</p> : null}
            <CodeWindow
              title="Run status report"
              value={lastRunStatus ?? persistedStatus}
              emptyMessage="Run a target or load one with status output."
            />
            <CodeWindow
              title="Last run snapshot"
              value={lastRunReport ?? prettyJson(state.document.data?.lastRunSnapshot)}
              emptyMessage="Live runs write last_run.json here."
            />
          </>
        ) : null}
        {activeArtifactTab === 'state' ? (
          <>
            {state.document.data?.artifactIssues.length ? (
              <div className="artifact-issue-list">
                {state.document.data.artifactIssues.map((issue) => (
                  <p key={issue} className="error">
                    {issue}
                  </p>
                ))}
              </div>
            ) : null}
            <CodeWindow
              title="State document"
              value={stateDocument}
              emptyMessage="No persisted state document yet."
            />
            <CodeWindow
              title="Persisted status"
              value={persistedStatus}
              emptyMessage="No persisted status report yet."
            />
            <CodeWindow
              title="Current compare.txt"
              value={currentSnapshot?.compareText ?? null}
              emptyMessage="No current baseline compare artifact yet."
            />
            <CodeWindow
              title="Current extraction.json"
              value={currentSnapshot ? prettyJson(currentSnapshot.extractionRecord) : null}
              emptyMessage="No current extraction record yet."
            />
          </>
        ) : null}
        {activeArtifactTab === 'batch' ? (
          <>
            {state.lastBatch.error ? <p className="error">{state.lastBatch.error}</p> : null}
            <CodeWindow
              title="Batch report"
              value={batchReport}
              emptyMessage="Run the whole workspace to inspect the batch report."
            />
            <CodeWindow
              title="Skipped directories"
              value={skippedReport}
              emptyMessage="No directories were skipped."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function DraftPreviewTab({ state }: { state: StateType }) {
  const previewStatus = state.preview.data ? prettyJson(state.preview.data.statusReport) : null;
  const previewRun = state.preview.data ? prettyJson(state.preview.data.dryRunReport) : null;

  if (state.preview.loading) {
    return (
      <div className="changes-tab-empty">
        <p>Previewing the current draft against the canonical FFHN runtime contract.</p>
      </div>
    );
  }

  if (state.preview.error) {
    return (
      <div className="changes-tab">
        <div className="outcome-card outcome-card-failed">
          <div className="outcome-card-icon">ERR</div>
          <div className="outcome-card-body">
            <strong>Preview failed</strong>
            <span>{state.preview.error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!state.preview.data) {
    return (
      <div className="changes-tab-empty">
        <p>Preview this draft to validate the target contract before saving it.</p>
      </div>
    );
  }

  const previewDraft = state.preview.data.draftSession.draft;

  return (
    <div className="changes-tab">
      <div className="outcome-card outcome-card-init">
        <div className="outcome-card-icon">DRV</div>
        <div className="outcome-card-body">
          <strong>Preview ready</strong>
          <span>
            FFHN accepted the draft and Dataarm loaded the canonical preview artifacts into the
            workbench.
          </span>
        </div>
      </div>

      <div className="inline-actions">
        <button
          className="button-primary"
          disabled={state.loadingTarget || state.saving}
          onClick={state.handleSave}
        >
          {state.saving ? 'Saving…' : 'Save target'}
        </button>
        <button
          className="button-quiet"
          onClick={() => {
            state.setDetailTab('config');
          }}
          type="button"
        >
          Review config
        </button>
      </div>

      <div className="changes-meta">
        <div className="changes-meta-row">
          <span className="changes-meta-key">Target ID</span>
          <span className="changes-meta-val">{state.preview.data.targetId}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Display name</span>
          <span className="changes-meta-val">{state.preview.data.displayName}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Selection</span>
          <span className="changes-meta-val">{selectionLabelForDraft(previewDraft)}</span>
        </div>
      </div>

      {state.previewArtifactIssues.map((issue) => (
        <p key={issue} className="error">
          {issue}
        </p>
      ))}

      {state.previewSnapshot ? (
        <SnapshotWorkbench
          currentSnapshot={state.previewSnapshot}
          previousSnapshot={null}
          heading="Preview inspection"
        />
      ) : null}

      <CodeWindow
        title="Preview status report"
        value={previewStatus}
        emptyMessage="No preview status report is available."
      />
      <CodeWindow
        title="Preview dry-run report"
        value={previewRun}
        emptyMessage="No preview dry-run report is available."
      />
    </div>
  );
}

function ChangesTab({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const artifactHistory = state.document.data?.artifactHistory;
  const currentSnapshot = artifactHistory?.currentSnapshot ?? null;
  const snapshotHistory = artifactHistory?.snapshotHistory ?? [];
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);

  if (state.isDraftContext) {
    return <DraftPreviewTab state={state} />;
  }

  if (!target) {
    return (
      <div className="changes-tab-empty">
        <p>Select a target to view its change status.</p>
      </div>
    );
  }

  const outcome = target.lastRunOutcome;
  const selectedHistoryIndex = Math.max(
    0,
    snapshotHistory.findIndex(
      (snapshot) => `${snapshot.capturedAt}-${snapshot.compareDigestSha256}` === selectedHistoryKey,
    ),
  );

  type OutcomeConfig = { label: string; cls: string; icon: string; desc: string };
  const outcomeConfigs: Record<string, OutcomeConfig> = {
    changed: {
      label: 'Content Changed',
      cls: 'outcome-card-changed',
      icon: 'CHG',
      desc: 'The extracted content differs from the recorded baseline.',
    },
    unchanged: {
      label: 'No Changes Detected',
      cls: 'outcome-card-ok',
      icon: 'OK',
      desc: 'The extracted content matches the baseline exactly.',
    },
    initialized: {
      label: 'Baseline Recorded',
      cls: 'outcome-card-init',
      icon: 'NEW',
      desc: 'First run completed. Future runs will compare against this baseline.',
    },
  };

  const neverRun = !outcome;
  const config = outcome ? outcomeConfigs[outcome] : null;

  return (
    <div className="changes-tab">
      {neverRun ? (
        <div className="outcome-card outcome-card-none">
          <div className="outcome-card-icon">IDLE</div>
          <div className="outcome-card-body">
            <strong>Never Run</strong>
            <span>Run this target to record the first baseline.</span>
          </div>
          <button
            className="button-strong outcome-card-run"
            onClick={state.handleRunSelectedTarget}
            disabled={state.isBusy}
            type="button"
          >
            {state.runningTarget ? 'Running target…' : 'Run target'}
          </button>
        </div>
      ) : config ? (
        <div className={`outcome-card ${config.cls}`}>
          <div className="outcome-card-icon">{config.icon}</div>
          <div className="outcome-card-body">
            <strong>{config.label}</strong>
            <span>{config.desc}</span>
            <span className="outcome-card-time">
              Last checked: {formatTimestamp(target.lastRunAt)}
            </span>
          </div>
          <button
            className="outcome-card-run button-strong"
            onClick={state.handleRunSelectedTarget}
            disabled={state.isBusy || state.hasUnsavedWork}
            title={state.hasUnsavedWork ? 'Save or reset the draft first.' : undefined}
            type="button"
          >
            {state.runningTarget ? 'Running target…' : 'Run target'}
          </button>
        </div>
      ) : null}

      <div className="changes-meta">
        <div className="changes-meta-row">
          <span className="changes-meta-key">Source</span>
          <span className="changes-meta-val" title={target.sourceLocator ?? undefined}>
            {target.sourceLocator ?? '—'}
          </span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Selector</span>
          <span className="changes-meta-val">{target.selectionLabel ?? '—'}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Compare basis</span>
          <span className="changes-meta-val">{target.compareBasis ?? '—'}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Directory</span>
          <span className="changes-meta-val">{target.directoryName}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Target ID</span>
          <span className="changes-meta-val">{target.targetId ?? '—'}</span>
        </div>
      </div>

      {state.document.data?.artifactIssues.length ? (
        <div className="changes-tab-issues">
          {state.document.data.artifactIssues.map((issue) => (
            <p key={issue} className="error">
              {issue}
            </p>
          ))}
        </div>
      ) : null}

      {currentSnapshot ? (
        <div className="changes-history">
          <div className="changes-history-head">
            <div>
              <strong>Baseline timeline</strong>
              <p>
                Pick a retained baseline to inspect the rendered fragment, extraction record, and
                compare payload without leaving this workbench.
              </p>
            </div>
          </div>

          {snapshotHistory.length > 0 ? (
            <div className="history-timeline">
              {snapshotHistory.map((snapshot, index) => {
                const snapshotKey = `${snapshot.capturedAt}-${snapshot.compareDigestSha256}`;
                return (
                  <button
                    key={snapshotKey}
                    className={`history-pill ${index === selectedHistoryIndex ? 'history-pill-active' : ''}`}
                    onClick={() => {
                      setSelectedHistoryKey(snapshotKey);
                    }}
                    type="button"
                  >
                    {formatTimestamp(snapshot.capturedAt)}
                  </button>
                );
              })}
            </div>
          ) : null}

          <SnapshotWorkbench
            currentSnapshot={currentSnapshot}
            previousSnapshot={snapshotHistory[selectedHistoryIndex] ?? null}
            heading="Canonical snapshot inspection"
          />
        </div>
      ) : (
        <div className="changes-tab-empty">
          <p>
            No baseline snapshots exist yet. Run this target to create the first compare artifact.
          </p>
        </div>
      )}
    </div>
  );
}

export function DetailPanel({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const isDraft = state.isDraftContext;
  const activeTab = state.detailTab;

  const title = isDraft
    ? state.editorMode === 'http'
      ? 'New HTTP target'
      : state.editorMode === 'file'
        ? 'New file target'
        : 'New target'
    : summarizeTarget(target);

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'changes', label: isDraft ? 'Preview' : 'Changes' },
    { id: 'config', label: 'Config' },
    { id: 'artifacts', label: 'Artifacts' },
  ];

  return (
    <div className="detail-panel">
      <div className="detail-panel-head">
        <div className="detail-panel-identity">
          <h2 className="detail-panel-title">{title}</h2>
          {!isDraft && target ? <StatusPill value={target.statusKind} /> : null}
          {state.dirty ? <span className="meta-chip meta-chip-accent">Unsaved draft</span> : null}
        </div>
      </div>

      <div className="detail-tab-strip">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`detail-tab-btn ${activeTab === t.id ? 'detail-tab-btn-active' : ''}`}
            onClick={() => {
              state.setDetailTab(t.id);
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="detail-tab-body">
        {activeTab === 'changes' ? <ChangesTab state={state} /> : null}
        {activeTab === 'config' ? <TargetEditor state={state} /> : null}
        {activeTab === 'artifacts' ? <ArtifactsTab state={state} /> : null}
      </div>
    </div>
  );
}
