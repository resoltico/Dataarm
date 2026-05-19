import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function SelectionSection({
  draft,
  state,
}: {
  draft: GuidedDraft;
  state: TargetEditorState;
}) {
  const extraction = (
    state.preview.data?.dryRunReport as { extraction?: { candidateCount?: number } } | undefined
  )?.extraction;
  const candidateCount = extraction?.candidateCount ?? null;

  return (
    <DraftSection
      title="Section"
      subtitle="Tell Dataarm which part of the page matters so it can compare that section over time."
    >
      <Field label="Selection method">
        <select
          aria-label="Selection method"
          value={draft.selectionKind}
          onChange={(event) => {
            state.setSelectionKind(event.target.value as typeof draft.selectionKind);
          }}
        >
          <option value="css_selector">CSS selector</option>
          <option value="delimiter_pair">Text markers</option>
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
          <option value="single">Single match</option>
          <option value="first">First match</option>
          <option value="nth">Nth match</option>
        </select>
      </Field>
      {draft.selectionMatch === 'nth' ? (
        <Field label="Nth match (1-based)">
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
        <Field label="Section selector" span="wide">
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
          <Field label="Start marker" span="wide">
            <input
              aria-label="Start delimiter"
              value={draft.selectionStart ?? ''}
              onChange={(event) => {
                state.setDraftField('selectionStart', event.target.value);
              }}
            />
          </Field>
          <Field label="End marker" span="wide">
            <input
              aria-label="End delimiter"
              value={draft.selectionEnd ?? ''}
              onChange={(event) => {
                state.setDraftField('selectionEnd', event.target.value);
              }}
            />
          </Field>
          <Field label="Marker mode">
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
              <option value="literal">Literal text</option>
              <option value="regex">Regular expression</option>
            </select>
          </Field>
          <Field label="Keep start marker">
            <select
              aria-label="Include start"
              value={draft.selectionIncludeStart ? 'true' : 'false'}
              onChange={(event) => {
                state.setDraftField('selectionIncludeStart', event.target.value === 'true');
              }}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
          <Field label="Keep end marker">
            <select
              aria-label="Include end"
              value={draft.selectionIncludeEnd ? 'true' : 'false'}
              onChange={(event) => {
                state.setDraftField('selectionIncludeEnd', event.target.value === 'true');
              }}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
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
      <div className="draft-summary-card">
        <strong>Section validation</strong>
        <span>
          {candidateCount == null
            ? 'Use “Check section” after choosing a section so Dataarm can confirm the match.'
            : candidateCount === 1
              ? 'Matched 1 section. This watch is ready to save.'
              : `Matched ${String(candidateCount)} sections. Refine the section before saving unless you intentionally want multiple matches.`}
        </span>
      </div>
    </DraftSection>
  );
}
