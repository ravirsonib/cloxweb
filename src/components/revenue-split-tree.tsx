import { useTranslation } from 'react-i18next';

export interface RevenueSplitTreeProps {
  carrierPercent: number;
  /** % of CLOX pool (must sum to 100) */
  cloxSuperPercent: number;
  cloxStatePercent: number;
  cloxLocalPercent: number;
  className?: string;
  /** Show optional “≈ X% of gross” under pool branches */
  showGrossHint?: boolean;
}

export interface CarrierCloxBarProps {
  carrierPercent: number;
  label?: string;
  className?: string;
  heightClassName?: string;
}

function grossOfPool(cloxPoolPercent: number, poolShare: number) {
  return Math.round((cloxPoolPercent * poolShare) / 100);
}

/** Stage 1 only — Carrier vs CLOX of gross (for uplift before/after previews). */
export function CarrierCloxBar({
  carrierPercent,
  label,
  className = '',
  heightClassName = 'h-10',
}: CarrierCloxBarProps) {
  const { t } = useTranslation('common');
  const carrier = Math.max(0, Math.min(100, Math.round(carrierPercent)));
  const clox = Math.max(0, 100 - carrier);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? <p className="text-xs font-medium text-clox-mute">{label}</p> : null}
      <div
        className={`flex w-full overflow-hidden rounded-xl border border-clox-border bg-clox-surface-alt p-0.5 ${heightClassName}`}
      >
        <div
          style={{ width: `${carrier}%` }}
          className="flex items-center justify-center rounded-l-lg bg-blue-600 px-2 text-xs font-bold text-white"
          title={`Carrier ${carrier}%`}
        >
          {carrier >= 12
            ? t('revenueSplit.treeCarrier', {
                defaultValue: `Carrier ${carrier}%`,
                percent: carrier,
              })
            : `${carrier}%`}
        </div>
        <div
          style={{ width: `${clox}%` }}
          className="flex items-center justify-center rounded-r-lg bg-slate-700 px-2 text-xs font-bold text-white"
          title={`CLOX ${clox}%`}
        >
          {clox >= 12
            ? t('revenueSplit.treeClox', {
                defaultValue: `CLOX ${clox}%`,
                percent: clox,
              })
            : `${clox}%`}
        </div>
      </div>
    </div>
  );
}

