import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, Gauge, Rocket, TrendingUp, TriangleAlert } from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  DataTable,
  Kpi,
  KpiStrip,
  Notice,
  ResponsiveDataView,
  StatusPill,
  dataCardClassName,
  useToast,
  type StatusPillTone,
} from '@/components/ui';
import {
  getErrorDetail,
  getFleetAnalytics,
  getFleetPlus,
  startFleetPlusTrial,
  upgradeFleetPlus,
  type VehicleProfitRow,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDollarsAmount } from '@/lib/currency';

type RangePreset = '7d' | '30d' | '90d';

const RANGE_PRESETS: readonly RangePreset[] = ['7d', '30d', '90d'];

function presetToDays(preset: RangePreset): number {
  if (preset === '7d') return 7;
  if (preset === '90d') return 90;
  return 30;
}

function rangeToParams(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - presetToDays(preset) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function vehicleStatusTone(status: string): StatusPillTone {
  switch (status) {
    case 'ACTIVE':
      return 'ok';
    case 'PENDING_REVIEW':
      return 'warn';
    case 'SUSPENDED':
    case 'MAINTENANCE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function CarrierFleetAnalyticsPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangePreset>('30d');

  const fleetPlusQuery = useQuery({
    queryKey: ['carrier', 'fleet-plus'],
    queryFn: () => getFleetPlus(),
    staleTime: 30_000,
  });
  const entitled = fleetPlusQuery.data?.entitled ?? false;

  const analyticsQuery = useQuery({
    queryKey: ['carrier', 'fleet', 'analytics', range],
    queryFn: () => getFleetAnalytics(rangeToParams(range)),
    enabled: entitled,
    staleTime: 10_000,
  });

  const trialMutation = useMutation({
    mutationFn: () => startFleetPlusTrial(),
    onSuccess: async () => {
      toast.success(t('fleetPlus.startTrialSuccess', { defaultValue: 'Fleet+ trial started.' }));
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet-plus'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const upgradeMutation = useMutation({
    mutationFn: (tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE') => upgradeFleetPlus(tier),
    onSuccess: async (_data, tier) => {
      toast.success(
        t('fleetPlus.upgradeSuccess', {
          tier,
          defaultValue: `Fleet+ ${tier} activated.`,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet-plus'] });
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet', 'analytics'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const trialDaysLeft = useMemo(() => {
    const trialEndsAt = fleetPlusQuery.data?.trialEndsAt;
    if (!trialEndsAt) return null;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }, [fleetPlusQuery.data?.trialEndsAt]);

  function flagLabels(row: VehicleProfitRow) {
    const flags: string[] = [];
    if (row.flaggedLowMargin) flags.push(t('fleetAnalytics.flagLowMargin', { defaultValue: 'Low margin' }));
    if (row.flaggedHighIdle) flags.push(t('fleetAnalytics.flagHighIdle', { defaultValue: 'High idle' }));
    return flags;
  }

  function renderFlags(row: VehicleProfitRow) {
    const flags = flagLabels(row);
    if (flags.length === 0) {
      return <StatusPill tone="ok">{t('fleetAnalytics.flagNone', { defaultValue: 'OK' })}</StatusPill>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {flags.map((flag) => (
          <StatusPill key={flag} tone="danger">
            {flag}
          </StatusPill>
        ))}
      </div>
    );
  }

  function renderVehicleCard(row: VehicleProfitRow) {
    return (
      <div className={cn(dataCardClassName, 'flex h-full flex-col')}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-clox-ink">
              {row.registration ?? row.label ?? t('dash')}
            </p>
            <p className="mt-0.5 truncate text-xs text-clox-mute">{row.label ?? t('dash')}</p>
          </div>
          <StatusPill tone={vehicleStatusTone(row.status)}>
            {t(`fleet.statuses.${row.status}`, { defaultValue: row.status })}
          </StatusPill>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-clox-faint">{t('fleetAnalytics.colRevenueNet', { defaultValue: 'Revenue (net)' })}</dt>
            <dd className="font-mono text-clox-ink">{formatDollarsAmount(row.revenueNetAud)}</dd>
          </div>
          <div>
            <dt className="text-clox-faint">{t('fleetAnalytics.colProfit', { defaultValue: 'Profit' })}</dt>
            <dd
              className={cn(
                'font-mono',
                row.profitAud < 0 ? 'text-[var(--status-danger)]' : 'text-clox-ink',
              )}
            >
              {formatDollarsAmount(row.profitAud)}
            </dd>
          </div>
          <div>
            <dt className="text-clox-faint">{t('fleetAnalytics.colMargin', { defaultValue: 'Margin' })}</dt>
            <dd className="font-mono text-clox-ink">
              {row.marginPct == null ? t('dash') : `${row.marginPct.toFixed(1)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-clox-faint">{t('fleetAnalytics.colIdle', { defaultValue: 'Idle' })}</dt>
            <dd className="font-mono text-clox-ink">{row.idlePct.toFixed(1)}%</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-clox-faint">{t('fleetAnalytics.colFlags', { defaultValue: 'Flags' })}</dt>
            <dd className="mt-1">{renderFlags(row)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const vehicles = analyticsQuery.data?.vehicles ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-clox-orange/10 text-clox-orange">
              <BarChart3 className="h-4 w-4" aria-hidden />
            </span>
            <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {t('fleetAnalytics.title', { defaultValue: 'Fleet+ Analytics' })}
            </h1>
          </div>
          <p className="mt-2 text-sm text-clox-mute">
            {t('fleetAnalytics.subtitle', {
              defaultValue: 'Profit, utilisation, and flagged vehicles across your active fleet.',
            })}
          </p>
        </div>
        {entitled ? (
          <div className="inline-flex rounded-clox-sm border border-clox-border bg-clox-surface p-1 shadow-clox-1">
            {RANGE_PRESETS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={cn(
                  'rounded-[4px] px-3 py-1.5 text-xs font-semibold transition',
                  range === key
                    ? 'bg-clox-navy-ink text-white shadow-sm'
                    : 'text-clox-mute hover:text-clox-ink',
                )}
              >
                {t(`fleetAnalytics.period.${key}`, { defaultValue: key.toUpperCase() })}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {fleetPlusQuery.isLoading ? (
        <div className="mt-6">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {!fleetPlusQuery.isLoading &&
      fleetPlusQuery.data?.billingEnabled === false &&
      entitled ? (
        <Notice tone="success" className="mt-5">
          {t('fleetPlus.complimentaryBanner', {
            defaultValue: 'Fleet+ is included free on this platform (subscription billing is off).',
          })}
        </Notice>
      ) : null}

      {!fleetPlusQuery.isLoading &&
      fleetPlusQuery.data?.billingEnabled !== false &&
      !entitled ? (
        <Notice
          tone="warn"
          title={t('fleetPlus.notEntitledTitle', { defaultValue: 'Fleet+ required' })}
          className="mt-5"
        >
          <p>
            {t('fleetPlus.notEntitledBody', {
              defaultValue:
                'Unlock profit per trip, utilisation tracking, and maintenance flags with Fleet+. Start your 14-day free trial — no card required.',
            })}
          </p>
          <Button
            type="button"
            variant="cta"
            className="mt-3 gap-1.5"
            disabled={trialMutation.isPending}
            onClick={() => trialMutation.mutate()}
          >
            <Rocket className="h-4 w-4" aria-hidden />
            {trialMutation.isPending
              ? t('loading')
              : t('fleetPlus.startTrialCta', { defaultValue: 'Start 14-day free trial' })}
          </Button>
          {trialMutation.isError ? (
            <p className="mt-2 text-xs text-[var(--status-danger)]">
              {getErrorDetail(trialMutation.error)}
            </p>
          ) : null}
        </Notice>
      ) : null}

      {entitled &&
      fleetPlusQuery.data?.billingEnabled !== false &&
      fleetPlusQuery.data?.status === 'TRIALING' &&
      trialDaysLeft != null ? (
        <Notice tone="info" className="mt-5">
          <p>
            {t('fleetPlus.trialDaysLeft', {
              days: trialDaysLeft,
              defaultValue: `${trialDaysLeft} day(s) left in your Fleet+ trial.`,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['STARTER', 'GROWTH', 'ENTERPRISE'] as const).map((tier) => (
              <Button
                key={tier}
                type="button"
                variant="secondary"
                size="sm"
                disabled={upgradeMutation.isPending}
                onClick={() => upgradeMutation.mutate(tier)}
              >
                {t(`fleetPlus.upgrade.${tier}`, { defaultValue: `Upgrade to ${tier}` })}
              </Button>
            ))}
          </div>
        </Notice>
      ) : null}

      {entitled ? (
        <>
          {analyticsQuery.isLoading ? (
            <div className="mt-6">
              <LoadingBlock label={t('loading')} />
            </div>
          ) : null}

          {analyticsQuery.isError ? (
            <Notice tone="error" className="mt-6">
              {getErrorDetail(analyticsQuery.error)}
            </Notice>
          ) : null}

          {analyticsQuery.data ? (
            <>
              <KpiStrip className="mt-6">
                <Kpi
                  label={t('fleetAnalytics.kpiUtilisation', { defaultValue: 'Avg utilisation' })}
                  value={`${analyticsQuery.data.summary.avgUtilisationPct.toFixed(1)}%`}
                  delta={<Gauge className="h-3.5 w-3.5" aria-hidden />}
                />
                <Kpi
                  label={t('fleetAnalytics.kpiRevenueNet', { defaultValue: 'Revenue (net)' })}
                  value={formatDollarsAmount(analyticsQuery.data.summary.totalRevenueNetAud)}
                />
                <Kpi
                  label={t('fleetAnalytics.kpiProfit', { defaultValue: 'Profit' })}
                  value={formatDollarsAmount(analyticsQuery.data.summary.totalProfitAud)}
                  delta={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
                />
                <Kpi
                  label={t('fleetAnalytics.kpiFlagged', { defaultValue: 'Flagged vehicles' })}
                  value={analyticsQuery.data.summary.flaggedCount}
                  urgent={analyticsQuery.data.summary.flaggedCount > 0}
                  delta={
                    analyticsQuery.data.summary.flaggedCount > 0 ? (
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                    ) : undefined
                  }
                />
              </KpiStrip>

              {vehicles.length === 0 ? (
                <div className="mt-6">
                  <EmptyBlock
                    title={t('fleetAnalytics.emptyTitle', {
                      defaultValue: 'No fleet activity in this period.',
                    })}
                    description={t('fleetAnalytics.emptyHint', {
                      defaultValue:
                        'Analytics populate once vehicles complete locked/completed assignments.',
                    })}
                  />
                </div>
              ) : (
                <ResponsiveDataView
                  className="mt-6"
                  cards={
                    <DataCardList
                      items={vehicles}
                      getKey={(row) => row.vehicleId}
                      mode="list"
                      renderItem={renderVehicleCard}
                    />
                  }
                  table={
                    <DataTable
                      minWidthClassName="min-w-[56rem]"
                      headers={[
                        t('fleetAnalytics.colVehicle', { defaultValue: 'Vehicle' }),
                        t('fleetAnalytics.colStatus', { defaultValue: 'Status' }),
                        t('fleetAnalytics.colRevenueNet', { defaultValue: 'Revenue (net)' }),
                        t('fleetAnalytics.colProfit', { defaultValue: 'Profit' }),
                        t('fleetAnalytics.colMargin', { defaultValue: 'Margin' }),
                        t('fleetAnalytics.colIdle', { defaultValue: 'Idle' }),
                        t('fleetAnalytics.colFlags', { defaultValue: 'Flags' }),
                      ]}
                    >
                      {vehicles.map((row) => (
                        <tr
                          key={row.vehicleId}
                          className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                        >
                          <td className="px-4 py-3 align-middle">
                            <p className="font-mono text-sm text-clox-ink">
                              {row.registration ?? t('dash')}
                            </p>
                            <p className="text-xs text-clox-mute">{row.label ?? t('dash')}</p>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <StatusPill tone={vehicleStatusTone(row.status)}>
                              {t(`fleet.statuses.${row.status}`, { defaultValue: row.status })}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-sm text-clox-ink">
                            {formatDollarsAmount(row.revenueNetAud)}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-3 align-middle font-mono text-sm',
                              row.profitAud < 0 ? 'text-[var(--status-danger)]' : 'text-clox-ink',
                            )}
                          >
                            {formatDollarsAmount(row.profitAud)}
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-sm text-clox-mute">
                            {row.marginPct == null ? t('dash') : `${row.marginPct.toFixed(1)}%`}
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-sm text-clox-mute">
                            {row.idlePct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 align-middle">{renderFlags(row)}</td>
                        </tr>
                      ))}
                    </DataTable>
                  }
                />
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
