import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function SelectionSection({
  draft,
  state,
}: {
  draft: GuidedDraft;
  state: TargetEditorState;
}) {
  return (
    <DraftSection
      title="Selection"
      subtitle="The guided draft keeps the extraction strategy explicit instead of hiding it in raw TOML."
    >
      <Field label="Selection kind">
        <select
          aria-label="Selection kind"
          value={draft.selectionKind}
          onChange={(event) => {
            state.setSelectionKind(event.target.value as typeof draft.selectionKind);
          }}
        >
          <option value="css_selector">CSS selector</option>
          <option value="delimiter_pair">Delimiter pair</option>
        </select>
      </Field>
      <Field label="Match mode">
        <select
          aria-label="Selection match"
          value={draft.selectionMatch}
          onChange={(event) => {
            state.setSelectionMatch(event.target.value as typeof draft.selectionMatch);
          }}
        >
          <option value="single">single</option>
          <option value="first">first</option>
          <option value="nth">nth</option>
        </select>
      </Field>
      {draft.selectionMatch === 'nth' ? (
        <Field label="Nth index (1-based)">
          <input
            aria-label="Nth index (1-based)"
            min={1}
            type="number"
            value={String(draft.selectionIndex ?? 1)}
            onChange={(event) => {
              state.setDraftField('selectionIndex', Number(event.target.value) || 1);
            }}
          />
        </Field>
      ) : null}
      {draft.selectionKind === 'css_selector' ? (
        <Field label="CSS selector" span="wide">
          <input
            aria-label="CSS selector"
            value={draft.selectionSelector ?? ''}
            onChange={(event) => {
              state.setDraftField('selectionSelector', event.target.value);
            }}
          />
        </Field>
      ) : (
        <>
          <Field label="Start delimiter" span="wide">
            <input
              aria-label="Start delimiter"
              value={draft.selectionStart ?? ''}
              onChange={(event) => {
                state.setDraftField('selectionStart', event.target.value);
              }}
            />
          </Field>
          <Field label="End delimiter" span="wide">
            <input
              aria-label="End delimiter"
              value={draft.selectionEnd ?? ''}
              onChange={(event) => {
                state.setDraftField('selectionEnd', event.target.value);
              }}
            />
          </Field>
          <Field label="Delimiter mode">
            <select
              aria-label="Delimiter mode"
              value={draft.selectionDelimiterMode ?? 'literal'}
              onChange={(event) => {
                state.setDraftField(
                  'selectionDelimiterMode',
                  event.target.value as NonNullable<typeof draft.selectionDelimiterMode>,
                );
              }}
            >
              <option value="literal">literal</option>
              <option value="regex">regex</option>
            </select>
          </Field>
          <Field label="Include start">
            <select
              aria-label="Include start"
              value={draft.selectionIncludeStart ? 'true' : 'false'}
              onChange={(event) => {
                state.setDraftField('selectionIncludeStart', event.target.value === 'true');
              }}
            >
              <option value="false">Exclude</option>
              <option value="true">Include</option>
            </select>
          </Field>
          <Field label="Include end">
            <select
              aria-label="Include end"
              value={draft.selectionIncludeEnd ? 'true' : 'false'}
              onChange={(event) => {
                state.setDraftField('selectionIncludeEnd', event.target.value === 'true');
              }}
            >
              <option value="false">Exclude</option>
              <option value="true">Include</option>
            </select>
          </Field>
          <Field label="Regex flags" span="wide">
            <input
              aria-label="Regex flags"
              placeholder="case_insensitive, multi_line"
              value={draft.selectionRegexFlags.join(', ')}
              onChange={(event) => {
                state.setDraftField(
                  'selectionRegexFlags',
                  event.target.value
                    .split(',')
                    .map((flag) => flag.trim())
                    .filter(Boolean) as typeof draft.selectionRegexFlags,
                );
              }}
            />
          </Field>
        </>
      )}
    </DraftSection>
  );
}
