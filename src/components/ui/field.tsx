import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type FieldShellProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function FieldShell({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: FieldShellProps) {
  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink"
        >
          {label}
          {required ? <span className="ml-0.5 text-[var(--status-danger)]">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--status-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? <p className="mt-1.5 text-[11.5px] text-clox-faint">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, InputProps>(function Field(
  { label, hint, error, className, id, required, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('clox-field-control', className)}
        {...props}
      />
    </FieldShell>
  );
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, id, required, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('clox-field-control min-h-24 resize-y', className)}
        {...props}
      />
    </FieldShell>
  );
});
