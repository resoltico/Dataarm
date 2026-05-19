import { CanonicalizersSection } from './CanonicalizersSection';
import { CanonicalTomlSection } from './CanonicalTomlSection';
import { CompareSection } from './CompareSection';
import { IdentitySection } from './IdentitySection';
import { SelectionSection } from './SelectionSection';
import { SourceSection } from './SourceSection';
import type { GuidedDraft, TargetEditorState } from './shared';

export function GuidedEditor({ draft, state }: { draft: GuidedDraft; state: TargetEditorState }) {
  return (
    <div className="guided-editor-shell">
      <IdentitySection draft={draft} state={state} />
      <SourceSection draft={draft} state={state} />
      <SelectionSection draft={draft} state={state} />
      <CompareSection draft={draft} state={state} />
      <CanonicalizersSection draft={draft} state={state} />
      <CanonicalTomlSection state={state} />
    </div>
  );
}
