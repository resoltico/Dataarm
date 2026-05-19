import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function CompareSection({ draft, state }: { draft: GuidedDraft; state: TargetEditorState }) {
  return (
    <DraftSection
      title="Change tracking"
      subtitle="Choose how Dataarm should normalize the selected section before it compares runs."
    >
      <Field label="Compare using">
        <select
          aria-label="Compare using"
          value={draft.compareBasis}
          onChange={(event) => {
            state.setDraftField('compareBasis', event.target.value as typeof draft.compareBasis);
          }}
        >
          <option value="text">Plain text</option>
          <option value="inner_html">Section HTML</option>
          <option value="outer_html">Section plus wrapper</option>
        </select>
      </Field>
      {draft.compareBasis === 'text' ? (
        <Field label="Whitespace">
          <select
            aria-label="Whitespace"
            value={draft.compareWhitespace ?? 'normalize'}
            onChange={(event) => {
              state.setDraftField(
                'compareWhitespace',
                event.target.value as NonNullable<typeof draft.compareWhitespace>,
              );
            }}
          >
            <option value="normalize">Normalize spacing</option>
            <option value="preserve">Keep original spacing</option>
          </select>
        </Field>
      ) : null}
      <Field label="Rewrite discovered URLs">
        <select
          aria-label="Rewrite discovered URLs"
          value={draft.compareRewriteUrls ? 'true' : 'false'}
          onChange={(event) => {
            state.setDraftField('compareRewriteUrls', event.target.value === 'true');
          }}
        >
          <option value="false">Keep original URLs</option>
          <option value="true">Rewrite URLs</option>
        </select>
      </Field>
      <Field label="Saved history items">
        <input
          aria-label="Saved history items"
          min={1}
          type="number"
          value={String(draft.storageHistoryLimit)}
          onChange={(event) => {
            state.setDraftField('storageHistoryLimit', Number(event.target.value) || 1);
          }}
        />
      </Field>
    </DraftSection>
  );
}
