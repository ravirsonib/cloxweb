import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ActionGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Alignment of actions. Defaults to 'end' (right-aligned for tables and cards). */
  align?: 'start' | 'center' | 'end';
  /** Whether items can wrap onto multiple lines when space is constrained. */
  wrap?: boolean;
}

/**
 * Standardized container for action buttons and links in data tables, cards, and headers.
 * Ensures consistent gap, alignment, and inline presentation across the application.
 */
export const ActionGroup = forwardRef<HTMLDivElement, ActionGroupProps>(
  function ActionGroup({ children, align = 'end', wrap = false, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5',
          wrap ? 'flex-wrap' : 'shrink-0',
          align === 'end' && 'justify-end',
          align === 'start' && 'justify-start',
          align === 'center' && 'justify-center',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
