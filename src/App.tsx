import { useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { NavSidebar, type FilterView, type TargetGroupBy } from './components/layout/NavSidebar';
import { TargetTable } from './components/dashboard/TargetTable';
import { DetailPanel } from './components/dashboard/DetailPanel';
import { useDashboardState } from './hooks/useDashboardState';

export default function App() {
  const state = useDashboardState();
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<TargetGroupBy>('status');
  const showDetail = state.selectedDirectoryName !== null || state.isDraftContext;
  const detailContextKey = showDetail
    ? state.isDraftContext
      ? `draft:${state.editorMode}`
      : `target:${state.selectedDirectoryName ?? 'none'}`
    : 'empty';

  return (
    <div className="app-shell">
      <TopBar state={state} />
      <div className="app-body">
        <NavSidebar state={state} filterView={filterView} setFilterView={setFilterView} />
        <div className="main-panel">
          <div className="target-table-section">
            <TargetTable
              state={state}
              filterView={filterView}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
            />
          </div>
          {showDetail ? (
            <div className="detail-section">
              <DetailPanel key={detailContextKey} state={state} />
            </div>
          ) : (
            <div className="detail-placeholder">
              <span>Select a target to view details, or create a new one.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
