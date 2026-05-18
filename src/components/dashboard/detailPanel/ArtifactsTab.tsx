import type { useDashboardState } from '../../../hooks/useDashboardState';
import { prettyJson } from '../../../lib/presentation';
import { CodeWindow } from './SnapshotWorkbench';

type StateType = ReturnType<typeof useDashboardState>;
type ArtifactTab = StateType['artifactTab'];

export function ArtifactsTab({ state }: { state: StateType }) {
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
        {artifactTabs.map((tab) => (
          <button
            key={tab.id}
            className={`artifact-sub-tab ${activeArtifactTab === tab.id ? 'artifact-sub-tab-active' : ''}`}
            onClick={() => {
              state.setArtifactTab(tab.id);
            }}
            type="button"
          >
            {tab.label}
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
