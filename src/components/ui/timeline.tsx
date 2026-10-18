import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TimelineItemTone = 'done' | 'now' | 'pending';

export type TimelineItem = {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: TimelineItemTone;
};

export function Timeline({
  items,
  empty,
  className,
}: {
  items: TimelineItem[];
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) {
    return empty ? <div className={className}>{empty}</div> : null;
  }

  return (
    <ol className={cn('relative space-y-0 pl-6', className)}>
      <span
        className="absolute bottom-1 left-[7px] top-1 w-px bg-clox-border"
        aria-hidden
      />
      {items.map((item) => {
        const tone = item.tone ?? 'pending';
        return (
          <li key={item.id} className="relative pb-5 last:pb-0">
            <span
              className={cn(
                'absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 bg-clox-surface',
                tone === 'done' && 'border-[var(--status-ok)] bg-[var(--status-ok)]',
                tone === 'now' && 'border-clox-accent bg-clox-accent',
                tone === 'pending' && 'border-clox-border',
              )}
              aria-hidden
            />
            <p className="text-[13.5px] font-semibold text-clox-ink">{item.title}</p>
            {item.subtitle ? (
              <p className="mt-0.5 font-mono text-[11px] text-clox-faint">{item.subtitle}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
