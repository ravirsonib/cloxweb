import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloxLoader } from '@/components/clox-loader';

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation('common');
  const text = label ?? t('loading');
  return (
    <div
      className="clox-panel flex min-h-[200px] w-full flex-col items-center justify-center gap-3.5 px-6 py-10 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CloxLoader size={44} label={text} decorative className="shadow-clox-1" />
      <p className="text-sm font-medium text-clox-mute">{text}</p>
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  /** Optional CTA (e.g. "Add vehicle" or "Clear filters") rendered below the hint. */
  action?: ReactNode;
}) {
  return (
    <div className="rounded-clox-md border border-dashed border-clox-border bg-clox-surface-alt/60 px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-clox-ink">{title}</p>
      {description ? <p className="mt-2 text-sm text-clox-mute">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
