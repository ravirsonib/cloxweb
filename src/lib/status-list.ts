/** Shared list status accents / filter helpers (assignments, market board, …). */

export type ListStatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const ACCENT: Record<ListStatusTone, string> = {
  warn: 'border-l-4 border-l-[var(--status-warn)] bg-[color-mix(in_srgb,var(--status-warn-bg)_55%,var(--clox-surface))]',
  info: 'border-l-4 border-l-[var(--status-info)] bg-[color-mix(in_srgb,var(--status-info-bg)_55%,var(--clox-surface))]',
  ok: 'border-l-4 border-l-[var(--status-ok)] opacity-90',
  danger: 'border-l-4 border-l-[var(--status-danger)] opacity-80',
  neutral: 'border-l-4 border-l-[var(--status-neutral)]',
};

export function statusAccentClass(tone: ListStatusTone): string {
  return ACCENT[tone];
}

export function countByBucket<TItem, TBucket extends string>(
  items: readonly TItem[],
  bucketOf: (item: TItem) => TBucket,
  filters: readonly ('all' | TBucket)[],
): Record<'all' | TBucket, number> {
  const counts = Object.fromEntries(filters.map((key) => [key, 0])) as Record<
    'all' | TBucket,
    number
  >;
  counts.all = items.length;
  for (const item of items) {
    const bucket = bucketOf(item);
    if (bucket in counts) counts[bucket] += 1;
  }
  return counts;
}

export function filterAndSortByBucket<TItem, TBucket extends string>(
  items: readonly TItem[],
  bucketOf: (item: TItem) => TBucket,
  filter: 'all' | TBucket,
  sortOrder: Record<TBucket, number>,
): TItem[] {
  const filtered =
    filter === 'all' ? [...items] : items.filter((item) => bucketOf(item) === filter);
  return filtered.sort(
    (a, b) => sortOrder[bucketOf(a)] - sortOrder[bucketOf(b)],
  );
}
