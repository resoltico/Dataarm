import type { TargetDraftCanonicalizer } from '../../../types';
import type { GuidedDraft, TargetEditorState } from './shared';
import { Field } from './shared';

function CanonicalizerRow({
  canonicalizer,
  index,
  state,
}: {
  canonicalizer: TargetDraftCanonicalizer;
  index: number;
  state: TargetEditorState;
}) {
  const usesRegexFlags = canonicalizer.kind === 'strip_regex';

  return (
    <div className="canonicalizer-row">
      <Field label="Kind">
        <select
          aria-label={`Canonicalizer ${String(index + 1)} kind`}
          value={canonicalizer.kind}
          onChange={(event) => {
            state.updateCanonicalizer(index, (current) => ({
              ...current,
              kind: event.target.value as TargetDraftCanonicalizer['kind'],
              pattern: event.target.value === 'strip_regex' ? (current.pattern ?? '') : null,
              flags: event.target.value === 'strip_regex' ? current.flags : [],
            }));
          }}
        >
          <option value="trim">trim</option>
          <option value="collapse_whitespace">collapse_whitespace</option>
          <option value="normalize_newlines">normalize_newlines</option>
          <option value="strip_regex">strip_regex</option>
          <option value="lowercase">lowercase</option>
        </select>
      </Field>
      {canonicalizer.kind === 'strip_regex' ? (
        <Field label="Pattern" span="wide">
          <input
            aria-label={`Canonicalizer ${String(index + 1)} pattern`}
            value={canonicalizer.pattern ?? ''}
            onChange={(event) => {
              state.updateCanonicalizer(index, (current) => ({
                ...current,
                pattern: event.target.value,
              }));
            }}
          />
        </Field>
      ) : null}
      {usesRegexFlags ? (
        <Field label="Regex flags" span="wide">
          <input
            aria-label={`Canonicalizer ${String(index + 1)} regex flags`}
            placeholder="case_insensitive, multi_line"
            value={canonicalizer.flags.join(', ')}
            onChange={(event) => {
              state.updateCanonicalizer(index, (current) => ({
                ...current,
                flags: event.target.value
                  .split(',')
                  .map((flag) => flag.trim())
                  .filter(Boolean) as TargetDraftCanonicalizer['flags'],
              }));
            }}
          />
        </Field>
      ) : null}
      <button
        className="button-danger canonicalizer-remove"
        onClick={() => {
          state.removeCanonicalizer(index);
        }}
        type="button"
      >
        Remove
      </button>
    </div>
  );
}

export function CanonicalizersSection({
  draft,
  state,
}: {
  draft: GuidedDraft;
  state: TargetEditorState;
}) {
  return (
    <section className="draft-section">
      <div className="draft-section-head">
        <strong>Canonicalizers</strong>
        <span>These are applied in order before FFHN compares the selected payload.</span>
      </div>
      <div className="canonicalizer-list">
        {draft.compareCanonicalizers.length === 0 ? (
          <p className="inline-note">
            No canonicalizers are active. Add one if the compare payload needs normalization.
          </p>
        ) : (
          draft.compareCanonicalizers.map((canonicalizer, index) => (
            <CanonicalizerRow
              key={`${canonicalizer.kind}-${String(index)}`}
              canonicalizer={canonicalizer}
              index={index}
              state={state}
            />
          ))
        )}
      </div>
      <button
        className="button-secondary-accent"
        onClick={() => {
          state.addCanonicalizer();
        }}
        type="button"
      >
        Add canonicalizer
      </button>
    </section>
  );
}
