import { useTranslation } from 'react-i18next';

export interface RevenueSplitBarProps {
  carrier: number;
  superAdmin: number;
  stateMaster: number;
  localBde: number;
  showCards?: boolean;
  className?: string;
}

export function RevenueSplitBar({
  carrier,
  superAdmin,
  stateMaster,
  localBde,
  showCards = true,
  className = '',
}: RevenueSplitBarProps) {
  const { t } = useTranslation('common');
  const total = carrier + superAdmin + stateMaster + localBde;
  const is100 = total === 100;
  const denom = total > 0 ? total : 1;

  const carrierWidth = (carrier / denom) * 100;
  const superWidth = (superAdmin / denom) * 100;
  const stateWidth = (stateMaster / denom) * 100;
  const localWidth = (localBde / denom) * 100;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ─── 100% Stacked Horizontal Bar ─── */}
      <div className="relative">
        <div
          className="flex h-9 w-full overflow-hidden rounded-xl border border-clox-border bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner"
          role="progressbar"
          aria-valuenow={total}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {carrier > 0 && (
            <div
              style={{ width: `${carrierWidth}%` }}
              className="group relative flex items-center justify-center bg-blue-600 text-white font-bold text-xs transition-all duration-300 rounded-l-lg hover:brightness-110 overflow-hidden px-1"
              title={`${t('revenueSplit.carrierPercent', { defaultValue: 'Carrier' })}: ${carrier}%`}
            >
              <span className="truncate">
                {carrierWidth >= 14 ? `${t('revenueSplit.carrierPercent', { defaultValue: 'Carrier' })} ${carrier}%` : carrierWidth >= 7 ? `${carrier}%` : ''}
              </span>
            </div>
          )}
          {superAdmin > 0 && (
            <div
              style={{ width: `${superWidth}%` }}
              className="group relative flex items-center justify-center bg-purple-600 text-white font-bold text-xs transition-all duration-300 hover:brightness-110 overflow-hidden px-1"
              title={`${t('revenueSplit.superPercent', { defaultValue: 'Super Admin' })}: ${superAdmin}%`}
            >
              <span className="truncate">
                {superWidth >= 14 ? `${t('revenueSplit.superPercent', { defaultValue: 'Super' })} ${superAdmin}%` : superWidth >= 7 ? `${superAdmin}%` : ''}
              </span>
            </div>
          )}
          {stateMaster > 0 && (
            <div
              style={{ width: `${stateWidth}%` }}
              className="group relative flex items-center justify-center bg-amber-500 text-white font-bold text-xs transition-all duration-300 hover:brightness-110 overflow-hidden px-1"
              title={`${t('revenueSplit.statePercent', { defaultValue: 'State Master' })}: ${stateMaster}%`}
            >
              <span className="truncate">
                {stateWidth >= 14 ? `${t('revenueSplit.statePercent', { defaultValue: 'State' })} ${stateMaster}%` : stateWidth >= 7 ? `${stateMaster}%` : ''}
              </span>
            </div>
          )}
          {localBde > 0 && (
            <div
              style={{ width: `${localWidth}%` }}
              className="group relative flex items-center justify-center bg-emerald-500 text-white font-bold text-xs transition-all duration-300 rounded-r-lg hover:brightness-110 overflow-hidden px-1"
              title={`${t('revenueSplit.localPercent', { defaultValue: 'Local BDE' })}: ${localBde}%`}
            >
              <span className="truncate">
                {localWidth >= 14 ? `${t('revenueSplit.localPercent', { defaultValue: 'Local' })} ${localBde}%` : localWidth >= 7 ? `${localBde}%` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Stakeholder Legend & Metric Cards ─── */}
      {showCards && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* Carrier Card */}
          <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-3 shadow-sm hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-2 ring-blue-100 dark:ring-blue-900" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute truncate">
                {t('revenueSplit.carrierPercent', { defaultValue: 'Carrier' })}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-clox-ink">{carrier}%</span>
              <span className="text-[0.65rem] text-clox-faint font-medium">Net Payout</span>
            </div>
          </div>

          {/* Super Admin Card */}
          <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-3 shadow-sm hover:border-purple-300 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-600 ring-2 ring-purple-100 dark:ring-purple-900" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute truncate">
                {t('revenueSplit.superPercent', { defaultValue: 'Super Admin' })}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-clox-ink">{superAdmin}%</span>
              <span className="text-[0.65rem] text-clox-faint font-medium">HQ Platform</span>
            </div>
          </div>

          {/* State Master Card */}
          <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-3 shadow-sm hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute truncate">
                {t('revenueSplit.statePercent', { defaultValue: 'State Master' })}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-clox-ink">{stateMaster}%</span>
              <span className="text-[0.65rem] text-clox-faint font-medium">Regional Reg</span>
            </div>
          </div>

          {/* Local BDE Card */}
          <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-3 shadow-sm hover:border-emerald-300 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-clox-mute truncate">
                {t('revenueSplit.localPercent', { defaultValue: 'Local BDE' })}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-clox-ink">{localBde}%</span>
              <span className="text-[0.65rem] text-clox-faint font-medium">Territory Sales</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Status indicator ─── */}
      <div className="flex items-center justify-between text-xs text-clox-mute pt-0.5">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              is100 ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className={is100 ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-semibold text-red-600'}>
            {is100
              ? '100% Full Revenue Allocation'
              : `Total: ${total}% (Must sum to exactly 100%)`}
          </span>
        </span>
        <span className="text-[0.7rem] text-clox-faint">
          Stripe Gross Settlement Base (inc-GST)
        </span>
      </div>
    </div>
  );
}
