import { shortenPath } from '../../lib/presentation';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

export function TopBar({ state }: { state: StateType }) {
  const ws = state.workspaceSummary;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <span className="top-bar-logo">Dataarm</span>
        <div className="top-bar-title-group">
          <h1 className="top-bar-title">Target workbench</h1>
          <div className="top-bar-workspace">
            <span className="top-bar-workspace-name">{ws?.workspaceName ?? '…'}</span>
            {ws && (
              <span className="top-bar-workspace-path" title={ws.workspacePath}>
                {shortenPath(ws.workspacePath, 44)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="top-bar-stats">
        {state.stats.changed > 0 && (
          <span className="top-stat top-stat-warning">{state.stats.changed} changed</span>
        )}
        {state.stats.firstRun > 0 && (
          <span className="top-stat top-stat-info">{state.stats.firstRun} pending</span>
        )}
        {state.stats.attention > 0 && (
          <span className="top-stat top-stat-danger">{state.stats.attention} issues</span>
        )}
        <span className="top-stat">
          {state.stats.ready}/{state.stats.total} ready
        </span>
      </div>

      <div className="top-bar-right">
        {state.actionFeedback && (
          <span className={`top-feedback feedback-${state.actionFeedback.tone}`}>
            {state.actionFeedback.message}
          </span>
        )}
        <button
          className="button-quiet top-bar-btn"
          onClick={state.handleOpenWorkspacePath}
          disabled={!ws}
        >
          Open folder
        </button>
        <button
          className="button-strong top-bar-btn"
          onClick={state.handleRunWorkspace}
          disabled={state.isBusy || !ws || state.hasUnsavedWork}
          title={state.hasUnsavedWork ? 'Save or reset the draft first.' : undefined}
        >
          {state.runningWorkspace ? 'Running workspace…' : 'Run workspace'}
        </button>
      </div>
    </header>
  );
}