export function RevenueSplitTree({
  carrierPercent,
  cloxSuperPercent,
  cloxStatePercent,
  cloxLocalPercent,
  className = '',
  showGrossHint = true,
}: RevenueSplitTreeProps) {
  const { t } = useTranslation('common');
  const cloxPoolPercent = Math.max(0, 100 - carrierPercent);
  const superGross = grossOfPool(cloxPoolPercent, cloxSuperPercent);
  const stateGross = grossOfPool(cloxPoolPercent, cloxStatePercent);
  const localGross = Math.max(0, cloxPoolPercent - superGross - stateGross);
  const poolSum = cloxSuperPercent + cloxStatePercent + cloxLocalPercent;

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs text-clox-mute">
        {t('revenueSplit.treeStage1', {
          defaultValue: 'Stage 1 — Settlement gross splits Carrier vs CLOX',
        })}
      </p>
      <div className="flex h-10 w-full overflow-hidden rounded-xl border border-clox-border bg-clox-surface-alt p-0.5">
        <div
          style={{ width: `${carrierPercent}%` }}
          className="flex items-center justify-center rounded-l-lg bg-blue-600 px-1 text-xs font-bold text-white"
          title={`Carrier ${carrierPercent}% of gross`}
        >
          {carrierPercent >= 10
            ? t('revenueSplit.treeCarrier', {
                defaultValue: `Carrier ${carrierPercent}%`,
                percent: carrierPercent,
              })
            : `${carrierPercent}%`}
        </div>
        <div
          style={{ width: `${cloxPoolPercent}%` }}
          className="flex items-center justify-center rounded-r-lg bg-slate-700 px-1 text-xs font-bold text-white"
          title={`CLOX ${cloxPoolPercent}% of gross`}
        >
          {cloxPoolPercent >= 10
            ? t('revenueSplit.treeClox', {
                defaultValue: `CLOX ${cloxPoolPercent}%`,
                percent: cloxPoolPercent,
              })
            : `${cloxPoolPercent}%`}
        </div>
      </div>

      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-3 pl-4 border-l-4 border-l-slate-600">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute">
          {t('revenueSplit.treeStage2', {
            defaultValue: `Stage 2 — CLOX ${cloxPoolPercent}% acts as 100% for Super / State / Local`,
            clox: cloxPoolPercent,
          })}
        </p>
        <div className="mt-2 flex h-8 w-full overflow-hidden rounded-lg border border-clox-border-soft">
          <div
            style={{ width: `${cloxSuperPercent}%` }}
            className="flex items-center justify-center bg-purple-600 text-[0.65rem] font-bold text-white"
            title={`Super ${cloxSuperPercent}% of CLOX ≈ ${superGross}% of gross`}
          >
            {cloxSuperPercent >= 12
              ? `Super ${cloxSuperPercent}%`
              : `${cloxSuperPercent}%`}
          </div>
          <div
            style={{ width: `${cloxStatePercent}%` }}
            className="flex items-center justify-center bg-amber-500 text-[0.65rem] font-bold text-white"
            title={`State ${cloxStatePercent}% of CLOX ≈ ${stateGross}% of gross`}
          >
            {cloxStatePercent >= 12 ? `State ${cloxStatePercent}%` : `${cloxStatePercent}%`}
          </div>
          <div
            style={{ width: `${cloxLocalPercent}%` }}
            className="flex items-center justify-center bg-emerald-500 text-[0.65rem] font-bold text-white"
            title={`Local ${cloxLocalPercent}% of CLOX ≈ ${localGross}% of gross`}
          >
            {cloxLocalPercent >= 12 ? `Local ${cloxLocalPercent}%` : `${cloxLocalPercent}%`}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-semibold text-clox-ink">{cloxSuperPercent}%</div>
            <div className="text-clox-mute">of CLOX</div>
          </div>
          <div>
            <div className="font-semibold text-clox-ink">{cloxStatePercent}%</div>
            <div className="text-clox-mute">of CLOX</div>
          </div>
          <div>
            <div className="font-semibold text-clox-ink">{cloxLocalPercent}%</div>
            <div className="text-clox-mute">of CLOX</div>
          </div>
        </div>
        {showGrossHint ? (
          <p className="mt-2 text-xs text-clox-faint">
            {t('revenueSplit.cloxPoolGrossHint', {
              defaultValue: `Reference only — of full gross ≈ Super ${superGross}% · State ${stateGross}% · Local ${localGross}%`,
              superGross,
              stateGross,
              localGross,
            })}
          </p>
        ) : null}
        {poolSum !== 100 ? (
          <p className="mt-1 text-xs font-semibold text-[var(--status-danger)]">
            {t('revenueSplit.cloxPoolSumBad', {
              defaultValue: `CLOX pool shares sum to ${poolSum}% (need 100%)`,
              sum: poolSum,
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Convert absolute/gross admin shares into CLOX pool % (sum 100). */
export function grossAdminToCloxPool(
  superPercent: number,
  statePercent: number,
  localPercent: number,
): { cloxSuperPercent: number; cloxStatePercent: number; cloxLocalPercent: number } {
  const sum = superPercent + statePercent + localPercent;
  if (sum <= 0) return { cloxSuperPercent: 50, cloxStatePercent: 30, cloxLocalPercent: 20 };
  if (sum === 100) {
    return {
      cloxSuperPercent: superPercent,
      cloxStatePercent: statePercent,
      cloxLocalPercent: localPercent,
    };
  }
  const cloxSuperPercent = Math.round((superPercent * 100) / sum);
  const cloxStatePercent = Math.round((statePercent * 100) / sum);
  return {
    cloxSuperPercent,
    cloxStatePercent,
    cloxLocalPercent: 100 - cloxSuperPercent - cloxStatePercent,
  };
}
