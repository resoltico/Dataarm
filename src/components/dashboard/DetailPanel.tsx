import { TargetEditor } from './TargetEditor';
import { StatusPill } from '../StatusPill';
import { summarizeTarget } from '../../lib/presentation';
import type { useDashboardState } from '../../hooks/useDashboardState';
import { ArtifactsTab } from './detailPanel/ArtifactsTab';
import { ChangesTab } from './detailPanel/ChangesTab';

type StateType = ReturnType<typeof useDashboardState>;
type DetailTab = StateType['detailTab'];

export function DetailPanel({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const isDraft = state.isDraftContext;
  const activeTab = state.detailTab;

  const title = isDraft
    ? state.editorMode === 'http'
      ? 'Add watch'
      : state.editorMode === 'file'
        ? 'Add local file watch'
        : 'Add watch'
    : summarizeTarget(target);

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'changes', label: isDraft ? 'Watch setup' : 'What changed' },
    { id: 'config', label: 'Settings' },
    { id: 'artifacts', label: 'History' },
  ];

  return (
    <div className="detail-panel">
      <div className="detail-panel-head">
        <div className="detail-panel-identity">
          <h2 className="detail-panel-title">{title}</h2>
          {!isDraft && target ? <StatusPill value={target.statusKind} /> : null}
          {state.dirty ? <span className="meta-chip meta-chip-accent">Unsaved watch</span> : null}
        </div>
      </div>

      <div className="detail-tab-strip">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`detail-tab-btn ${activeTab === t.id ? 'detail-tab-btn-active' : ''}`}
            onClick={() => {
              state.setDetailTab(t.id);
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="detail-tab-body">
        {activeTab === 'changes' ? <ChangesTab state={state} /> : null}
        {activeTab === 'config' ? <TargetEditor state={state} /> : null}
        {activeTab === 'artifacts' ? <ArtifactsTab state={state} /> : null}
      </div>
    </div>
  );
}
