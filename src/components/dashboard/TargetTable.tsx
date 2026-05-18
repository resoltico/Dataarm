import {
  compactStatusLabel,
  formatSourceKindLabel,
  formatTimestamp,
  shortenPath,
  statusTone,
  summarizeTarget,
} from '../../lib/presentation';
import {
  isChangedTargetStatus,
  isTargetErrorStatus,
  TARGET_RUN_OUTCOME_LABELS,
} from '../../lib/workbenchContract';
import type { useDashboardState } from '../../hooks/useDashboardState';
import type { FilterView, TargetGroupBy } from '../layout/NavSidebar';

type StateType = ReturnType<typeof useDashboardState>;
const NOOP = () => {};

function StatusDot({ statusKind }: { statusKind: StateType['targets'][number]['statusKind'] }) {
  const tone = statusTone(statusKind);
  return <span className={`status-dot status-dot-${tone}`} aria-hidden />;
}

function outcomeLabel(outcome: StateType['targets'][number]['lastRunOutcome']) {
  return outcome == null ? '—' : TARGET_RUN_OUTCOME_LABELS[outcome];
}

function matchesFilter(target: StateType['targets'][number], filterView: FilterView) {
  switch (filterView) {
    case 'changed':
      return isChangedTargetStatus(target.statusKind, target.lastRunOutcome);
    case 'never_run':
      return target.lastRunAt == null || target.statusKind === 'pending';
    case 'http':
      return target.sourceKind === 'http';
    case 'file':
      return target.sourceKind === 'file';
    case 'attention':
      return !!target.errorMessage || isTargetErrorStatus(target.statusKind);
    default:
      return true;
  }
}

function groupLabel(groupBy: Exclude<TargetGroupBy, 'none'>, target: StateType['targets'][number]) {
  if (groupBy === 'source_kind') {
    return formatSourceKindLabel(target.sourceKind);
  }
  return compactStatusLabel(target.statusKind);
}

export function TargetTable({
  state,
  filterView,
  searchQuery = '',
  setSearchQuery = NOOP,
  groupBy = 'status',
  setGroupBy = NOOP,
}: {
  state: StateType;
  filterView: FilterView;
  searchQuery?: string;
  setSearchQuery?: (value: string) => void;
  groupBy?: TargetGroupBy;
  setGroupBy?: (value: TargetGroupBy) => void;
}) {
  const workspaceTransitioning = state.workspace.loading || state.openingWorkspace;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleTargets = state.targets.filter((target) => {
    if (!matchesFilter(target, filterView)) {
      return false;
    }
    if (normalizedQuery.length === 0) {
      return true;
    }
    return [
      summarizeTarget(target),
      target.targetId,
      target.directoryName,
      target.sourceLocator,
      target.selectionLabel,
      target.compareBasis,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  const groupedTargets =
    groupBy === 'none'
      ? [{ key: 'all', label: 'Targets', items: visibleTargets }]
      : visibleTargets.reduce<Array<{ key: string; label: string; items: typeof visibleTargets }>>(
          (groups, target) => {
            const label = groupLabel(groupBy, target);
            const existing = groups.find((group) => group.key === label);
            if (existing) {
              existing.items.push(target);
              return groups;
            }
            groups.push({ key: label, label, items: [target] });
            return groups;
          },
          [],
        );

  return (
    <div className="target-table-container">
      <div className="target-table-toolbar">
        <div className="target-table-toolbar-main">
          <h2 className="target-table-title">Targets</h2>
          <span className="target-table-count" aria-hidden="true">
            {visibleTargets.length}
          </span>
        </div>
        <div className="target-table-controls">
          <input
            aria-label="Search targets"
            className="target-search-input"
            placeholder="Search targets, sources, selectors"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
          />
          <select
            aria-label="Group targets"
            className="target-group-select"
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as TargetGroupBy);
            }}
          >
            <option value="status">Group by status</option>
            <option value="source_kind">Group by source</option>
            <option value="none">No grouping</option>
          </select>
        </div>
      </div>

      {visibleTargets.length === 0 ? (
        <div className="table-empty">
          {state.targets.length === 0
            ? 'No targets yet. Use New HTTP or New file in the sidebar to create one.'
            : normalizedQuery.length > 0
              ? 'No targets match this search.'
              : 'No targets match this filter.'}
        </div>
      ) : (
        groupedTargets.map((group) => (
          <div key={group.key} className="target-group-block">
            {groupBy !== 'none' ? (
              <div className="target-group-head">
                <strong>{group.label}</strong>
                <span>{group.items.length}</span>
              </div>
            ) : null}
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
                {group.items.map((target) => {
                  const active = target.directoryName === state.selectedTarget?.directoryName;
                  const isChanged = isChangedTargetStatus(target.statusKind, target.lastRunOutcome);
                  const hasError = !!target.errorMessage || isTargetErrorStatus(target.statusKind);

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
                      onKeyDown={(event) => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          !workspaceTransitioning
                        ) {
                          event.preventDefault();
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
                        <span
                          className={`outcome-badge outcome-${target.lastRunOutcome ?? 'none'}`}
                        >
                          {outcomeLabel(target.lastRunOutcome)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
