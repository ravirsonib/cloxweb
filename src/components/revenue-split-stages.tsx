import { useTranslation } from 'react-i18next';
import { Field, StatusPill } from '@/components/ui';

export interface RevenueSplitStagesProps {
  carrierPercent: number;
  cloxSuperPercent: number;
  cloxStatePercent: number;
  cloxLocalPercent: number;
  /** When false, Stage 1 is display-only (e.g. partner package drawer). */
  stage1Editable?: boolean;
  onCarrierChange?: (value: string) => void;
  onCloxSuperChange: (value: string) => void;
  onCloxStateChange: (value: string) => void;
  onCloxLocalChange: (value: string) => void;
  carrierValue?: string;
  cloxSuperValue: string;
  cloxStateValue: string;
  cloxLocalValue: string;
  className?: string;
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function RevenueSplitStages({
  carrierPercent,
  cloxSuperPercent,
  cloxStatePercent,
  cloxLocalPercent,
  stage1Editable = true,
  onCarrierChange,
  onCloxSuperChange,
  onCloxStateChange,
  onCloxLocalChange,
  carrierValue,
  cloxSuperValue,
  cloxStateValue,
  cloxLocalValue,
  className = '',
}: RevenueSplitStagesProps) {
  const { t } = useTranslation('common');
  const cloxPoolPercent = Math.max(0, 100 - carrierPercent);
  const poolSum = cloxSuperPercent + cloxStatePercent + cloxLocalPercent;
  const isPoolOk = poolSum === 100;

  const handleCarrier = (raw: string) => {
    if (!onCarrierChange) return;
    onCarrierChange(raw);
  };

  const handleClox = (raw: string) => {
    if (!onCarrierChange) return;
    const clox = clampInt(raw, 1, 99);
    onCarrierChange(String(100 - clox));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Stage 1 ── */}
      <section className="rounded-clox-md border border-clox-border bg-clox-surface p-4 space-y-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute">
            {t('revenueSplit.stage1Badge', { defaultValue: 'Stage 1' })}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-clox-ink">
            {t('revenueSplit.stage1Title', {
              defaultValue: 'Split settlement gross — Carrier vs CLOX',
            })}
          </h3>
          <p className="mt-1 text-xs text-clox-mute">
            {t('revenueSplit.stage1Hint', {
              defaultValue: 'These two always add to 100% of settlement gross.',
            })}
          </p>
        </div>

        <div className="flex h-11 w-full overflow-hidden rounded-xl border border-clox-border bg-clox-surface-alt p-0.5">
          <div
            style={{ width: `${carrierPercent}%` }}
            className="flex items-center justify-center rounded-l-lg bg-blue-600 px-2 text-xs font-bold text-white"
          >
            {carrierPercent >= 12
              ? t('revenueSplit.treeCarrier', {
                  defaultValue: `Carrier ${carrierPercent}%`,
                  percent: carrierPercent,
                })
              : `${carrierPercent}%`}
          </div>
          <div
            style={{ width: `${cloxPoolPercent}%` }}
            className="flex items-center justify-center rounded-r-lg bg-slate-700 px-2 text-xs font-bold text-white"
          >
            {cloxPoolPercent >= 12
              ? t('revenueSplit.treeClox', {
                  defaultValue: `CLOX ${cloxPoolPercent}%`,
                  percent: cloxPoolPercent,
                })
              : `${cloxPoolPercent}%`}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('revenueSplit.carrierPercent', { defaultValue: 'Carrier %' })}
            hint={t('revenueSplit.stage1CarrierHint', {
              defaultValue: 'Goes to the carrier',
            })}
            value={carrierValue ?? String(carrierPercent)}
            onChange={(e) => handleCarrier(e.target.value)}
            inputMode="numeric"
            disabled={!stage1Editable}
            required={stage1Editable}
          />
          <Field
            label={t('revenueSplit.cloxGrossPercent', { defaultValue: 'CLOX %' })}
            hint={t('revenueSplit.stage1CloxHint', {
              defaultValue: 'Platform pool to split in Stage 2',
            })}
            value={String(cloxPoolPercent)}
            onChange={(e) => handleClox(e.target.value)}
            inputMode="numeric"
            disabled={!stage1Editable}
            required={stage1Editable}
          />
        </div>
      </section>

      {/* ── Stage 2 ── */}
      <section className="rounded-clox-md border border-clox-border bg-clox-surface p-4 space-y-3 border-l-4 border-l-slate-600">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute">
              {t('revenueSplit.stage2Badge', { defaultValue: 'Stage 2' })}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-clox-ink">
              {t('revenueSplit.stage2Title', {
                defaultValue: 'Split CLOX revenue — Super / State / Local',
                clox: cloxPoolPercent,
              })}
            </h3>
            <p className="mt-1 text-xs text-clox-mute">
              {t('revenueSplit.stage2Hint', {
                defaultValue: `Treat the CLOX ${cloxPoolPercent}% as 100%. These three must sum to 100%.`,
                clox: cloxPoolPercent,
              })}
            </p>
          </div>
          <StatusPill tone={isPoolOk ? 'ok' : 'danger'} className="text-xs px-2.5 py-1 font-semibold">
            {t('revenueSplit.stage2Sum', {
              sum: poolSum,
              defaultValue: `${poolSum} / 100% of CLOX`,
            })}
          </StatusPill>
        </div>

        <div className="flex h-9 w-full overflow-hidden rounded-lg border border-clox-border-soft">
          <div
            style={{ width: `${Math.max(0, cloxSuperPercent)}%` }}
            className="flex items-center justify-center bg-purple-600 text-[0.65rem] font-bold text-white"
          >
            {cloxSuperPercent >= 14 ? `Super ${cloxSuperPercent}%` : `${cloxSuperPercent}%`}
          </div>
          <div
            style={{ width: `${Math.max(0, cloxStatePercent)}%` }}
            className="flex items-center justify-center bg-amber-500 text-[0.65rem] font-bold text-white"
          >
            {cloxStatePercent >= 14 ? `State ${cloxStatePercent}%` : `${cloxStatePercent}%`}
          </div>
          <div
            style={{ width: `${Math.max(0, cloxLocalPercent)}%` }}
            className="flex items-center justify-center bg-emerald-500 text-[0.65rem] font-bold text-white"
          >
            {cloxLocalPercent >= 14 ? `Local ${cloxLocalPercent}%` : `${cloxLocalPercent}%`}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={t('revenueSplit.cloxSuperPercent', { defaultValue: 'Super % of CLOX' })}
            value={cloxSuperValue}
            onChange={(e) => onCloxSuperChange(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('revenueSplit.cloxStatePercent', { defaultValue: 'State % of CLOX' })}
            value={cloxStateValue}
            onChange={(e) => onCloxStateChange(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('revenueSplit.cloxLocalPercent', { defaultValue: 'Local % of CLOX' })}
            value={cloxLocalValue}
            onChange={(e) => onCloxLocalChange(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>
      </section>
    </div>
  );
}
