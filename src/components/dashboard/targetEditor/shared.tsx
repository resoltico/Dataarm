import type { ReactNode } from 'react';

import type { useDashboardState } from '../../../hooks/useDashboardState';

export type TargetEditorState = ReturnType<typeof useDashboardState>;
export type GuidedDraft = NonNullable<TargetEditorState['guidedDraft']>;

export function DraftSection({
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

export function Field({
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
