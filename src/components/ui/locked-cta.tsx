import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/cn';

/**
 * Kit pattern: disabled primary + Notice explaining the missing prerequisite.
 */
export function LockedCta({
  locked,
  reason,
  className,
  children,
  disabled,
  ...buttonProps
}: ButtonProps & {
  locked: boolean;
  reason?: ReactNode;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {locked && reason ? <Notice tone="warn">{reason}</Notice> : null}
      <Button
        {...buttonProps}
        disabled={locked || Boolean(disabled)}
        className={cn(
          locked &&
            'opacity-100 [background:var(--clox-surface-alt)] [color:var(--clox-faint)] [border-color:var(--clox-border)]',
        )}
      >
        {children}
      </Button>
    </div>
  );
}
