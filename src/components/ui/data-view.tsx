import { useEffect, useState, type Key, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export type DataViewMode = 'list' | 'grid';

const STORAGE_PREFIX = 'clox.dataView.';

export function useDataViewMode(
  storageKey: string,
  defaultMode: DataViewMode = 'list',
): [DataViewMode, (mode: DataViewMode) => void] {
  const [mode, setMode] = useState<DataViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    return stored === 'grid' || stored === 'list' ? stored : defaultMode;
  });

  useEffect(() => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, mode);
  }, [mode, storageKey]);

  return [mode, setMode];
}

export function ViewModeToggle({
  value,
  onChange,
  className,
}: {
  value: DataViewMode;
  onChange: (mode: DataViewMode) => void;
  className?: string;
}) {
  const { t } = useTranslation('common');

  return (
    <div
      className={cn(
        'inline-flex rounded-clox-sm border border-clox-border bg-clox-surface p-0.5',
        className,
      )}
      role="group"
      aria-label={t('dataView.viewMode')}
    >
      <button
        type="button"
        className={cn(
          'rounded-[5px] px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition',
          value === 'list'
            ? 'bg-clox-navy-ink text-white'
            : 'text-clox-mute hover:text-clox-ink',
        )}
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
      >
        {t('dataView.list')}
      </button>
      <button
        type="button"
        className={cn(
          'rounded-[5px] px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition',
          value === 'grid'
            ? 'bg-clox-navy-ink text-white'
            : 'text-clox-mute hover:text-clox-ink',
        )}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}
      >
        {t('dataView.grid')}
      </button>
    </div>
  );
}

/** Mobile cards + desktop table (breakpoint md). */
export function ResponsiveDataView({
  cards,
  table,
  className,
}: {
  cards: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="md:hidden">{cards}</div>
      <div className="hidden md:block">{table}</div>
    </div>
  );
}

export function CardCollection({
  mode = 'list',
  className,
  children,
}: {
  mode?: DataViewMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        mode === 'grid'
          ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
          : 'flex flex-col gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({
  headers,
  children,
  className,
  minWidthClassName = 'min-w-[40rem]',
}: {
  headers: ReactNode[];
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface shadow-clox-1',
        className,
      )}
    >
      <table className={cn('w-full text-left text-sm', minWidthClassName)}>
        <thead className="bg-clox-surface-alt font-mono text-[11px] uppercase tracking-wide text-clox-faint">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const dataCardClassName =
  'rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1 transition hover:border-clox-orange';

export function DataCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(dataCardClassName, className)}>{children}</div>;
}

/** Map items into list or grid of cards. */
export function DataCardList<T>({
  items,
  getKey,
  mode = 'list',
  renderItem,
  className,
}: {
  items: T[];
  getKey: (item: T) => Key;
  mode?: DataViewMode;
  renderItem: (item: T) => ReactNode;
  className?: string;
}) {
  return (
    <CardCollection mode={mode} className={className}>
      {items.map((item) => (
        <div key={getKey(item)} className="min-w-0">
          {renderItem(item)}
        </div>
      ))}
    </CardCollection>
  );
}
