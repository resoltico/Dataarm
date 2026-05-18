import { formatTimestamp } from '../../lib/presentation';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

export function TargetEditor({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const document = state.document.data;

  return (
    <div className="editor-shell">
      {document?.errorMessage ? <p className="error">{document.errorMessage}</p> : null}
      {state.document.error ? <p className="error">{state.document.error}</p> : null}
      {state.loadingTarget ? (
        <p className="inline-note">Loading the canonical target document for this selection.</p>
      ) : null}

      <div className="editor-toolbar">
        {target ? (
          <div className="editor-metadata">
            <span>Directory: {target.directoryName}</span>
            <span>Target ID: {target.targetId ?? 'Pending parse'}</span>
            <span>Last run: {formatTimestamp(target.lastRunAt)}</span>
          </div>
        ) : (
          <div className="editor-metadata">
            <span>
              Mode:{' '}
              {state.editorMode === 'existing'
                ? 'editing a saved target'
                : `authoring a new ${state.editorMode} target`}
            </span>
            <span>Preview before saving to validate the target contract.</span>
          </div>
        )}
        <div className="inline-actions editor-primary-actions">
          <button
            onClick={state.handlePreview}
            disabled={state.loadingTarget || state.preview.loading || state.saving}
          >
            {state.preview.loading ? 'Previewing…' : 'Preview target'}
          </button>
          <button
            className="button-primary"
            onClick={state.handleSave}
            disabled={state.loadingTarget || state.saving}
          >
            {state.saving ? 'Saving…' : 'Save target'}
          </button>
          {target ? (
            <button
              className="button-strong"
              onClick={state.handleRunSelectedTarget}
              disabled={state.loadingTarget || state.runningTarget || state.hasUnsavedWork}
              title={
                state.loadingTarget
                  ? 'Wait for the selected target to finish loading.'
                  : state.hasUnsavedWork
                    ? 'Save or reset the draft before running the saved target.'
                    : undefined
              }
            >
              {state.runningTarget ? 'Running…' : 'Run target'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="editor-utility-row">
        <div className="inline-actions editor-secondary-actions">
          <button onClick={state.handleResetDraft} disabled={state.loadingTarget || !state.dirty}>
            Reset draft
          </button>
          {target ? (
            <button onClick={state.handleOpenSelectedTargetPath} disabled={state.loadingTarget}>
              Open folder
            </button>
          ) : null}
        </div>
        {target ? (
          <button
            className="button-danger"
            onClick={state.handleDeleteSelectedTarget}
            disabled={state.loadingTarget}
          >
            Delete target
          </button>
        ) : null}
      </div>
      <textarea
        aria-label="Target TOML editor"
        className="target-editor"
        spellCheck={false}
        value={state.draftToml}
        disabled={state.loadingTarget}
        placeholder={state.loadingTarget ? 'Loading the canonical target document…' : undefined}
        onChange={(event) => {
          state.setDraftToml(event.target.value);
        }}
      />
    </div>
  );
}
