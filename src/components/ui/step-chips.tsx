import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StepChipItem = {
  id: string;
  label: ReactNode;
};

export function StepChips({
  steps,
  current,
  className,
  onStepSelect,
  canSelectStep,
}: {
  steps: readonly StepChipItem[];
  current: string;
  className?: string;
  /** Called when a selectable completed/current step chip is activated. */
  onStepSelect?: (stepId: string) => void;
  /** Which steps may be opened (typically completed + current while editable). */
  canSelectStep?: (stepId: string, index: number) => boolean;
}) {
  const currentIdx = steps.findIndex((step) => step.id === current);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = activeRef.current;
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    // Keep the active step visible in the horizontal strip on narrow screens.
    node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current]);

  return (
    <div
      ref={scrollerRef}
      className={cn('clox-step-chips', className)}
      role="list"
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = currentIdx >= 0 && index < currentIdx;
        const selectable =
          Boolean(onStepSelect) && (canSelectStep?.(step.id, index) ?? (done || active));
        const chipClass = cn(
          'clox-step-chip',
          selectable && 'clox-step-chip-selectable',
          active && 'clox-step-chip-active',
          done && !active && 'clox-step-chip-done',
        );

        if (selectable) {
          return (
            <button
              key={step.id}
              type="button"
              role="listitem"
              ref={active ? (el) => { activeRef.current = el; } : undefined}
              className={chipClass}
              aria-current={active ? 'step' : undefined}
              onClick={() => onStepSelect?.(step.id)}
            >
              <span className="clox-step-chip-label">{step.label}</span>
            </button>
          );
        }

        return (
          <span
            key={step.id}
            role="listitem"
            ref={active ? (el) => { activeRef.current = el; } : undefined}
            className={chipClass}
            aria-current={active ? 'step' : undefined}
          >
            <span className="clox-step-chip-label">{step.label}</span>
          </span>
        );
      })}
    </div>
  );
}
