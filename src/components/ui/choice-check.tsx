import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Native checkbox aligned to the first line of its label (web EOI / form-controls). */
export const ChoiceCheckbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function ChoiceCheckbox({ className, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      className={cn(
        'mt-[3px] h-4 w-4 shrink-0 cursor-pointer accent-clox-accent disabled:cursor-not-allowed',
        className,
      )}
    />
  );
});

type ChoiceCheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  children: ReactNode;
  error?: ReactNode;
  labelClassName?: string;
};

/**
 * EOI-style declaration row: bordered panel + checkbox + label text.
 * Matches `web/src/components/eoi-form.tsx` section 5 structure.
 */
export const ChoiceCheck = forwardRef<HTMLInputElement, ChoiceCheckProps>(function ChoiceCheck(
  { children, error, className, labelClassName, disabled, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'rounded-xl border border-clox-border bg-clox-surface-alt p-3',
        disabled && 'opacity-60',
        className,
      )}
    >
      <label
        className={cn(
          'flex items-start gap-3 text-xs leading-relaxed text-clox-mute',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          labelClassName,
        )}
      >
        <ChoiceCheckbox ref={ref} disabled={disabled} {...props} />
        <span>{children}</span>
      </label>
      {error ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--status-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
