import {
  formatCompareBasisLabel,
  formatTimestamp,
  schedulePresetLabel,
  selectionLabelForDraft,
} from '../../lib/presentation';
import { previewCanBeSaved } from '../../lib/watchSetupAssessment';
import type { useDashboardState } from '../../hooks/useDashboardState';
import { GuidedEditor } from './targetEditor/GuidedEditor';
import { RepairEditor } from './targetEditor/RepairEditor';

type StateType = ReturnType<typeof useDashboardState>;

export function TargetEditor({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const document = state.document.data;
  const draft = state.guidedDraft;
  const useRepairMode = state.repairMode || draft == null;
  const previewCandidateCount = (
    state.preview.data?.dryRunReport as
      | { extraction?: { candidateCount?: number; candidate_count?: number } }
      | undefined
  )?.extraction?.candidateCount;
  const previewCandidateCountFallback = (
    state.preview.data?.dryRunReport as
      | { extraction?: { candidateCount?: number; candidate_count?: number } }
      | undefined
  )?.extraction?.candidate_count;
  const matchedSectionCount = previewCandidateCount ?? previewCandidateCountFallback ?? null;
  const draftNeedsValidatedSection = !target && !previewCanBeSaved(state.preview.data);

  return (
    <div className="editor-shell">
      {document?.errorMessage ? <p className="error">{document.errorMessage}</p> : null}
      {state.document.error ? <p className="error">{state.document.error}</p> : null}
      {state.loadingTarget ? (
        <p className="inline-note">Loading the saved watch setup for this selection.</p>
      ) : null}

      <div className="editor-toolbar">
        {target ? (
          <div className="editor-metadata">
            <span>Page: {target.sourceLocator ?? '—'}</span>
            <span>Section: {target.selectionLabel ?? '—'}</span>
            <span>Last checked: {formatTimestamp(target.lastRunAt)}</span>
            <span>
              Check every: {schedulePresetLabel(state.watchProfile ?? target.watchProfile)}
            </span>
            <span>Compare using: {formatCompareBasisLabel(target.compareBasis)}</span>
          </div>
        ) : (
          <div className="editor-metadata">
            <span>
              Mode:{' '}
              {state.editorMode === 'existing'
                ? 'editing a saved watch'
                : state.editorMode === 'http'
                  ? 'adding a website watch'
                  : 'adding a local file watch'}
            </span>
            <span>
              {draft
                ? `Selected section: ${selectionLabelForDraft(draft)}`
                : 'Preview before saving to validate the watch setup.'}
            </span>
          </div>
        )}
        <div className="inline-actions editor-primary-actions">
          <button
            onClick={state.handlePreview}
            disabled={state.loadingTarget || state.preview.loading || state.saving}
          >
            {state.preview.loading ? 'Checking section…' : 'Check section'}
          </button>
          <button
            className="button-primary"
            onClick={state.handleSave}
            disabled={state.loadingTarget || state.saving || draftNeedsValidatedSection}
            title={
              draftNeedsValidatedSection
                ? matchedSectionCount != null && matchedSectionCount > 1
                  ? 'Refine the section until exactly one match remains before saving this watch.'
                  : 'Run a successful section check before saving this watch.'
                : undefined
            }
          >
            {state.saving ? 'Saving…' : 'Save watch'}
          </button>
          {target ? (
            <button
              className="button-strong"
              onClick={state.handleRunSelectedTarget}
              disabled={state.loadingTarget || state.runningTarget || state.hasUnsavedWork}
              title={
                state.loadingTarget
                  ? 'Wait for the selected watch to finish loading.'
                  : state.hasUnsavedWork
                    ? 'Save or reset the draft before checking the saved watch.'
                    : undefined
              }
            >
              {state.runningTarget ? 'Checking…' : 'Check now'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="editor-utility-row">
        <div className="inline-actions editor-secondary-actions">
          <button onClick={state.handleResetDraft} disabled={state.loadingTarget || !state.dirty}>
            Reset changes
          </button>
          {target ? (
            <button onClick={state.handleOpenSelectedTargetPath} disabled={state.loadingTarget}>
              Open in Finder
            </button>
          ) : null}
        </div>
        {target ? (
          <button
            className="button-danger"
            onClick={state.handleDeleteSelectedTarget}
            disabled={state.loadingTarget}
          >
            Delete watch
          </button>
        ) : null}
      </div>

      {useRepairMode ? (
        <RepairEditor state={state} />
      ) : (
        <GuidedEditor draft={draft} state={state} />
      )}
    </div>
  );
}
