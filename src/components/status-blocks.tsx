import { useTranslation } from 'react-i18next';

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation('common');
  return (
    <div
      className="clox-panel flex items-center gap-3 px-4 py-6 text-sm text-clox-mute"
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-clox-orange border-r-transparent" />
      {label ?? t('loading')}
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-clox-md border border-dashed border-clox-border bg-clox-surface-alt/60 px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-clox-ink">{title}</p>
      {description ? <p className="mt-2 text-sm text-clox-mute">{description}</p> : null}
    </div>
  );
}
