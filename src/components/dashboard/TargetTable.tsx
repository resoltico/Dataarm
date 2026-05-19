import {
  compactStatusLabel,
  formatSourceKindLabel,
  formatTimestamp,
  nextScheduledCheckAt,
  schedulePresetLabel,
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
  return outcome == null ? 'First check needed' : TARGET_RUN_OUTCOME_LABELS[outcome];
}

function matchesFilter(target: StateType['targets'][number], filterView: FilterView) {
  switch (filterView) {
    case 'changed':
      return isChangedTargetStatus(target.statusKind, target.lastRunOutcome);
    case 'alerts':
      return (
        isChangedTargetStatus(target.statusKind, target.lastRunOutcome) ||
        isTargetErrorStatus(target.statusKind)
      );
    case 'failed':
      return !!target.errorMessage || isTargetErrorStatus(target.statusKind);
    case 'paused':
      return target.watchProfile.paused || target.statusKind === 'skipped_disabled';
    case 'needs_setup':
      return target.lastRunAt == null || target.statusKind === 'pending';
    default:
      return true;
  }
}

function groupLabel(groupBy: Exclude<TargetGroupBy, 'none'>, target: StateType['targets'][number]) {
  if (groupBy === 'folder') {
    return target.watchProfile.folderName ?? 'Ungrouped';
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
      target.currentComparePreview,
      target.watchProfile.folderName,
      ...target.watchProfile.tags,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  const groupedTargets =
    groupBy === 'none'
      ? [{ key: 'all', label: 'Watches', items: visibleTargets }]
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
          <h2 className="target-table-title">All watches</h2>
          <span className="target-table-count" aria-hidden="true">
            {visibleTargets.length}
          </span>
        </div>
        <div className="target-table-controls">
          <input
            aria-label="Search watches"
            className="target-search-input"
            placeholder="Search watches, pages, sections, tags"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
          />
          <select
            aria-label="Group watches"
            className="target-group-select"
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as TargetGroupBy);
            }}
          >
            <option value="status">Group by status</option>
            <option value="folder">Group by folder</option>
            <option value="none">No grouping</option>
          </select>
        </div>
      </div>

      {visibleTargets.length === 0 ? (
        <div className="table-empty">
          {state.targets.length === 0
            ? 'Add your first page to start tracking a website section over time.'
            : normalizedQuery.length > 0
              ? 'No watches match this search.'
              : 'No watches match this view.'}
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
                  <th className="col-name">Watch</th>
                  <th className="col-type">Page</th>
                  <th className="col-source">Latest value</th>
                  <th className="col-when">Last checked</th>
                  <th className="col-outcome">Next check</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((target) => {
                  const active = target.directoryName === state.selectedTarget?.directoryName;
                  const isChanged = isChangedTargetStatus(target.statusKind, target.lastRunOutcome);
                  const hasError = !!target.errorMessage || isTargetErrorStatus(target.statusKind);
                  const nextCheckAt = nextScheduledCheckAt(target);

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
                        <span className="row-error">
                          {target.errorMessage ??
                            `${compactStatusLabel(target.statusKind)} · ${schedulePresetLabel(target.watchProfile)}`}
                        </span>
                      </td>
                      <td className="col-type">
                        <span title={target.sourceLocator ?? undefined} className="row-source">
                          {target.sourceKind === 'http'
                            ? shortenPath(
                                target.sourceLocator ?? formatSourceKindLabel(target.sourceKind),
                                40,
                              )
                            : target.sourceKind === 'file'
                              ? 'Local file watch'
                              : 'Page not configured'}
                        </span>
                      </td>
                      <td className="col-source">
                        <span
                          title={target.currentComparePreview ?? undefined}
                          className="row-source"
                        >
                          {target.currentComparePreview ?? 'No saved value yet'}
                        </span>
                      </td>
                      <td className="col-when">{formatTimestamp(target.lastRunAt)}</td>
                      <td className="col-outcome">
                        <span
                          className={`outcome-badge outcome-${target.lastRunOutcome ?? 'none'}`}
                        >
                          {nextCheckAt
                            ? formatTimestamp(nextCheckAt)
                            : outcomeLabel(target.lastRunOutcome)}
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
