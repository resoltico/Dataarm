import { useState } from 'react';

import type { useDashboardState } from '../../../hooks/useDashboardState';
import {
  alertRuleLabel,
  deliveryLabel,
  formatCompareBasisLabel,
  formatTimestamp,
  schedulePresetLabel,
  selectionLabelForDraft,
} from '../../../lib/presentation';
import { assessWatchSetup } from '../../../lib/watchSetupAssessment';
import { SnapshotWorkbench } from './SnapshotWorkbench';

type StateType = ReturnType<typeof useDashboardState>;

function DraftPreviewTab({ state }: { state: StateType }) {
  if (state.preview.loading) {
    return (
      <div className="changes-tab-empty">
        <p>Checking the page and selected section.</p>
      </div>
    );
  }

  if (state.preview.error) {
    return (
      <div className="changes-tab">
        <div className="outcome-card outcome-card-failed">
          <div className="outcome-card-icon">ERR</div>
          <div className="outcome-card-body">
            <strong>Watch setup check failed</strong>
            <span>{state.preview.error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!state.preview.data) {
    return (
      <div className="changes-tab-empty">
        <p>Check this draft before saving so Dataarm can confirm the page and section.</p>
      </div>
    );
  }

  const previewDraft = state.preview.data.draftSession.draft;
  const assessment = assessWatchSetup(state.preview.data);

  return (
    <div className="changes-tab">
      <div
        className={`outcome-card ${assessment.canSave ? 'outcome-card-ok' : 'outcome-card-failed'}`}
      >
        <div className="outcome-card-icon">{assessment.badge}</div>
        <div className="outcome-card-body">
          <strong>{assessment.title}</strong>
          <span>{assessment.body}</span>
          {assessment.actionHint ? (
            <span className="outcome-card-time">{assessment.actionHint}</span>
          ) : null}
        </div>
      </div>

      <div className="inline-actions">
        {assessment.canSave ? (
          <button
            className="button-primary"
            disabled={state.loadingTarget || state.saving}
            onClick={state.handleSave}
          >
            {state.saving ? 'Saving…' : 'Save watch'}
          </button>
        ) : null}
        <button
          className={assessment.canSave ? 'button-quiet' : 'button-primary'}
          onClick={() => {
            state.setDetailTab('config');
          }}
          type="button"
        >
          {assessment.canSave ? 'Review settings' : 'Fix watch setup'}
        </button>
      </div>

      <div className="changes-meta">
        <div className="changes-meta-row">
          <span className="changes-meta-key">Page</span>
          <span className="changes-meta-val" title={previewDraft.sourceLocator}>
            {previewDraft.sourceLocator || '—'}
          </span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Watch name</span>
          <span className="changes-meta-val">{state.preview.data.displayName}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Section</span>
          <span className="changes-meta-val">{selectionLabelForDraft(previewDraft)}</span>
        </div>
        {assessment.candidateSummary ? (
          <div className="changes-meta-row">
            <span className="changes-meta-key">Match result</span>
            <span className="changes-meta-val">{assessment.candidateSummary}</span>
          </div>
        ) : null}
        {assessment.finalUrl ? (
          <div className="changes-meta-row">
            <span className="changes-meta-key">Loaded page</span>
            <span className="changes-meta-val" title={assessment.finalUrl}>
              {assessment.finalUrl}
            </span>
          </div>
        ) : null}
        {assessment.httpStatus != null ? (
          <div className="changes-meta-row">
            <span className="changes-meta-key">HTTP status</span>
            <span className="changes-meta-val">{String(assessment.httpStatus)}</span>
          </div>
        ) : null}
      </div>

      {state.previewArtifactIssues.map((issue) => (
        <p key={issue} className="error">
          {issue}
        </p>
      ))}

      {assessment.canSave && state.previewSnapshot ? (
        <SnapshotWorkbench
          currentSnapshot={state.previewSnapshot}
          previousSnapshot={null}
          heading="Preview inspection"
        />
      ) : null}
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
        <p>Select a watch to view its latest checks and changes.</p>
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
      desc: 'The extracted content differs from the saved reference.',
    },
    unchanged: {
      label: 'No Changes Detected',
      cls: 'outcome-card-ok',
      icon: 'OK',
      desc: 'The extracted content matches the saved reference exactly.',
    },
    initialized: {
      label: 'First Check Saved',
      cls: 'outcome-card-init',
      icon: 'NEW',
      desc: 'First check completed. Future checks will compare against this saved reference.',
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
            <strong>First check needed</strong>
            <span>Run this watch once so Dataarm can save the first reference version.</span>
          </div>
          <button
            className="button-strong outcome-card-run"
            onClick={state.handleRunSelectedTarget}
            disabled={state.isBusy}
            type="button"
          >
            {state.runningTarget ? 'Checking watch…' : 'Check watch'}
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
            {state.runningTarget ? 'Checking watch…' : 'Check watch'}
          </button>
        </div>
      ) : null}

      <div className="changes-meta">
        <div className="changes-meta-row">
          <span className="changes-meta-key">Page</span>
          <span className="changes-meta-val" title={target.sourceLocator ?? undefined}>
            {target.sourceLocator ?? '—'}
          </span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Section</span>
          <span className="changes-meta-val">{target.selectionLabel ?? '—'}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Compare using</span>
          <span className="changes-meta-val">{formatCompareBasisLabel(target.compareBasis)}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Check every</span>
          <span className="changes-meta-val">{schedulePresetLabel(target.watchProfile)}</span>
        </div>
        <div className="changes-meta-row">
          <span className="changes-meta-key">Alerts</span>
          <span className="changes-meta-val">
            {`${alertRuleLabel(target.watchProfile)} · ${deliveryLabel(target.watchProfile)}`}
          </span>
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
              <strong>History timeline</strong>
              <p>
                Pick a saved check to inspect the selected section, extracted text, and change
                payload without leaving Dataarm.
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
            heading="What changed"
          />
        </div>
      ) : (
        <div className="changes-tab-empty">
          <p>
            Dataarm has not saved a reference version yet. Check this watch once to start its
            history.
          </p>
        </div>
      )}
    </div>
  );
}
