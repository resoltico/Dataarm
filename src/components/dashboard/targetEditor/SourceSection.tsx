import { useEffect, useRef, useState } from 'react';

import { inspectSource } from '../../../lib/api';
import { explainSourceInspectionError } from '../../../lib/watchSetupAssessment';
import type { GuidedDraft, TargetEditorState } from './shared';
import {
  highlightSelected,
  previewMessage,
  selectionFromPreviewPoint,
  type SourceInspectionState,
} from './sourceSection.helpers';
import { DraftSection, Field } from './shared';

export function SourceSection({ draft, state }: { draft: GuidedDraft; state: TargetEditorState }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [inspection, setInspection] = useState<SourceInspectionState>({ kind: 'idle' });
  const [selectorTrail, setSelectorTrail] = useState<string[]>([]);
  const [selectorTrailIndex, setSelectorTrailIndex] = useState(0);
  const [showAdvancedFetchSettings, setShowAdvancedFetchSettings] = useState(false);
  const inspectionResult = inspection.kind === 'ready' ? inspection.result : null;

  async function handleInspectPage() {
    setInspection({ kind: 'loading' });
    try {
      const result = await inspectSource({
        kind: draft.kind,
        sourceLocator: draft.sourceLocator,
        fetchMethod: draft.fetchMethod,
        fetchTimeoutMs: draft.fetchTimeoutMs,
        fetchUserAgent: draft.fetchUserAgent,
        fetchFollowRedirects: draft.fetchFollowRedirects,
        fetchAccept: draft.fetchAccept,
      });
      setInspection({ kind: 'ready', result, selectedText: null });
      setSelectorTrail([]);
      setSelectorTrailIndex(0);
    } catch (error) {
      setInspection({
        kind: 'error',
        message: explainSourceInspectionError(
          error instanceof Error ? error.message : String(error),
        ),
      });
    }
  }

  useEffect(() => {
    if (inspection.kind !== 'ready') {
      return;
    }
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc || selectorTrail.length === 0) {
      return;
    }
    const selector = selectorTrail[
      Math.min(selectorTrailIndex, selectorTrail.length - 1)
    ] as string;
    highlightSelected(doc, selector);
  }, [inspection, selectorTrail, selectorTrailIndex]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const frame = iframeRef.current;
    if (overlay == null || frame == null || inspectionResult == null || draft.kind !== 'http') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const rect = overlay.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const selection = selectionFromPreviewPoint(frame, {
        x: point.x,
        y: point.y,
      });
      if (!selection) {
        return;
      }

      setSelectorTrail(selection.trail);
      setSelectorTrailIndex(0);
      state.applyPreviewSelection(selection.selectedSelector);
      highlightSelected(selection.doc, selection.selectedSelector);
      setInspection({
        kind: 'ready',
        result: inspectionResult,
        selectedText: selection.selectedText,
      });
    };

    overlay.addEventListener('click', handleClick);
    return () => {
      overlay.removeEventListener('click', handleClick);
    };
  }, [draft.kind, inspectionResult, state]);

  return (
    <DraftSection
      title="Page"
      subtitle="Choose the page to watch, then load a preview so you can click the exact section you care about."
    >
      <Field label="Watch type">
        <select
          aria-label="Watch type"
          value={draft.kind}
          onChange={(event) => {
            state.setDraftKind(event.target.value as typeof draft.kind);
          }}
        >
          <option value="http">Website page</option>
          <option value="file">Local file</option>
        </select>
      </Field>
      <Field label={draft.kind === 'http' ? 'Page URL' : 'File path'} span="wide">
        <input
          aria-label={draft.kind === 'http' ? 'Page URL' : 'File path'}
          value={draft.sourceLocator}
          onChange={(event) => {
            state.setDraftField('sourceLocator', event.target.value);
          }}
        />
      </Field>
      {draft.kind === 'http' ? (
        <div className="draft-field draft-field-wide">
          <span className="draft-field-label">Visual section picker</span>
          <div className="inline-actions">
            <button onClick={() => void handleInspectPage()} type="button">
              {inspection.kind === 'loading' ? 'Loading page…' : 'Load page preview'}
            </button>
            <button
              className="button-quiet"
              disabled={
                selectorTrail.length === 0 || selectorTrailIndex >= selectorTrail.length - 1
              }
              onClick={() => {
                const nextIndex = Math.min(selectorTrail.length - 1, selectorTrailIndex + 1);
                setSelectorTrailIndex(nextIndex);
                state.setDraftField('selectionSelector', selectorTrail[nextIndex] as string);
              }}
              type="button"
            >
              Choose parent
            </button>
            <button
              className="button-quiet"
              disabled={selectorTrail.length === 0 || selectorTrailIndex === 0}
              onClick={() => {
                const nextIndex = Math.max(0, selectorTrailIndex - 1);
                setSelectorTrailIndex(nextIndex);
                state.setDraftField('selectionSelector', selectorTrail[nextIndex] as string);
              }}
              type="button"
            >
              Choose smaller section
            </button>
          </div>
          <p className="inline-note">{previewMessage(inspection)}</p>
          {inspection.kind === 'ready' ? (
            <>
              <div className="changes-meta">
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Loaded URL</span>
                  <span className="changes-meta-val">
                    {inspection.result.finalUrl ?? draft.sourceLocator}
                  </span>
                </div>
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Content type</span>
                  <span className="changes-meta-val">
                    {inspection.result.contentType ?? 'Unknown'}
                  </span>
                </div>
                <div className="changes-meta-row">
                  <span className="changes-meta-key">Current selector</span>
                  <span className="changes-meta-val">
                    {draft.selectionSelector ?? 'Click a section below'}
                  </span>
                </div>
              </div>
              <div className="watch-preview-shell">
                <iframe
                  ref={(frame) => {
                    iframeRef.current = frame;
                  }}
                  className="watch-preview-frame"
                  sandbox="allow-same-origin"
                  srcDoc={inspection.result.html}
                  title="Page preview"
                />
                <div
                  aria-label="Preview picker overlay"
                  className="watch-preview-overlay"
                  role="presentation"
                  ref={overlayRef}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="draft-field draft-field-wide">
        <button
          aria-expanded={showAdvancedFetchSettings}
          className="button-quiet draft-advanced-toggle"
          onClick={() => {
            setShowAdvancedFetchSettings((current) => !current);
          }}
          type="button"
        >
          {showAdvancedFetchSettings
            ? 'Hide advanced page settings'
            : 'Show advanced page settings'}
        </button>
      </div>
      {showAdvancedFetchSettings ? (
        <>
          <Field label="Maximum page size">
            <input
              aria-label="Maximum page size"
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
              <Field label="Browser identity" span="wide">
                <input
                  aria-label="Browser identity"
                  value={draft.fetchUserAgent ?? ''}
                  onChange={(event) => {
                    state.setDraftField('fetchUserAgent', event.target.value);
                  }}
                />
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
              <Field label="Redirects">
                <select
                  aria-label="Redirects"
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
        </>
      ) : null}
    </DraftSection>
  );
}
