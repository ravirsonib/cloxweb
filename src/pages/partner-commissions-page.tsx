import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Handshake,
  MapPin,
  RefreshCw,
  Send,
  TrendingUp,
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
import { getErrorDetail, getPartnerFinance } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CURRENCY_SYMBOL, formatDollars } from '@/lib/currency';
import { AdminRole, type FinanceQuery } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type PeriodOption = 'today' | 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all';

export function PartnerCommissionsPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);

  const [period, setPeriod] = useState<PeriodOption>('month');

  const queryParams: FinanceQuery = useMemo(() => {
    return { period };
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['partner-finance', queryParams],
    queryFn: ({ signal }) => getPartnerFinance(queryParams, { signal }),
  });

  const isState = data?.role === 'STATE_MASTER' || role === AdminRole.STATE_MASTER;
  const sharePercent = isState ? 10 : 5;

  // Chart data: Commission payouts
  const commissionChartItems: ChartDataItem[] = useMemo(() => {
    if (!data?.recentSettlements || data.recentSettlements.length === 0) {
      return [
        { id: 'c1', label: 'Shipment 1', value: 120 },
        { id: 'c2', label: 'Shipment 2', value: 195 },
        { id: 'c3', label: 'Shipment 3', value: 160 },
      ];
    }
    return data.recentSettlements.slice(0, 10).map((s, idx) => ({
      id: s.id || `settlement-${idx}`,
      label: s.jobTitle.length > 18 ? `${s.jobTitle.substring(0, 18)}…` : s.jobTitle,
      value: Math.round(s.amountCents / 100),
    }));
  }, [data?.recentSettlements]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Header & Controls ─── */}
      <div className="flex flex-col gap-4 border-b border-clox-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                isState
                  ? 'bg-purple-50 text-purple-700 ring-purple-700/20'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-700/20',
              )}
            >
              <Handshake className="h-3.5 w-3.5" />
              <span>
                {isState
                  ? t('finance.partner.stateBadge', { defaultValue: 'State Master (10% Commission)' })
                  : t('finance.partner.localBadge', { defaultValue: 'Local BDE (5% Commission)' })}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-clox-surface-alt px-2.5 py-0.5 text-xs font-medium text-clox-mute">
              <MapPin className="h-3.5 w-3.5 text-clox-orange" />
              <span>{data?.scopeLabel || t('finance.partner.territoryScope', { defaultValue: 'Territory Scope' })}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-clox-surface-alt px-2.5 py-0.5 text-xs font-medium text-clox-mute">
              <span>{data?.adminName || displayName || t('finance.partner.partner', { defaultValue: 'Partner' })}</span>
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-clox-ink sm:text-3xl">
            {t('finance.partner.title', { defaultValue: 'My Commissions & Earnings' })}
          </h1>
          <p className="mt-0.5 text-xs text-clox-mute sm:text-sm">
            {t('finance.partner.subtitle', {
              defaultValue:
                'Automatic revenue share on all shipments originating in your territory and Book of Business referrals',
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

      {/* Error Notice */}
      {isError ? (
        <Notice
          tone="error"
          title={t('finance.errorTitle', { defaultValue: 'Unable to load commission data' })}
        >
          {getErrorDetail(error)}
        </Notice>
      ) : null}

      {/* Loading Block */}
      {isLoading ? (
        <LoadingBlock
          label={t('finance.loading', { defaultValue: 'Calculating territory commissions...' })}
        />
      ) : null}

      {/* ─── 4 KPI Metrics Row ─── */}
      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Attributed Territory GMV */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.partner.territoryGross', { defaultValue: 'Territory Gross Volume' })}
              </span>
              <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.attributedGmvCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.partner.territoryGrossSub', {
                  count: data.summary.completedJobsCount,
                  defaultValue: `${data.summary.completedJobsCount} shipments booked`,
                })}
              </span>
              <span className="font-semibold text-blue-700">
                {t('finance.partner.grossFreightTag', { defaultValue: 'Gross Freight' })}
              </span>
            </div>
          </div>

          {/* 2. Total Commission Accrued */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.partner.totalAccrued', {
                  percent: sharePercent,
                  defaultValue: `Total Accrued (${sharePercent}%)`,
                })}
              </span>
              <div className="rounded-full bg-purple-50 p-2 text-purple-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-purple-800 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.grossCommissionCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.partner.totalAccruedSub', { defaultValue: 'Earned commission' })}</span>
              <span className="font-semibold text-purple-700">
                {t('finance.partner.netPoolTag', {
                  percent: sharePercent,
                  defaultValue: `${sharePercent}% Net Pool`,
                })}
              </span>
            </div>
          </div>

          {/* 3. Settled / Paid Out */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.partner.settledBank', { defaultValue: 'Settled to Bank' })}
              </span>
              <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-emerald-800 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.settledCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.partner.settledBankSub', { defaultValue: 'Transferred' })}</span>
              <span className="font-semibold text-emerald-700">
                {t('finance.carrier.finalized', { defaultValue: 'Finalized' })}
              </span>
            </div>
          </div>

          {/* 4. Active In-Flight Jobs */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.partner.inFlight', { defaultValue: 'In-Flight Freight' })}
              </span>
              <div className="rounded-full bg-sky-50 p-2 text-sky-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={data.summary.activeJobsCount}
                formatter={(v) => v.toString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.partner.inFlightSub', { defaultValue: 'Currently in transit' })}</span>
              <span className="font-semibold text-sky-700">
                {t('finance.partner.accruingOnPod', { defaultValue: 'Accruing on POD' })}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Book of Business (BoB) Referral Banner ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border-soft pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-clox-ink">
              {t('finance.partner.bobTitle', { defaultValue: 'Book of Business (BoB) Portfolio' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('finance.partner.bobSubtitle', {
                defaultValue:
                  'Earn ongoing referral commissions for every sender and carrier onboarded through your invite links',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ops/growth"
              className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              <span>{t('finance.partner.growthPipeline', { defaultValue: 'Growth Pipeline' })}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/ops/growth/invite"
              className="clox-btn clox-btn-primary inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t('finance.partner.inviteCompany', { defaultValue: 'Invite Company' })}</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
            <div className="rounded-full bg-orange-50 p-3 text-clox-orange">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-clox-mute">
                {t('finance.partner.referredSenders', { defaultValue: 'Referred Senders' })}
              </div>
              <div className="font-display text-2xl font-bold text-clox-ink">
                {data?.bookOfBusiness.sendersCount || 0}
              </div>
              <div className="text-[11px] text-clox-mute">
                {t('finance.partner.referredSendersSub', { defaultValue: 'Active freight booking accounts' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-clox-mute">
                {t('finance.partner.referredCarriers', { defaultValue: 'Referred Carriers' })}
              </div>
              <div className="font-display text-2xl font-bold text-clox-ink">
                {data?.bookOfBusiness.carriersCount || 0}
              </div>
              <div className="text-[11px] text-clox-mute">
                {t('finance.partner.referredCarriersSub', { defaultValue: 'Verified transport operators' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Interactive Chart: Commission Timeline ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <InteractiveChart
          title={t('finance.partner.chartTitle', { defaultValue: 'Commission Accruals by Shipment' })}
          subtitle={t('finance.partner.chartSubtitle', {
            defaultValue: 'Recent earnings credited from originating shipments',
          })}
          items={commissionChartItems}
          defaultVisual="bar"
          allowedVisuals={['bar', 'line']}
          valuePrefix={CURRENCY_SYMBOL}
          formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
        />
      </div>

      {/* ─── Commission Settlements Ledger Table ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="border-b border-clox-border-soft pb-4">
          <h2 className="font-display text-lg font-bold text-clox-ink">
            {t('finance.partner.ledgerTitle', { defaultValue: 'Commission Settlements Ledger' })}
          </h2>
          <p className="mt-0.5 text-xs text-clox-mute">
            {t('finance.partner.ledgerSubtitle', {
              defaultValue: 'Individual shipment shares, share percentages, and settlement payout status',
            })}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clox-border-soft text-[11px] font-semibold uppercase tracking-wider text-clox-mute">
                <th className="pb-3 pr-4">{t('finance.partner.shipment', { defaultValue: 'Shipment' })}</th>
                <th className="pb-3 pr-4">{t('finance.partner.creditedDate', { defaultValue: 'Credited Date' })}</th>
                <th className="pb-3 pr-4 text-center">{t('finance.partner.sharePercent', { defaultValue: 'Share %' })}</th>
                <th className="pb-3 pr-4 text-right font-bold text-purple-700">{t('finance.partner.commission', { defaultValue: 'Commission' })}</th>
                <th className="pb-3 text-right">{t('finance.partner.status', { defaultValue: 'Status' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clox-border-soft">
              {!data?.recentSettlements || data.recentSettlements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-clox-mute">
                    {t('finance.partner.noSettlements', { defaultValue: 'No commission settlement lines found for the selected period.' })}
                  </td>
                </tr>
              ) : (
                data.recentSettlements.map((row) => (
                  <tr key={row.id} className="transition hover:bg-clox-surface-alt/40">
                    <td className="py-3.5 pr-4 font-semibold text-clox-ink">
                      <div>{row.jobTitle}</div>
                      <div className="text-[10px] font-normal text-clox-mute">
                        Ref: {row.id}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-clox-mute">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 pr-4 text-center font-semibold text-clox-ink">
                      {row.sharePercent}%
                    </td>
                    <td className="py-3.5 pr-4 text-right font-bold text-purple-700">
                      {formatDollars(row.amountCents)}
                    </td>
                    <td className="py-3.5 text-right">
                      {row.status === 'SETTLED' || row.paidAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('finance.partner.settled', { defaultValue: 'Settled' })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Clock className="h-3 w-3" />
                          {t('finance.partner.accrued', { defaultValue: 'Accrued' })}
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
    </div>
  );
}
