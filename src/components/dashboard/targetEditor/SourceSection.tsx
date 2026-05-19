import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function SourceSection({ draft, state }: { draft: GuidedDraft; state: TargetEditorState }) {
  return (
    <DraftSection
      title="Source"
      subtitle="Target kind drives the durable fetch contract and the operator-facing source locator."
    >
      <Field label="Target kind">
        <select
          aria-label="Target kind"
          value={draft.kind}
          onChange={(event) => {
            state.setDraftKind(event.target.value as typeof draft.kind);
          }}
        >
          <option value="http">HTTP source</option>
          <option value="file">File source</option>
        </select>
      </Field>
      <Field label={draft.kind === 'http' ? 'Source URL' : 'File path'} span="wide">
        <input
          aria-label={draft.kind === 'http' ? 'Source URL' : 'File path'}
          value={draft.sourceLocator}
          onChange={(event) => {
            state.setDraftField('sourceLocator', event.target.value);
          }}
        />
      </Field>
      <Field label="Maximum bytes">
        <input
          aria-label="Maximum bytes"
          min={1}
          type="number"
          value={String(draft.fetchMaxBytes)}
          onChange={(event) => {
            state.setDraftField('fetchMaxBytes', Number(event.target.value) || 1);
          }}
        />
      </Field>
      {draft.kind === 'http' ? (
        <>
          <Field label="HTTP method">
            <select
              aria-label="HTTP method"
              value={draft.fetchMethod ?? 'GET'}
              onChange={(event) => {
                state.setDraftField('fetchMethod', event.target.value as 'GET');
              }}
            >
              <option value="GET">GET</option>
            </select>
          </Field>
          <Field label="Timeout (ms)">
            <input
              aria-label="Timeout (ms)"
              min={1000}
              type="number"
              value={String(draft.fetchTimeoutMs ?? 15000)}
              onChange={(event) => {
                state.setDraftField('fetchTimeoutMs', Number(event.target.value) || 1000);
              }}
            />
          </Field>
          <Field label="Accept header" span="wide">
            <input
              aria-label="Accept header"
              value={draft.fetchAccept ?? ''}
              onChange={(event) => {
                state.setDraftField('fetchAccept', event.target.value);
              }}
            />
          </Field>
          <Field label="User-Agent" span="wide">
            <input
              aria-label="User-Agent"
              value={draft.fetchUserAgent ?? ''}
              onChange={(event) => {
                state.setDraftField('fetchUserAgent', event.target.value);
              }}
            />
          </Field>
          <Field label="Redirect policy">
            <select
              aria-label="Redirect policy"
              value={draft.fetchFollowRedirects ? 'follow' : 'strict'}
              onChange={(event) => {
                state.setDraftField('fetchFollowRedirects', event.target.value === 'follow');
              }}
            >
              <option value="follow">Follow redirects</option>
              <option value="strict">Do not follow redirects</option>
            </select>
          </Field>
        </>
      ) : null}
    </DraftSection>
  );
}
