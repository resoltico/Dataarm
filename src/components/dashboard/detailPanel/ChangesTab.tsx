import { useState } from 'react';

import type { useDashboardState } from '../../../hooks/useDashboardState';
import { formatTimestamp, prettyJson, selectionLabelForDraft } from '../../../lib/presentation';
import { CodeWindow, SnapshotWorkbench } from './SnapshotWorkbench';

type StateType = ReturnType<typeof useDashboardState>;

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

export function ChangesTab({ state }: { state: StateType }) {
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
