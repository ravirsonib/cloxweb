import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Kpi({
  label,
  value,
  delta,
  urgent,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  urgent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'clox-kpi',
        urgent && 'border-clox-accent bg-clox-accent-tint',
        className,
      )}
    >
      <p className="clox-kpi-label">{label}</p>
      <p className="clox-kpi-value">{value}</p>
      {delta ? <p className="mt-1 text-xs text-clox-mute">{delta}</p> : null}
    </div>
  );
}

/** Responsive KPI strip — 2 cols mobile, up to 4 on large screens. */
export function KpiStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
