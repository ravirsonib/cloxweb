import type { ReactNode } from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ReadyChecklistItem = {
  id: string;
  label: ReactNode;
  done: boolean;
  /** Shown when not done — short plain hint */
  pendingHint?: ReactNode;
};

/**
 * Plain-language ready rows for post-Ops / complete onboarding.
 * Never render raw API booleans (`canBid`, `true`/`false`) — map in the caller.
 */
export function ReadyChecklist({
  title,
  items,
  className,
}: {
  title?: ReactNode;
  items: ReadyChecklistItem[];
  className?: string;
}) {
  return (
    <div className={cn('rounded-clox-md border border-clox-border bg-clox-surface p-4', className)}>
      {title ? (
        <p className="mb-3 font-display text-sm font-semibold text-clox-ink">{title}</p>
      ) : null}
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                item.done
                  ? 'border-emerald-500/80 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-amber-400/80 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
              )}
              aria-hidden
            >
              {item.done ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2.5 w-2.5" />}
            </span>
            <span className="min-w-0">
              <span className={cn('font-medium', item.done ? 'text-clox-ink' : 'text-clox-ink')}>
                {item.label}
              </span>
              {!item.done && item.pendingHint ? (
                <span className="mt-0.5 block text-xs text-clox-mute">{item.pendingHint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
