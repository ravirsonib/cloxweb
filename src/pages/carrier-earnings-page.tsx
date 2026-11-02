import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { LoadingBlock } from '@/components/status-blocks';
import {
  AnimatedNumber,
  Button,
  InteractiveChart,
  Notice,
  type ChartDataItem,
} from '@/components/ui';
import { getCarrierFinance, getErrorDetail } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CURRENCY_SYMBOL, formatDollars } from '@/lib/currency';
import type { FinanceQuery } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type PeriodOption = 'today' | 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all';

export function CarrierEarningsPage() {
  const { t } = useTranslation();
  const displayName = useAuthStore((s) => s.displayName);

  const [period, setPeriod] = useState<PeriodOption>('month');

  const queryParams: FinanceQuery = useMemo(() => {
    return { period };
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['carrier-finance', queryParams],
    queryFn: ({ signal }) => getCarrierFinance(queryParams, { signal }),
  });

  const carrierPercent = data?.carrierPercent ?? 70;
  const clearingDays = data?.clearingDays ?? 7;
  const clearingPhrase =
    clearingDays === 0
      ? t('finance.carrier.clearingInstant', { defaultValue: 'instant settlement' })
      : t('finance.carrier.clearingDays', {
          count: clearingDays,
          defaultValue: `${clearingDays}-day clearing pipeline`,
        });

  // Chart data: Net earnings per trip
  const tripChartItems: ChartDataItem[] = useMemo(() => {
    if (!data?.tripLedger || data.tripLedger.length === 0) {
      return [
        { id: 't1', label: 'Trip A', value: 850 },
        { id: 't2', label: 'Trip B', value: 1200 },
        { id: 't3', label: 'Trip C', value: 950 },
      ];
    }
    return data.tripLedger.slice(0, 10).map((t, idx) => ({
      id: t.tripId || `trip-${idx}`,
      label: t.jobTitle.length > 18 ? `${t.jobTitle.substring(0, 18)}…` : t.jobTitle,
      value: Math.round(t.carrierNetCents / 100),
    }));
  }, [data?.tripLedger]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Header & Controls ─── */}
      <div className="flex flex-col gap-4 border-b border-clox-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
              <Truck className="h-3.5 w-3.5" />
              <span>{data?.companyName || displayName || t('finance.carrier.carrierFleet', { defaultValue: 'Carrier Fleet' })}</span>
            </span>
            {data?.payoutsEnabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t('finance.carrier.payoutsActive', { defaultValue: 'Stripe Payouts Active' })}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{t('finance.carrier.payoutsPending', { defaultValue: 'Payout Verification Pending' })}</span>
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-clox-ink sm:text-3xl">
            {t('finance.carrier.title', { defaultValue: 'Carrier Earnings & Payouts' })}
          </h1>
          <p className="mt-0.5 text-xs text-clox-mute sm:text-sm">
            {t('finance.carrier.subtitle', {
              percent: carrierPercent,
              clearing: clearingPhrase,
              defaultValue: `Guaranteed ${carrierPercent}% net freight payouts with ${clearingPhrase} and direct bank transfers`,
            })}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-clox-sm border border-clox-border bg-clox-surface p-1 shadow-clox-1">
            {(
              [
                ['today', t('finance.periods.today', { defaultValue: 'Today' })],
                ['week', t('finance.periods.week', { defaultValue: 'Week' })],
                ['month', t('finance.periods.month', { defaultValue: 'Month' })],
                ['30d', t('finance.periods.30d', { defaultValue: '30D' })],
                ['quarter', t('finance.periods.quarter', { defaultValue: 'Quarter' })],
                ['year', t('finance.periods.year', { defaultValue: 'Year' })],
                ['all', t('finance.periods.all', { defaultValue: 'All' })],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={cn(
                  'rounded-[4px] px-2.5 py-1 text-xs font-semibold transition',
                  period === key
                    ? 'bg-clox-navy-ink text-white shadow-sm'
                    : 'text-clox-mute hover:text-clox-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
            title={t('finance.refresh', { defaultValue: 'Refresh' })}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">{t('finance.refresh', { defaultValue: 'Refresh' })}</span>
          </Button>
        </div>
      </div>

      {/* Stripe Connect Warning if not enabled */}
      {data && !data.payoutsEnabled ? (
        <Notice
          tone="warn"
          title={t('finance.carrier.payoutsHoldTitle', { defaultValue: 'Bank Payouts On Hold' })}
        >
          {t('finance.carrier.payoutsHoldBody', {
            defaultValue:
              'Your Stripe Connect account requires bank account details or identity verification before earnings can be disbursed to your bank. Please update your account details.',
          })}
        </Notice>
      ) : null}

      {/* Error Notice */}
      {isError ? (
        <Notice
          tone="error"
          title={t('finance.errorTitle', { defaultValue: 'Unable to load earnings data' })}
        >
          {getErrorDetail(error)}
        </Notice>
      ) : null}

      {/* Loading Block */}
      {isLoading ? (
        <LoadingBlock
          label={t('finance.loading', { defaultValue: 'Calculating carrier disbursements...' })}
        />
      ) : null}

      {/* ─── 4 KPI Metrics Row ─── */}
      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Total Net Earned */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.carrier.netEarned', {
                  percent: carrierPercent,
                  defaultValue: `Total Net Earned (${carrierPercent}%)`,
                })}
              </span>
              <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.totalEarnedCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.carrier.netEarnedSub', {
                  count: data.summary.completedTripsCount,
                  defaultValue: `${data.summary.completedTripsCount} delivered trips`,
                })}
              </span>
              <span className="font-semibold text-emerald-700">
                {t('finance.carrier.netShare', {
                  percent: carrierPercent,
                  defaultValue: `${carrierPercent}% Net Share`,
                })}
              </span>
            </div>
          </div>

          {/* 2. Clearing Balance */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {clearingDays === 0
                  ? t('finance.carrier.clearingImmediate', { defaultValue: 'Immediate Settlement' })
                  : t('finance.carrier.clearingHold', {
                      days: clearingDays,
                      defaultValue: `${clearingDays}-Day Clearing Hold`,
                    })}
              </span>
              <div className="rounded-full bg-amber-50 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-amber-800 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.clearingCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.carrier.clearingSub', { defaultValue: 'Cooling-off buffer' })}</span>
              <span className="font-semibold text-amber-700">
                {t('finance.carrier.clearingSoon', { defaultValue: 'Clearing soon' })}
              </span>
            </div>
          </div>

          {/* 3. Disbursed to Bank */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.carrier.paidOut', { defaultValue: 'Paid Out to Bank' })}
              </span>
              <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-emerald-800 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.paidOutCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.carrier.paidOutSub', { defaultValue: 'Direct Stripe Payout' })}</span>
              <span className="font-semibold text-emerald-700">
                {t('finance.carrier.finalized', { defaultValue: 'Finalized' })}
              </span>
            </div>
          </div>

          {/* 4. Active In-Progress Freight */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.carrier.inTransit', { defaultValue: 'In-Transit Escrow' })}
              </span>
              <div className="rounded-full bg-sky-50 p-2 text-sky-600">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.inProgressCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.carrier.inTransitSub', {
                  count: data.summary.activeTripsCount,
                  defaultValue: `${data.summary.activeTripsCount} loads on road`,
                })}
              </span>
              <span className="font-semibold text-sky-700">
                {t('finance.sender.inEscrowStatus', { defaultValue: 'In escrow' })}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Settlement Policy Banner ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
        <h3 className="font-display text-sm font-bold text-clox-ink">
          {t('finance.carrier.howItWorksTitle', {
            percent: carrierPercent,
            defaultValue: `How CLOX ${carrierPercent}% Carrier Payments Work`,
          })}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-clox-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                1
              </span>
              <span>{t('finance.carrier.step1Title', { defaultValue: 'Trip Completed & POD Signed' })}</span>
            </div>
            <p className="mt-1.5 text-xs text-clox-mute">
              {t('finance.carrier.step1Desc', {
                percent: carrierPercent,
                defaultValue: `Upon final Proof of Delivery upload, the ${carrierPercent}% net carrier fare is credited to your account.`,
              })}
            </p>
          </div>

          <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-clox-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                2
              </span>
              <span>
                {clearingDays === 0
                  ? t('finance.carrier.step2InstantTitle', { defaultValue: 'Immediate Clearance' })
                  : t('finance.carrier.step2Title', {
                      days: clearingDays,
                      defaultValue: `${clearingDays}-Day Quality & Audit Window`,
                    })}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-clox-mute">
              {clearingDays === 0
                ? t('finance.carrier.step2InstantDesc', {
                    defaultValue:
                      'With 0-day clearing enabled, earnings clear immediately upon delivery confirmation for rapid payout.',
                  })
                : t('finance.carrier.step2Desc', {
                    days: clearingDays,
                    defaultValue: `Funds are held for ${clearingDays} days to reconcile automated Gate B mass checks, waiting time detention timers, and sender confirmation.`,
                  })}
            </p>
          </div>

          <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-clox-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                3
              </span>
              <span>{t('finance.carrier.step3Title', { defaultValue: 'Automatic Bank Disbursement' })}</span>
            </div>
            <p className="mt-1.5 text-xs text-clox-mute">
              {t('finance.carrier.step3Desc', {
                defaultValue:
                  'Cleared funds are transferred straight into your verified bank account via Stripe Connect with zero manual invoicing.',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Interactive Chart: Earnings by Trip ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <InteractiveChart
          title={t('finance.carrier.chartTitle', { defaultValue: 'Net Earnings per Shipment' })}
          subtitle={t('finance.carrier.chartSubtitle', {
            percent: carrierPercent,
            defaultValue: `Recent completed full-load freight payouts (${carrierPercent}% carrier share)`,
          })}
          items={tripChartItems}
          defaultVisual="bar"
          allowedVisuals={['bar', 'line']}
          valuePrefix={CURRENCY_SYMBOL}
          formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
        />
      </div>

      {/* ─── Trip Earnings Ledger Table ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex items-center justify-between border-b border-clox-border-soft pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-clox-ink">
              {t('finance.carrier.ledgerTitle', { defaultValue: 'Trip Earnings Ledger' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('finance.carrier.ledgerSubtitle', {
                defaultValue: 'Individual trip payouts, gross rates, and clearing status',
              })}
            </p>
          </div>
          <Link
            to="/assignments"
            className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <span>{t('finance.carrier.viewAllAssignments', { defaultValue: 'View All Assignments' })}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clox-border-soft text-[11px] font-semibold uppercase tracking-wider text-clox-mute">
                <th className="pb-3 pr-4">{t('finance.carrier.trip', { defaultValue: 'Trip / Shipment' })}</th>
                <th className="pb-3 pr-4">{t('finance.carrier.completedDate', { defaultValue: 'Completed Date' })}</th>
                <th className="pb-3 pr-4 text-right">{t('finance.carrier.grossFreight', { defaultValue: 'Gross Freight' })}</th>
                <th className="pb-3 pr-4 text-right font-bold text-blue-700">
                  {t('finance.carrier.netShareHeader', {
                    percent: carrierPercent,
                    defaultValue: `Net ${carrierPercent}% Share`,
                  })}
                </th>
                <th className="pb-3 text-right">{t('finance.carrier.status', { defaultValue: 'Settlement Status' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clox-border-soft">
              {!data?.tripLedger || data.tripLedger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-clox-mute">
                    {t('finance.carrier.noTrips', { defaultValue: 'No completed trips found for the selected period.' })}
                  </td>
                </tr>
              ) : (
                data.tripLedger.map((row) => (
                  <tr key={row.tripId} className="transition hover:bg-clox-surface-alt/40">
                    <td className="py-3.5 pr-4 font-semibold text-clox-ink">
                      <div>{row.jobTitle}</div>
                      <div className="text-[10px] font-normal text-clox-mute">ID: {row.jobId}</div>
                    </td>
                    <td className="py-3.5 pr-4 text-clox-mute">
                      {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : t('common.active', { defaultValue: 'Active' })}
                    </td>
                    <td className="py-3.5 pr-4 text-right text-clox-ink">
                      {formatDollars(row.grossFareCents)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-bold text-blue-700">
                      {formatDollars(row.carrierNetCents)}
                    </td>
                    <td className="py-3.5 text-right">
                      {row.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('finance.carrier.cleared', { defaultValue: 'Cleared' })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Clock className="h-3 w-3" />
                          {clearingDays === 0
                            ? t('finance.carrier.inInstantHold', { defaultValue: 'Payout Processing' })
                            : t('finance.carrier.inHold', {
                                days: clearingDays,
                                defaultValue: `In ${clearingDays}-Day Hold`,
                              })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Stripe Direct Bank Transfers ─── */}
      {data?.recentTransfers && data.recentTransfers.length > 0 ? (
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
          <div className="border-b border-clox-border-soft pb-4">
            <h2 className="font-display text-lg font-bold text-clox-ink">
              {t('finance.carrier.bankTransfers', { defaultValue: 'Bank Transfers' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('finance.carrier.bankTransfersSub', {
                defaultValue: 'Automated payouts transferred directly to your nominated bank account via Stripe Connect',
              })}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-clox-border-soft text-[11px] font-semibold uppercase tracking-wider text-clox-mute">
                  <th className="pb-3 pr-4">{t('finance.carrier.transferDate', { defaultValue: 'Transfer Date' })}</th>
                  <th className="pb-3 pr-4">{t('finance.carrier.reference', { defaultValue: 'Reference' })}</th>
                  <th className="pb-3 pr-4">{t('finance.carrier.stripeTransferId', { defaultValue: 'Stripe Transfer ID' })}</th>
                  <th className="pb-3 text-right">{t('finance.carrier.amountDisbursed', { defaultValue: 'Amount Disbursed' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border-soft">
                {data.recentTransfers.map((tx) => (
                  <tr key={tx.id} className="transition hover:bg-clox-surface-alt/40">
                    <td className="py-3 pr-4 text-clox-mute">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-clox-ink">{tx.id}</td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-clox-mute">
                      {tx.stripeTransferId || 'Automatic Batch'}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-700">
                      {formatDollars(tx.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
