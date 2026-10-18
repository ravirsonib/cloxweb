import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StepChipItem = {
  id: string;
  label: ReactNode;
};

export function StepChips({
  steps,
  current,
  className,
}: {
  steps: readonly StepChipItem[];
  current: string;
  className?: string;
}) {
  const currentIdx = steps.findIndex((step) => step.id === current);

  return (
    <div className={cn('clox-step-chips', className)} role="list" aria-label="Progress">
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = currentIdx >= 0 && index < currentIdx;
        return (
          <span
            key={step.id}
            role="listitem"
            className={cn(
              'clox-step-chip',
              active && 'clox-step-chip-active',
              done && 'clox-step-chip-done',
            )}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}
