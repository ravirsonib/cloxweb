import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui';
import { formatDollars } from '@/lib/currency';
import { cn } from '@/lib/cn';
import type { RateFloorPreview } from '@/lib/api/jobs';

type FloorBits = {
  exGstCents: number | null | undefined;
  incGstCents: number | null | undefined;
  versionLabel?: string | null;
  versionId?: string | null;
  breakdown?: Record<string, unknown> | null;
  message?: string | null;
};

function fromPreview(p: RateFloorPreview): FloorBits {
  return {
    exGstCents: p.floorExGstCents,
    incGstCents: p.floorIncGstCents,
    versionLabel: p.versionLabel,
    versionId: p.versionId,
    breakdown: p.breakdown,
    message: p.message,
  };
}

export function JobRateFloorPanel({
  preview,
  fallback,
  estimateIncGstCents,
  loading,
  errorText,
  className,
}: {
  preview?: RateFloorPreview | null;
  fallback?: FloorBits | null;
  estimateIncGstCents?: number | null;
  loading?: boolean;
  errorText?: string | null;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const [openHow, setOpenHow] = useState(false);
  const floor = preview ? fromPreview(preview) : fallback;
  const ex = floor?.exGstCents ?? null;
  const inc = floor?.incGstCents ?? null;
  if (loading) {
    return (
      <p className={cn('text-xs text-clox-mute', className)}>
        {t('jobs.floorLoading', { defaultValue: 'Loading minimum price…' })}
      </p>
    );
  }
  if (errorText) {
    return (
      <Notice tone="warn" className={className}>
        {errorText}
      </Notice>
    );
  }
  if (inc == null || inc <= 0) return null;

  const below =
    estimateIncGstCents != null &&
    estimateIncGstCents > 0 &&
    estimateIncGstCents < inc;
  const estimateAbove =
    estimateIncGstCents != null &&
    estimateIncGstCents > 0 &&
    estimateIncGstCents > inc;
  /** Avoid "ex · inc" looking duplicated when GST was 0 or snapshot matched. */
  const exDistinct =
    ex != null && ex > 0 && Math.abs(ex - inc) >= 1;

  const diesel =
    floor?.breakdown && typeof floor.breakdown.dieselCplUsed === 'number'
      ? floor.breakdown.dieselCplUsed
      : floor?.breakdown && typeof floor.breakdown.dieselCpl === 'number'
        ? floor.breakdown.dieselCpl
        : null;
  const fuelWeek =
    typeof floor?.breakdown?.fuelWeekStart === 'string'
      ? floor.breakdown.fuelWeekStart
      : null;

  return (
    <div className={cn('space-y-2', className)}>
      <Notice tone={below ? 'warn' : 'info'}>
        <p className="text-sm font-medium text-clox-ink">
          {exDistinct
            ? t('jobs.hardFloorHint', {
                defaultValue:
                  'Absolute minimum (hard floor): {{ex}} ex GST · {{inc}} inc GST — publish and bids cannot go below this.',
                ex: formatDollars(ex!),
                inc: formatDollars(inc),
              })
            : t('jobs.hardFloorHintIncOnly', {
                defaultValue:
                  'Absolute minimum (hard floor): {{inc}} inc GST — publish and bids cannot go below this.',
                inc: formatDollars(inc),
              })}
        </p>
        {below ? (
          <p className="mt-1 text-xs">
            {t('jobs.floorBelowEstimate', {
              defaultValue:
                'Current estimate ({{est}}) is below the floor. Publish and bids are blocked until the estimate meets the minimum.',
              est: formatDollars(estimateIncGstCents ?? 0),
            })}
          </p>
        ) : null}
        {estimateAbove ? (
          <p className="mt-1 text-xs text-clox-mute">
            {t('jobs.floorVsEstimateHint', {
              defaultValue:
                'Market estimate {{est}} is above this floor. The estimate is guidance for typical pricing; the hard floor is only the absolute minimum.',
              est: formatDollars(estimateIncGstCents ?? 0),
            })}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-clox-orange hover:underline"
          onClick={() => setOpenHow((v) => !v)}
        >
          {openHow
            ? t('jobs.floorHowHide', { defaultValue: 'Hide calculation details' })
            : t('jobs.floorHowShow', { defaultValue: 'How is this calculated?' })}
        </button>
        {openHow ? (
          <ul className="mt-2 space-y-0.5 text-xs text-clox-mute">
            {floor?.versionLabel || floor?.versionId ? (
              <li>
                {t('jobs.floorVersion', {
                  defaultValue: 'Floor version: {{label}}',
                  label: floor.versionLabel || floor.versionId,
                })}
              </li>
            ) : null}
            {diesel != null ? (
              <li>
                {t('jobs.floorDiesel', {
                  defaultValue: 'Diesel index: {{cpl}} c/L{{week}}',
                  cpl: diesel,
                  week: fuelWeek ? ` (week ${fuelWeek})` : '',
                })}
              </li>
            ) : null}
            {preview?.message ? <li>{preview.message}</li> : null}
          </ul>
        ) : null}
      </Notice>
    </div>
  );
}
