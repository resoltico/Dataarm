import { useState } from 'react';

import { NotificationCenter } from './NotificationCenter';
import type { useDashboardState } from '../../hooks/useDashboardState';

export type FilterView = 'all' | 'changed' | 'alerts' | 'failed' | 'paused' | 'needs_setup';

export type TargetGroupBy = 'none' | 'status' | 'folder';

type StateType = ReturnType<typeof useDashboardState>;

export function NavSidebar({
  state,
  filterView,
  setFilterView,
}: {
  state: StateType;
  filterView: FilterView;
  setFilterView: (v: FilterView) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const workspaceTransitioning = state.workspace.loading || state.openingWorkspace;
  const ws = state.workspaceSummary;
  const currentPath = ws?.workspacePath.trim() ?? '';
  const inputPath = state.workspaceInput.trim();
  const canSwitch = inputPath.length > 0 && inputPath !== currentPath && !state.openingWorkspace;
  const canCreate = inputPath.length > 0 && !state.openingWorkspace;

  const views: Array<{ id: FilterView; label: string; count: number; alert?: boolean }> = [
    { id: 'all', label: 'All watches', count: state.stats.total },
    { id: 'changed', label: 'Changed', count: state.stats.changed, alert: state.stats.changed > 0 },
    {
      id: 'alerts',
      label: 'Alerts',
      count: state.stats.changed + state.stats.attention,
      alert: state.stats.changed + state.stats.attention > 0,
    },
    {
      id: 'failed',
      label: 'Failed',
      count: state.stats.attention,
      alert: state.stats.attention > 0,
    },
    {
      id: 'paused',
      label: 'Paused',
      count: state.targets.filter((target) => target.watchProfile.paused).length,
    },
    { id: 'needs_setup', label: 'Needs setup', count: state.stats.firstRun },
  ];

  const recentWorkspaces = state.recentWorkspaces
    .filter((r) => r.workspacePath !== currentPath)
    .slice(0, 3);

  return (
    <nav className="nav-sidebar" aria-label="Navigation">
      <div className="nav-section">
        <p className="nav-label">VIEWS</p>
        <ul className="nav-list">
          {views.map((view) => (
            <li key={view.id}>
              <button
                className={[
                  'nav-item',
                  filterView === view.id ? 'nav-item-active' : '',
                  view.alert ? 'nav-item-alert' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setFilterView(view.id);
                }}
                type="button"
              >
                <span className="nav-item-label">{view.label}</span>
                <span
                  className={`nav-item-count ${view.alert ? 'nav-item-count-alert' : ''}`}
                  aria-hidden="true"
                >
                  {view.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav-section">
        <p className="nav-label">ADD WATCH</p>
        <div className="nav-new-buttons">
          <button
            className="nav-new-btn"
            onClick={() => {
              void state.handleStartNewTarget('http');
            }}
            disabled={workspaceTransitioning}
            type="button"
          >
            Add watch
          </button>
          <button
            className="nav-new-btn"
            onClick={() => {
              void state.handleStartNewTarget('file');
            }}
            disabled={workspaceTransitioning}
            type="button"
          >
            Advanced: local file
          </button>
        </div>
      </div>

      <section className="nav-section" aria-label="Library controls">
        <p className="nav-label">SETTINGS</p>
        <button
          className="nav-new-btn button-secondary-accent"
          onClick={() => {
            setAdvancedOpen((value) => !value);
          }}
          type="button"
        >
          {advancedOpen ? 'Hide advanced library tools' : 'Show advanced library tools'}
        </button>
        {advancedOpen ? (
          <>
            <label className="nav-field-label" htmlFor="watch-root-path">
              Change library folder
            </label>
            <input
              id="watch-root-path"
              aria-label="Change library folder"
              className="nav-path-input"
              value={state.workspaceInput}
              onChange={(event) => {
                state.setWorkspaceInput(event.target.value);
              }}
              placeholder="/path/to/watch-library"
            />
            <div className="nav-new-buttons" style={{ marginTop: '0.32rem' }}>
              <button
                className="nav-new-btn"
                onClick={() => {
                  void state.handleOpenWorkspaceFromInput();
                }}
                disabled={!canSwitch}
                type="button"
              >
                {state.openingWorkspace ? 'Opening library…' : 'Open library'}
              </button>
              <button
                className="nav-new-btn button-secondary-accent"
                onClick={() => {
                  void state.handleCreateWorkspaceFromInput();
                }}
                disabled={!canCreate}
                type="button"
              >
                Create library
              </button>
            </div>
          </>
        ) : null}
      </section>

      {recentWorkspaces.length > 0 && advancedOpen ? (
        <div className="nav-section">
          <p className="nav-label">RECENT LIBRARIES</p>
          <ul className="nav-list">
            {recentWorkspaces.map((workspace) => (
              <li key={workspace.workspacePath}>
                <button
                  className="nav-item nav-item-recent"
                  disabled={workspaceTransitioning}
                  onClick={() => {
                    void state.handleOpenRecentWorkspace(workspace.workspacePath);
                  }}
                  title={workspace.workspacePath}
                  type="button"
                >
                  <span className="nav-item-label">{workspace.workspaceName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="nav-section nav-section-notifs">
        <NotificationCenter state={state} />
      </div>
    </nav>
  );
}
