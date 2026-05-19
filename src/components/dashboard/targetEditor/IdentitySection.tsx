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
      title="Identity"
      subtitle="These fields anchor the durable target directory and workbench labeling."
    >
      <Field label="Target ID">
        <input
          aria-label="Target ID"
          value={draft.targetId}
          onChange={(event) => {
            state.setDraftField('targetId', event.target.value);
          }}
        />
      </Field>
      <Field label="Display name">
        <input
          aria-label="Display name"
          value={draft.displayName}
          onChange={(event) => {
            state.setDraftField('displayName', event.target.value);
          }}
        />
      </Field>
      <Field label="Enabled">
        <select
          aria-label="Enabled"
          value={draft.enabled ? 'true' : 'false'}
          onChange={(event) => {
            state.setDraftField('enabled', event.target.value === 'true');
          }}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </Field>
      <div className="draft-summary-card">
        <strong>Current extraction contract</strong>
        <span>{selectionLabelForDraft(draft)}</span>
        <span>{sourceLabelForDraft(draft)}</span>
      </div>
    </DraftSection>
  );
}
