import type { TargetEditorState } from './shared';

export function CanonicalTomlSection({ state }: { state: TargetEditorState }) {
  return (
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
  );
}
