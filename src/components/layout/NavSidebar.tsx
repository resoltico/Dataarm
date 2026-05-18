import { NotificationCenter } from './NotificationCenter';
import type { useDashboardState } from '../../hooks/useDashboardState';

export type FilterView = 'all' | 'changed' | 'never_run' | 'http' | 'file' | 'attention';

export type TargetGroupBy = 'none' | 'status' | 'source_kind';

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
  const workspaceTransitioning = state.workspace.loading || state.openingWorkspace;
  const ws = state.workspaceSummary;
  const currentPath = ws?.workspacePath.trim() ?? '';
  const inputPath = state.workspaceInput.trim();
  const canSwitch = inputPath.length > 0 && inputPath !== currentPath && !state.openingWorkspace;
  const canCreate = inputPath.length > 0 && !state.openingWorkspace;

  const views: Array<{ id: FilterView; label: string; count: number; alert?: boolean }> = [
    { id: 'all', label: 'All targets', count: state.stats.total },
    { id: 'changed', label: 'Changed', count: state.stats.changed, alert: state.stats.changed > 0 },
    { id: 'never_run', label: 'Needs baseline', count: state.stats.firstRun },
    {
      id: 'http',
      label: 'HTTP sources',
      count: state.targets.filter((target) => target.sourceKind === 'http').length,
    },
    {
      id: 'file',
      label: 'File sources',
      count: state.targets.filter((target) => target.sourceKind === 'file').length,
    },
    {
      id: 'attention',
      label: 'Needs attention',
      count: state.stats.attention,
      alert: state.stats.attention > 0,
    },
  ];

  const recentWorkspaces = state.recentWorkspaces
    .filter((r) => r.workspacePath !== currentPath)
    .slice(0, 3);

  return (
    <nav className="nav-sidebar" aria-label="Navigation">
      {/* Filter views */}
      <div className="nav-section">
        <p className="nav-label">VIEWS</p>
        <ul className="nav-list">
          {views.map((v) => (
            <li key={v.id}>
              <button
                className={[
                  'nav-item',
                  filterView === v.id ? 'nav-item-active' : '',
                  v.alert ? 'nav-item-alert' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setFilterView(v.id);
                }}
              >
                <span className="nav-item-label">{v.label}</span>
                <span
                  className={`nav-item-count ${v.alert ? 'nav-item-count-alert' : ''}`}
                  aria-hidden="true"
                >
                  {v.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* New target */}
      <div className="nav-section">
        <p className="nav-label">NEW TARGET</p>
        <div className="nav-new-buttons">
          <button
            className="nav-new-btn"
            onClick={() => {
              void state.handleStartNewTarget('http');
            }}
            disabled={workspaceTransitioning}
          >
            New HTTP
          </button>
          <button
            className="nav-new-btn"
            onClick={() => {
              void state.handleStartNewTarget('file');
            }}
            disabled={workspaceTransitioning}
          >
            New file
          </button>
        </div>
      </div>

      {/* Workspace switcher */}
      <section className="nav-section" aria-label="Workspace controls">
        <p className="nav-label">WORKSPACE</p>
        <label className="nav-field-label" htmlFor="watch-root-path">
          Switch watch root
        </label>
        <input
          id="watch-root-path"
          aria-label="Switch watch root"
          className="nav-path-input"
          value={state.workspaceInput}
          onChange={(e) => {
            state.setWorkspaceInput(e.target.value);
          }}
          placeholder="/path/to/watch-root"
        />
        <div className="nav-new-buttons" style={{ marginTop: '0.32rem' }}>
          <button
            className="nav-new-btn"
            onClick={() => {
              void state.handleOpenWorkspaceFromInput();
            }}
            disabled={!canSwitch}
          >
            {state.openingWorkspace ? 'Opening watch root…' : 'Open watch root'}
          </button>
          <button
            className="nav-new-btn button-secondary-accent"
            onClick={() => {
              void state.handleCreateWorkspaceFromInput();
            }}
            disabled={!canCreate}
          >
            Create watch root
          </button>
        </div>
      </section>

      {/* Recent workspaces */}
      {recentWorkspaces.length > 0 && (
        <div className="nav-section">
          <p className="nav-label">RECENT</p>
          <ul className="nav-list">
            {recentWorkspaces.map((r) => (
              <li key={r.workspacePath}>
                <button
                  className="nav-item nav-item-recent"
                  disabled={workspaceTransitioning}
                  onClick={() => {
                    void state.handleOpenRecentWorkspace(r.workspacePath);
                  }}
                  title={r.workspacePath}
                >
                  <span className="nav-item-label">{r.workspaceName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notification center at bottom */}
      <div className="nav-section nav-section-notifs">
        <NotificationCenter state={state} />
      </div>
    </nav>
  );
}
