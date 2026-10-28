import { cn } from '@/lib/cn';

export function StatusFilterChips<TKey extends string>({
  options,
  value,
  counts,
  onChange,
  getLabel,
  'aria-label': ariaLabel,
  className,
}: {
  options: readonly TKey[];
  value: TKey;
  counts: Record<TKey, number>;
  onChange: (key: TKey) => void;
  getLabel: (key: TKey) => string;
  'aria-label': string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={cn(
              'cursor-pointer rounded-clox-sm border px-3 py-1.5 text-xs font-medium transition',
              selected
                ? 'border-clox-accent bg-clox-accent-tint text-clox-ink'
                : 'border-clox-border bg-clox-surface text-clox-mute hover:border-clox-accent hover:text-clox-ink',
            )}
          >
            {getLabel(key)}
            <span className="ml-1.5 font-mono text-[10px] text-clox-faint">
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
