import { useTranslation } from 'react-i18next';

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation('common');
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300"
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
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
    </div>
  );
}
