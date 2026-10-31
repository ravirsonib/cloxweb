import { useEffect, useMemo, useState, type Key, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './button';

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
          'cursor-pointer rounded-[5px] px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition',
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
          'cursor-pointer rounded-[5px] px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition',
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
          ? // Base 2-col so List/Grid is visibly different on phone-width viewports too.
            'grid grid-cols-2 gap-3 xl:grid-cols-3'
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
  headerClassNames,
}: {
  headers: ReactNode[];
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
  /** Optional per-column th classes (e.g. text-right to match action cells). */
  headerClassNames?: Array<string | undefined>;
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
              <th
                key={index}
                className={cn('px-4 py-3 font-medium', headerClassNames?.[index])}
              >
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
        <div
          key={getKey(item)}
          className={cn('min-w-0', mode === 'grid' && 'h-full')}
        >
          {renderItem(item)}
        </div>
      ))}
    </CardCollection>
  );
}

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-clox-mute',
        className,
      )}
    >
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        {t('previous')}
      </Button>
      <span className="order-first w-full text-center sm:order-none sm:w-auto">
        {t('pageOf', { page: safePage, totalPages: safeTotalPages })}
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || safePage >= safeTotalPages}
        onClick={() => onPageChange(safePage + 1)}
      >
        {t('next')}
      </Button>
    </div>
  );
}

export function useClientPagination<T>(items: readonly T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    total: items.length,
    pagedItems,
  };
}
