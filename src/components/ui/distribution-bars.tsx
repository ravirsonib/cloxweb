import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type DistributionBarItem = {
  id: string;
  label: ReactNode;
  value: number;
};

const BAR_TONES = [
  'var(--clox-accent)',
  'var(--clox-orange)',
  'var(--clox-navy)',
  'var(--status-ok)',
  'var(--status-warn)',
  'var(--status-info)',
  'var(--clox-teal)',
  'var(--clox-aqua)',
] as const;

/**
 * Category distribution from API counts — token-colored, stacks on mobile.
 * No chart library; kits don't prescribe one.
 */
export function DistributionBars({
  items,
  empty,
  className,
}: {
  items: DistributionBarItem[];
  empty?: ReactNode;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = sorted.reduce((m, item) => Math.max(m, item.value), 0);

  if (sorted.length === 0 || max <= 0) {
    return empty ? <div className={className}>{empty}</div> : null;
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {sorted.map((item, index) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        const color = BAR_TONES[index % BAR_TONES.length];
        return (
          <li key={item.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-clox-mute">{item.label}</span>
              <span className="shrink-0 font-display text-base font-semibold text-clox-ink">
                {item.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-clox-surface-alt">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
