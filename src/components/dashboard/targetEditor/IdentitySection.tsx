import { selectionLabelForDraft, sourceLabelForDraft } from '../../../lib/presentation';
import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function IdentitySection({
  draft,
  state,
}: {
  draft: GuidedDraft;
  state: TargetEditorState;
}) {
  return (
    <DraftSection
      title="Watch details"
      subtitle="Name the watch clearly so you can recognize it in the dashboard and history."
    >
      <Field label="Short name">
        <input
          aria-label="Short name"
          value={draft.targetId}
          onChange={(event) => {
            state.setDraftField('targetId', event.target.value);
          }}
        />
      </Field>
      <Field label="Watch name">
        <input
          aria-label="Watch name"
          value={draft.displayName}
          onChange={(event) => {
            state.setDraftField('displayName', event.target.value);
          }}
        />
      </Field>
      <Field label="Active">
        <select
          aria-label="Active"
          value={draft.enabled ? 'true' : 'false'}
          onChange={(event) => {
            state.setDraftField('enabled', event.target.value === 'true');
          }}
        >
          <option value="true">Active</option>
          <option value="false">Paused</option>
        </select>
      </Field>
      <div className="draft-summary-card">
        <strong>Current watch summary</strong>
        <span>{selectionLabelForDraft(draft)}</span>
        <span>{sourceLabelForDraft(draft)}</span>
      </div>
    </DraftSection>
  );
}
