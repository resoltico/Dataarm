import { statusLabel, statusTone } from '../lib/presentation';
import type { TargetStatusKind } from '../types';

export function StatusPill({
  value,
  label,
  size = 'default',
}: {
  value: TargetStatusKind;
  label?: string;
  size?: 'default' | 'compact';
}) {
  return (
    <span className={`pill pill-${statusTone(value)} ${size === 'compact' ? 'pill-compact' : ''}`}>
      <span className="pill-dot" aria-hidden="true" />
      {label ?? statusLabel(value)}
    </span>
  );
}
