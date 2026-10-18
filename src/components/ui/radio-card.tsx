import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FieldShell } from './field';

export type RadioCardOption<T extends string = string> = {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export function RadioCardGroup<T extends string>({
  label,
  hint,
  error,
  required,
  name,
  value,
  onChange,
  options,
  className,
  columns = 2,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: RadioCardOption<T>[];
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      <div
        role="radiogroup"
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          'grid gap-2',
          columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          const optionId = name ? `${name}-${option.value}` : undefined;
          return (
            <button
              key={option.value}
              id={optionId}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              className={cn(
                'clox-radio-card',
                selected && 'clox-radio-card-selected',
                option.disabled && 'clox-radio-card-disabled',
              )}
              onClick={() => {
                if (!option.disabled) onChange(option.value);
              }}
            >
              <span className="clox-radio-card-title">{option.title}</span>
              {option.description ? (
                <span className="clox-radio-card-desc">{option.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
