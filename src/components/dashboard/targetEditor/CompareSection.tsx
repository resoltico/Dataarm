import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function CompareSection({ draft, state }: { draft: GuidedDraft; state: TargetEditorState }) {
  return (
    <DraftSection
      title="Compare"
      subtitle="The compare contract controls which projection becomes the canonical change payload."
    >
      <Field label="Compare basis">
        <select
          aria-label="Compare basis"
          value={draft.compareBasis}
          onChange={(event) => {
            state.setDraftField('compareBasis', event.target.value as typeof draft.compareBasis);
          }}
        >
          <option value="text">text</option>
          <option value="inner_html">inner_html</option>
          <option value="outer_html">outer_html</option>
        </select>
      </Field>
      {draft.compareBasis === 'text' ? (
        <Field label="Whitespace policy">
          <select
            aria-label="Whitespace policy"
            value={draft.compareWhitespace ?? 'normalize'}
            onChange={(event) => {
              state.setDraftField(
                'compareWhitespace',
                event.target.value as NonNullable<typeof draft.compareWhitespace>,
              );
            }}
          >
            <option value="normalize">normalize</option>
            <option value="preserve">preserve</option>
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
      <Field label="Snapshot history limit">
        <input
          aria-label="Snapshot history limit"
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
