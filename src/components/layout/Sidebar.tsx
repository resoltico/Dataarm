import { SectionCard } from '../SectionCard';
import { StatusPill } from '../StatusPill';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

interface SidebarProps {
  state: StateType;
}

export function Sidebar({ state }: SidebarProps) {
  const targets = state.targets.data ?? [];
  const recents = state.recent.data ?? [];
  const priorities = state.projectStatus.data?.priorities ?? [];

  return (
    <aside className="rail" aria-label="Sidebar Navigation">
      <SectionCard
        id="section-targets"
        title="Targets"
        subtitle="Choose what to run next"
        actions={
          <button
            className="button-primary"
            onClick={() => {
              state.setIsCreatingTarget(true);
            }}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
          >
            Add target
          </button>
        }
      >
        {state.targets.loading ? <p>Loading…</p> : null}
        {targets.length > 0 ? (
          <nav className="target-list" aria-label="Target selection">
            {targets.map((target) => (
              <button
                key={target.id}
                className={`target-item ${state.selectedTarget?.id === target.id ? 'active' : ''}`}
                onClick={() => {
                  state.handleSelectTarget(target.id);
                }}
                aria-current={state.selectedTarget?.id === target.id ? 'page' : undefined}
              >
                <div className="target-item-head">
                  <strong>{target.name}</strong>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {state.executingTargets.has(target.id) ? (
                      <span style={{ fontSize: '0.75rem', color: '#60a5fa' }} className="blink">
                        Running...
                      </span>
                    ) : null}
                    <StatusPill value={target.status} />
                  </div>
                </div>
                <div className="muted">{target.extractorSummary}</div>
                <div className="target-meta">
                  <span>{target.enabled ? 'Enabled' : 'Disabled'}</span>
                  <span>{target.url}</span>
                </div>
              </button>
            ))}
          </nav>
        ) : (
          <p className="muted">
            No targets yet. Add the first target to move from workspace setup into execution.
          </p>
        )}
      </SectionCard>

      <SectionCard id="section-recent" title="Recent workspaces" subtitle="Reopen local workspaces">
        {state.recent.loading ? <p>Loading…</p> : null}
        {recents.length > 0 ? (
          <ul className="simple-list">
            {recents.map((item) => (
              <li key={item.workspacePath} className="simple-list-item">
                <div>
                  <strong>{item.workspaceName}</strong>
                  <div className="muted">{item.workspacePath}</div>
                </div>
                <button
                  onClick={() => {
                    void state.handleOpenWorkspace(item.workspacePath);
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Recent workspaces will appear here after you open them.</p>
        )}
      </SectionCard>

      <SectionCard
        id="section-priorities"
        title="Maintainer backlog"
        subtitle="Packaging and release work, separate from the operator flow"
      >
        {priorities.length > 0 ? (
          <ol className="simple-list">
            {priorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <p className="muted">Loading maintainer priorities…</p>
        )}
      </SectionCard>
    </aside>
  );
}
