import { formatTimestamp, shortenPath, statusTone, summarizeTarget } from '../../lib/presentation';
import type { useDashboardState } from '../../hooks/useDashboardState';
import type { FilterView } from '../layout/NavSidebar';

type StateType = ReturnType<typeof useDashboardState>;

const ERROR_STATUS_KINDS = new Set([
  'invalid_config',
  'unavailable_target',
  'invalid_state',
  'incompatible_baseline',
  'integrity_mismatch',
  'directory_invalid',
  'status_error',
  'failed_permanent',
  'failed_transient',
]);

function StatusDot({ statusKind }: { statusKind: string }) {
  const tone = statusTone(statusKind);
  return <span className={`status-dot status-dot-${tone}`} aria-hidden />;
}

function outcomeLabel(outcome: string | null) {
  switch (outcome) {
    case 'unchanged':
      return 'Unchanged';
    case 'changed':
      return 'Changed';
    case 'initialized':
      return 'New baseline';
    default:
      return '—';
  }
}

export function TargetTable({ state, filterView }: { state: StateType; filterView: FilterView }) {
  const workspaceTransitioning = state.workspace.loading || state.openingWorkspace;

  const visibleTargets = state.targets.filter((t) => {
    if (filterView === 'changed') {
      return t.statusKind === 'changed' || t.lastRunOutcome === 'changed';
    }
    if (filterView === 'attention') {
      return !!t.errorMessage || ERROR_STATUS_KINDS.has(t.statusKind);
    }
    return true;
  });

  return (
    <div className="target-table-container">
      <div className="target-table-toolbar">
        <h2 className="target-table-title">Targets</h2>
        <span className="target-table-count" aria-hidden="true">
          {visibleTargets.length}
        </span>
      </div>

      {visibleTargets.length === 0 ? (
        <div className="table-empty">
          {state.targets.length === 0
            ? 'No targets yet. Use New HTTP or New file in the sidebar to create one.'
            : 'No targets match this filter.'}
        </div>
      ) : (
        <table className="target-table">
          <thead>
            <tr>
              <th className="col-dot" aria-label="Status" />
              <th className="col-name">Name</th>
              <th className="col-type">Type</th>
              <th className="col-source">Source</th>
              <th className="col-when">Last checked</th>
              <th className="col-outcome">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {visibleTargets.map((target) => {
              const active = target.directoryName === state.selectedTarget?.directoryName;
              const isChanged =
                target.statusKind === 'changed' || target.lastRunOutcome === 'changed';
              const hasError = !!target.errorMessage || ERROR_STATUS_KINDS.has(target.statusKind);

              return (
                <tr
                  key={target.directoryName}
                  className={[
                    'target-row',
                    active && 'target-row-selected',
                    isChanged && 'target-row-changed',
                    hasError && 'target-row-error',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (!workspaceTransitioning) {
                      void state.handleSelectTarget(target.directoryName);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !workspaceTransitioning) {
                      void state.handleSelectTarget(target.directoryName);
                    }
                  }}
                >
                  <td className="col-dot">
                    <StatusDot statusKind={target.statusKind} />
                  </td>
                  <td className="col-name">
                    <span className="row-name">{summarizeTarget(target)}</span>
                    {target.errorMessage ? (
                      <span className="row-error">{target.errorMessage}</span>
                    ) : null}
                  </td>
                  <td className="col-type">{target.sourceKind?.toUpperCase() ?? '—'}</td>
                  <td className="col-source">
                    <span title={target.sourceLocator ?? undefined} className="row-source">
                      {target.sourceLocator ? shortenPath(target.sourceLocator, 36) : '—'}
                    </span>
                  </td>
                  <td className="col-when">{formatTimestamp(target.lastRunAt)}</td>
                  <td className="col-outcome">
                    <span className={`outcome-badge outcome-${target.lastRunOutcome ?? 'none'}`}>
                      {outcomeLabel(target.lastRunOutcome)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
