import type { ReactNode } from 'react';
import {
  formatTimestamp,
  selectionLabelForDraft,
  sourceLabelForDraft,
} from '../../lib/presentation';
import type { TargetDraftCanonicalizer } from '../../types';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

function DraftSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="draft-section">
      <div className="draft-section-head">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="draft-grid">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  span = 'normal',
}: {
  label: string;
  children: ReactNode;
  span?: 'normal' | 'wide';
}) {
  return (
    <label className={`draft-field ${span === 'wide' ? 'draft-field-wide' : ''}`}>
      <span className="draft-field-label">{label}</span>
      {children}
    </label>
  );
}

function CanonicalizerRow({
  canonicalizer,
  index,
  state,
}: {
  canonicalizer: TargetDraftCanonicalizer;
  index: number;
  state: StateType;
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

function GuidedEditor({
  draft,
  state,
}: {
  draft: NonNullable<StateType['guidedDraft']>;
  state: StateType;
}) {
  return (
    <div className="guided-editor-shell">
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
            type="number"
            min={1}
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
                type="number"
                min={1000}
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
              type="number"
              min={1}
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
            type="number"
            min={1}
            value={String(draft.storageHistoryLimit)}
            onChange={(event) => {
              state.setDraftField('storageHistoryLimit', Number(event.target.value) || 1);
            }}
          />
        </Field>
      </DraftSection>

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

      <section className="draft-section draft-section-advanced">
        <div className="draft-section-head">
          <strong>Canonical target.toml</strong>
          <span>Preview to refresh the FFHN-owned canonical contract after guided edits.</span>
        </div>
        <textarea
          aria-label="Canonical target TOML"
          className="target-editor target-editor-readonly"
          readOnly
          spellCheck={false}
          value={state.draftToml}
        />
      </section>
    </div>
  );
}

function RepairEditor({ state }: { state: StateType }) {
  return (
    <div className="editor-shell">
      <div className="repair-banner">
        <strong>Guided editing is unavailable for this target.</strong>
        <span>
          Repair the raw target document until preview succeeds, then Dataarm will return you to
          guided authoring.
        </span>
      </div>
      <textarea
        aria-label="Target TOML editor"
        className="target-editor"
        spellCheck={false}
        value={state.draftToml}
        disabled={state.loadingTarget}
        placeholder={state.loadingTarget ? 'Loading the target document…' : undefined}
        onChange={(event) => {
          state.setDraftToml(event.target.value);
        }}
      />
    </div>
  );
}

export function TargetEditor({ state }: { state: StateType }) {
  const target = state.selectedTarget;
  const document = state.document.data;
  const draft = state.guidedDraft;
  const useRepairMode = state.repairMode || draft == null;

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
            <span>
              {draft
                ? `Guided contract: ${selectionLabelForDraft(draft)}`
                : 'Preview before saving to validate the target contract.'}
            </span>
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

      {useRepairMode ? (
        <RepairEditor state={state} />
      ) : (
        <GuidedEditor draft={draft} state={state} />
      )}
    </div>
  );
}
