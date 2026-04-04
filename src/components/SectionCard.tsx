import type { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  id?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>;

/** Wraps a dashboard section in the shared card layout used by the app shell. */
export function SectionCard({ id, title, subtitle, actions, children }: Props) {
  return (
    <section id={id} className="card">
      <div className="card-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="card-actions">{actions}</div> : null}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
