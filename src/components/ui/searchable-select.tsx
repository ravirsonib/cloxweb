import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FieldShell } from './field';

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
  /** Secondary badge on the right (e.g. Coming soon). */
  badge?: string;
  disabled?: boolean;
};

export type SearchableSelectProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
};

export function SearchableSelect({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No matches',
  disabled = false,
  allowClear = false,
  clearLabel = 'Clear',
}: SearchableSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.value} ${o.hint ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      htmlFor={id}
    >
      <div ref={rootRef} className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'clox-field-control flex w-full items-center justify-between gap-2 text-left',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
            setQuery('');
          }}
        >
          <span className={cn('min-w-0 truncate', !selected && 'text-clox-faint')}>
            {selected ? (
              <>
                <span className="font-medium text-clox-ink">{selected.label}</span>
                {selected.hint ? (
                  <span className="ml-1.5 text-clox-mute">{selected.hint}</span>
                ) : null}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-clox-faint" aria-hidden />
        </button>

        {open ? (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-clox-md border border-clox-border bg-clox-surface shadow-clox-2">
            <div className="flex items-center gap-2 border-b border-clox-border-soft px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-clox-faint" aria-hidden />
              <input
                ref={inputRef}
                type="search"
                className="w-full bg-transparent text-sm text-clox-ink outline-none placeholder:text-clox-faint"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered[0] && !filtered[0].disabled) {
                    e.preventDefault();
                    onChange(filtered[0].value);
                    setOpen(false);
                    setQuery('');
                  }
                }}
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {allowClear && value ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-clox-mute hover:bg-clox-surface-alt"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {clearLabel}
                  </button>
                </li>
              ) : null}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-clox-faint">{emptyLabel}</li>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                          opt.disabled
                            ? 'cursor-not-allowed opacity-40 blur-[0.3px]'
                            : 'hover:bg-clox-surface-alt',
                          isSelected && !opt.disabled && 'bg-clox-surface-alt',
                        )}
                        onClick={() => {
                          if (opt.disabled) return;
                          onChange(opt.value);
                          setOpen(false);
                          setQuery('');
                        }}
                      >
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block font-medium',
                              opt.disabled ? 'text-clox-faint' : 'text-clox-ink',
                            )}
                          >
                            {opt.label}
                          </span>
                          {opt.hint ? (
                            <span className="block text-xs text-clox-mute">{opt.hint}</span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {opt.badge ? (
                            <span className="rounded-md bg-clox-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-clox-mute">
                              {opt.badge}
                            </span>
                          ) : null}
                          {isSelected && !opt.disabled ? (
                            <Check className="h-4 w-4 text-clox-orange" aria-hidden />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}
