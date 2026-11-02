import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DetailRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  children: ReactNode;
  /** Layout direction: 'horizontal' (label left, value right on desktop) or 'stacked' (label top, value bottom). */
  layout?: 'horizontal' | 'stacked';
}

/**
 * Responsive key-value row for metadata, overview sections, cards, and modal sheets.
 * Handles mobile screens gracefully by stacking vertically without squeezing or clipping labels.
 */
export const DetailRow = forwardRef<HTMLDivElement, DetailRowProps>(
  function DetailRow({ label, children, layout = 'horizontal', className, ...props }, ref) {
    if (layout === 'stacked') {
      return (
        <div ref={ref} className={cn('py-2 border-b border-clox-border-soft last:border-0', className)} {...props}>
          <dt className="text-xs text-clox-mute font-medium">{label}</dt>
          <dd className="mt-1 text-sm font-medium text-clox-ink break-words min-w-0">{children}</dd>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1 sm:gap-4 border-b border-clox-border-soft last:border-0',
          className,
        )}
        {...props}
      >
        <dt className="text-xs sm:text-sm text-clox-mute shrink-0">{label}</dt>
        <dd className="text-sm font-medium text-clox-ink break-words sm:text-right min-w-0">{children}</dd>
      </div>
    );
  },
);

export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  children: ReactNode;
}

/**
 * Styled definition list container for DetailRow items.
 */
export const DescriptionList = forwardRef<HTMLDListElement, DescriptionListProps>(
  function DescriptionList({ children, className, ...props }, ref) {
    return (
      <dl ref={ref} className={cn('divide-y divide-clox-border-soft text-sm', className)} {...props}>
        {children}
      </dl>
    );
  },
);
