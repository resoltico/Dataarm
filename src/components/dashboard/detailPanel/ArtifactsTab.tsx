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
    { id: 'preview', label: 'Setup check' },
    { id: 'run', label: 'Latest check' },
    { id: 'state', label: 'Saved state' },
    { id: 'batch', label: 'All-watch checks' },
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
              title="Setup status"
              value={previewStatus}
              emptyMessage="Check the watch setup to inspect the status report."
            />
            <CodeWindow
              title="Setup report"
              value={previewRun}
              emptyMessage="Check the watch setup to inspect the run report."
            />
          </>
        ) : null}
        {activeArtifactTab === 'run' ? (
          <>
            {state.lastRun.error ? <p className="error">{state.lastRun.error}</p> : null}
            <CodeWindow
              title="Latest status report"
              value={lastRunStatus ?? persistedStatus}
              emptyMessage="Check a watch to inspect the latest status report."
            />
            <CodeWindow
              title="Latest run snapshot"
              value={lastRunReport ?? prettyJson(state.document.data?.lastRunSnapshot)}
              emptyMessage="The latest check snapshot appears here."
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
              title="Saved state"
              value={stateDocument}
              emptyMessage="No saved state yet."
            />
            <CodeWindow
              title="Saved status"
              value={persistedStatus}
              emptyMessage="No saved status report yet."
            />
            <CodeWindow
              title="Current saved value"
              value={currentSnapshot?.compareText ?? null}
              emptyMessage="No saved value yet."
            />
            <CodeWindow
              title="Current extraction details"
              value={currentSnapshot ? prettyJson(currentSnapshot.extractionRecord) : null}
              emptyMessage="No extraction record yet."
            />
          </>
        ) : null}
        {activeArtifactTab === 'batch' ? (
          <>
            {state.lastBatch.error ? <p className="error">{state.lastBatch.error}</p> : null}
            <CodeWindow
              title="All-watch report"
              value={batchReport}
              emptyMessage="Check all watches to inspect the combined report."
            />
            <CodeWindow
              title="Skipped watches"
              value={skippedReport}
              emptyMessage="No watches were skipped."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
