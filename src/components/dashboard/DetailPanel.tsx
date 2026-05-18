import { useState } from 'react';
import { TargetEditor } from './TargetEditor';
import { StatusPill } from '../StatusPill';
import { formatTimestamp, prettyJson, summarizeTarget } from '../../lib/presentation';
import { buildCompareDiffView } from '../../lib/compareHistory';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;
type DetailTab = StateType['detailTab'];
type ArtifactTab = StateType['artifactTab'];

// ─── CodeWindow ───────────────────────────────────────────────────────────────
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

// ─── ArtifactsTab ─────────────────────────────────────────────────────────────
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
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="artifact-content">
        {activeArtifactTab === 'preview' && (
          <>
            {state.preview.error ? <p className="error">{state.preview.error}</p> : null}
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
        )}
        {activeArtifactTab === 'run' && (
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
        )}
        {activeArtifactTab === 'state' && (
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
        )}
        {activeArtifactTab === 'batch' && (
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
        )}
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
        <p>Previewing the current draft against ffhn-core.</p>
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

  return (
    <div className="changes-tab">
      <div className="outcome-card outcome-card-init">
        <div className="outcome-card-icon">DRV</div>
        <div className="outcome-card-body">
          <strong>Preview ready</strong>
          <span>ffhn-core accepted the draft target and returned canonical preview artifacts.</span>
        </div>
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
      </div>

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

// ─── ChangesTab ───────────────────────────────────────────────────────────────
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
                The embedded runtime owns the stored snapshots. Dataarm reads the canonical compare
                artifacts directly from the target directory.
              </p>
            </div>
          </div>

          <div className="changes-meta">
            <div className="changes-meta-row">
              <span className="changes-meta-key">Current snapshot</span>
              <span className="changes-meta-val">
                {formatTimestamp(currentSnapshot.capturedAt)}
              </span>
            </div>
            <div className="changes-meta-row">
              <span className="changes-meta-key">Current compare digest</span>
              <span className="changes-meta-val">{currentSnapshot.compareDigestSha256}</span>
            </div>
          </div>

          {snapshotHistory.length > 0 ? (
            <>
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

              {(() => {
                const previousSnapshot = snapshotHistory[
                  selectedHistoryIndex
                ] as (typeof snapshotHistory)[number];
                const historyDiffView = buildCompareDiffView(
                  previousSnapshot.compareText,
                  currentSnapshot.compareText,
                );

                return (
                  <div className="changes-diff">
                    <div className="changes-meta">
                      <div className="changes-meta-row">
                        <span className="changes-meta-key">Comparing against</span>
                        <span className="changes-meta-val">
                          {formatTimestamp(previousSnapshot.capturedAt)}
                        </span>
                      </div>
                      <div className="changes-meta-row">
                        <span className="changes-meta-key">Stable prefix lines</span>
                        <span className="changes-meta-val">
                          {String(historyDiffView.commonPrefixLines)}
                        </span>
                      </div>
                      <div className="changes-meta-row">
                        <span className="changes-meta-key">Stable suffix lines</span>
                        <span className="changes-meta-val">
                          {String(historyDiffView.commonSuffixLines)}
                        </span>
                      </div>
                    </div>

                    <CodeWindow
                      title="Previous compare.txt"
                      value={
                        historyDiffView.previousChangedLines.length > 0
                          ? historyDiffView.previousChangedLines.join('\n')
                          : '(no changed lines on the previous side)'
                      }
                      emptyMessage="No previous changed lines."
                    />
                    <CodeWindow
                      title="Current compare.txt"
                      value={
                        historyDiffView.currentChangedLines.length > 0
                          ? historyDiffView.currentChangedLines.join('\n')
                          : '(no changed lines on the current side)'
                      }
                      emptyMessage="No current changed lines."
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            <CodeWindow
              title="Current compare.txt"
              value={currentSnapshot.compareText}
              emptyMessage="No baseline compare artifact yet."
            />
          )}
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

// ─── DetailPanel ──────────────────────────────────────────────────────────────
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
