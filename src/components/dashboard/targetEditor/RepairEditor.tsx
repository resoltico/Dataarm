import type { useDashboardState } from '../../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

export function RepairEditor({ state }: { state: StateType }) {
  return (
    <div className="editor-shell">
      <div className="repair-banner">
        <strong>Guided editing is unavailable for this target.</strong>
        <span>
          Repair the raw target document until preview succeeds, then Dataarm will return you to
          guided authoring.
        </span>
      </div>
      <textarea
        aria-label="Target TOML editor"
        className="target-editor"
        spellCheck={false}
        value={state.draftToml}
        disabled={state.loadingTarget}
        placeholder={state.loadingTarget ? 'Loading the target document…' : undefined}
        onChange={(event) => {
          state.setDraftToml(event.target.value);
        }}
      />
    </div>
  );
}
