import { useState } from 'react';

import type { TargetEditorState } from './shared';

export function CanonicalTomlSection({ state }: { state: TargetEditorState }) {
  const [showTechnicalContract, setShowTechnicalContract] = useState(false);

  return (
    <section className="draft-section draft-section-advanced">
      <div className="draft-section-head">
        <strong>Technical watch contract</strong>
        <span>
          Use this only when you need to inspect the exact FFHN contract Dataarm will save.
        </span>
      </div>
      <button
        aria-expanded={showTechnicalContract}
        className="button-quiet draft-advanced-toggle"
        onClick={() => {
          setShowTechnicalContract((current) => !current);
        }}
        type="button"
      >
        {showTechnicalContract ? 'Hide technical watch contract' : 'Show technical watch contract'}
      </button>
      {showTechnicalContract ? (
        <textarea
          aria-label="Canonical watch configuration"
          className="target-editor target-editor-readonly"
          readOnly
          spellCheck={false}
          value={state.draftToml}
        />
      ) : null}
    </section>
  );
}
