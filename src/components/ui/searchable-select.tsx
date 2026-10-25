import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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
  const listboxId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.value} ${o.hint ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxHeight = 280;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, 160);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

    if (openUp) {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        bottom: window.innerHeight - rect.top + gap,
        top: 'auto',
        maxHeight: Math.min(maxHeight, Math.max(140, spaceAbove)),
      });
    } else {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        top: rect.bottom + gap,
        bottom: 'auto',
        maxHeight: Math.min(maxHeight, Math.max(140, spaceBelow)),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const listbox =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            className="clox-select-popover overflow-hidden p-0"
            style={popoverStyle}
          >
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
                    close();
                  }
                }}
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {allowClear && value ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-clox-mute hover:bg-clox-surface-alt"
                    onClick={() => {
                      onChange('');
                      close();
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
                          close();
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
          </div>,
          document.body,
        )
      : null;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      htmlFor={id}
    >
      <div ref={rootRef} className="relative min-w-0 w-full">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          className={cn(
            'clox-field-control flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden text-left',
            open && 'clox-select-trigger-open',
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
          <ChevronDown
            className={cn('clox-select-chevron', open && 'clox-select-chevron-open')}
            size={16}
            aria-hidden
          />
        </button>
        {listbox}
      </div>
    </FieldShell>
  );
}
