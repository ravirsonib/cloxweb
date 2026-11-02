import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
  Scale,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { LoadingBlock } from '@/components/status-blocks';
import {
  AnimatedNumber,
  Button,
  InteractiveChart,
  Notice,
  type ChartDataItem,
} from '@/components/ui';
import { getErrorDetail, getSuperFinance } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CURRENCY_SYMBOL, formatCompactDollars, formatDollars } from '@/lib/currency';
import { AdminRole, type FinanceQuery } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type PeriodOption = 'today' | 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all' | 'custom';

export function FinancePage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const [period, setPeriod] = useState<PeriodOption>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustomDates, setAppliedCustomDates] = useState<{ from?: string; to?: string }>({});
  const [leaderboardTab, setLeaderboardTab] = useState<'senders' | 'carriers'>('senders');

  const query: FinanceQuery = useMemo(() => {
    if (period === 'custom') {
      return {
        from: appliedCustomDates.from || undefined,
        to: appliedCustomDates.to || undefined,
      };
    }
    return {
      period: period === '30d' ? '30d' : period,
    };
  }, [period, appliedCustomDates]);

  const financeQuery = useQuery({
    queryKey: ['settlements', 'finance', 'super', query],
    queryFn: ({ signal }) => getSuperFinance(query, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (financeQuery.isLoading) return <LoadingBlock label={t('finance.loading', { defaultValue: 'Loading finance & settlements…' })} />;

  const data = financeQuery.data;

  // Chart 1: Revenue Timeline (GMV vs Clox Revenue)
  const timelineGmvItems: ChartDataItem[] =
    data?.timeline?.map((item, idx) => ({
      id: `gmv-${item.date}-${idx}`,
      label: item.label,
      value: Math.round(item.gmvCents / 100),
      color: '#f97316', // Orange
    })) ?? [];

  // Chart 2: Surcharges Breakdown by Kind
  const surchargesItems: ChartDataItem[] = data?.surcharges
    ? [
        {
          id: 'sur-mass-paid',
          label: t('finance.surcharges.massPaid', { defaultValue: 'Mass Check (Paid)' }),
          value: Math.round(data.surcharges.byKind.mass.paidCents / 100),
          color: '#0284c7', // Blue
        },
        {
          id: 'sur-mass-pending',
          label: t('finance.surcharges.massPending', { defaultValue: 'Mass Check (Pending)' }),
          value: Math.round(
            (data.surcharges.byKind.mass.amountCents - data.surcharges.byKind.mass.paidCents) / 100,
          ),
          color: '#38bdf8', // Light Blue
        },
        {
          id: 'sur-wait-paid',
          label: t('finance.surcharges.waitPaid', { defaultValue: 'Detention Wait (Paid)' }),
          value: Math.round(data.surcharges.byKind.waiting.paidCents / 100),
          color: '#ea580c', // Orange
        },
        {
          id: 'sur-wait-pending',
          label: t('finance.surcharges.waitPending', { defaultValue: 'Detention Wait (Pending)' }),
          value: Math.round(
            (data.surcharges.byKind.waiting.amountCents - data.surcharges.byKind.waiting.paidCents) / 100,
          ),
          color: '#fb923c', // Light Orange
        },
      ]
    : [];

  // Chart 3: 70/30 Revenue Split Distribution
  const splitItems: ChartDataItem[] = data?.summary
    ? [
        {
          id: 'split-carrier',
          label: t('finance.charts.splitCarrier', { defaultValue: 'Carriers (70%)' }),
          value: Math.round(data.summary.carrierPayoutsCents / 100),
          color: '#2563eb', // Royal Blue
        },
        {
          id: 'split-hq',
          label: t('finance.charts.splitHq', { defaultValue: 'Clox Platform HQ (15%)' }),
          value: Math.round(data.summary.hqShareCents / 100),
          color: '#f97316', // Primary Orange
        },
        {
          id: 'split-state',
          label: t('finance.charts.splitState', { defaultValue: 'State Masters (10%)' }),
          value: Math.round(data.summary.stateCommissionsCents / 100),
          color: '#0284c7', // Sky Blue
        },
        {
          id: 'split-local',
          label: t('finance.charts.splitLocal', { defaultValue: 'Local BDEs (5%)' }),
          value: Math.round(data.summary.localCommissionsCents / 100),
          color: '#fb923c', // Light Orange
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {t('finance.title', { defaultValue: 'Finance & Settlements' })}
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('finance.liveLedger', { defaultValue: 'Live Ledger' })}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-clox-mute">
            {t('finance.subtitle', {
              defaultValue:
                'National GMV, Clox net platform margins, carrier disbursement pipeline, partner commissions, and surcharges.',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/revenue-split"
            className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Scale className="h-3.5 w-3.5" />
            {t('nav.revenueSplit', { defaultValue: 'Revenue Split Policy' })}
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void financeQuery.refetch()}
            disabled={financeQuery.isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', financeQuery.isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ─── Period Filter Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-3 shadow-clox-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: '30d', label: 'Last 30 Days' },
              { key: 'quarter', label: 'This Quarter' },
              { key: 'year', label: 'This Year' },
              { key: 'all', label: 'All Time' },
              { key: 'custom', label: 'Custom' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={cn(
                'rounded-clox-sm px-3 py-1.5 text-xs font-semibold transition-all',
                period === opt.key
                  ? 'bg-clox-orange text-white shadow-sm'
                  : 'text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink',
              )}
            >
              {t(`finance.periods.${opt.key}`, { defaultValue: opt.label })}
            </button>
          ))}
        </div>

        {period === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="clox-field-control py-1 text-xs"
            />
            <span className="text-xs text-clox-mute">{t('finance.to', { defaultValue: 'to' })}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="clox-field-control py-1 text-xs"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setAppliedCustomDates({ from: customFrom, to: customTo })}
            >
              {t('finance.apply', { defaultValue: 'Apply' })}
            </Button>
          </div>
        ) : null}
      </div>

      {financeQuery.isError ? (
        <Notice tone="error">{getErrorDetail(financeQuery.error)}</Notice>
      ) : null}

      {/* ─── Master KPI Cards (Top Row) ─── */}
      {data?.summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Gross Marketplace Volume (GMV) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.kpi.gmv', { defaultValue: 'Gross Freight Volume (GMV)' })}
              </span>
              <div className="rounded-full bg-orange-50 p-2 text-clox-orange">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.gmvCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.kpi.gmvSub', {
                  count: data.summary.completedJobsCount,
                  defaultValue: `${data.summary.completedJobsCount} deliveries completed`,
                })}
              </span>
              <span className="font-semibold text-emerald-700">
                {t('finance.kpi.gmvTag', { defaultValue: '100% upfront' })}
              </span>
            </div>
          </div>

          {/* 2. Clox Platform Net Profit (15% HQ + Holdings) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.kpi.platformRevenue', { defaultValue: 'Clox Platform Profit' })}
              </span>
              <div className="rounded-full bg-sky-50 p-2 text-sky-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-sky-900 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.platformRevenueCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.kpi.platformRevenueSub', {
                  percent: data.summary.netMarginPercent,
                  defaultValue: `Margin: ${data.summary.netMarginPercent}%`,
                })}
              </span>
              <span className="font-semibold text-clox-orange">
                HQ {formatCompactDollars(data.summary.hqShareCents)}
                {data.summary.hqHoldingCents > 0
                  ? ` + Hold ${formatCompactDollars(data.summary.hqHoldingCents)}`
                  : ''}
              </span>
            </div>
          </div>

          {/* 3. Carrier Disbursements (70%) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.kpi.carrierOutflows', { defaultValue: 'Carrier Outflows (70%)' })}
              </span>
              <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.carrierPayoutsCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.carrier.paidOut', { defaultValue: 'Paid' })}: {formatCompactDollars(data.summary.carrierPaidCents)}
              </span>
              <span className="font-semibold text-amber-700">
                {t('finance.carrier.inHold', { defaultValue: 'Clearing' })}: {formatCompactDollars(data.summary.carrierPendingCents)}
              </span>
            </div>
          </div>

          {/* 4. Partner Commissions (15%) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.kpi.partnerCommissions', { defaultValue: 'Partner Commissions (15%)' })}
              </span>
              <div className="rounded-full bg-purple-50 p-2 text-purple-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.partnerCommissionsCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>State (10%): {formatCompactDollars(data.summary.stateCommissionsCents)}</span>
              <span>Local (5%): {formatCompactDollars(data.summary.localCommissionsCents)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Cashflow Pipeline Status Banner ─── */}
      {data?.cashflowPipeline ? (
        <div className="grid grid-cols-2 gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1 sm:grid-cols-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-clox-mute">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>{t('finance.pipeline.escrow', { defaultValue: 'In Escrow (Transit)' })}</span>
            </div>
            <div className="font-display text-lg font-bold text-clox-ink">
              {formatDollars(data.cashflowPipeline.escrowCents)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-clox-mute">
              <CreditCard className="h-3.5 w-3.5 text-sky-500" />
              <span>{t('finance.pipeline.clearing', { defaultValue: '7-Day Clearing Hold' })}</span>
            </div>
            <div className="font-display text-lg font-bold text-sky-900">
              {formatDollars(data.cashflowPipeline.clearingCents)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-clox-mute">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t('finance.pipeline.disbursed', { defaultValue: 'Disbursed to Bank' })}</span>
            </div>
            <div className="font-display text-lg font-bold text-emerald-800">
              {formatDollars(data.cashflowPipeline.disbursedCents)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-clox-mute">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              <span>{t('finance.pipeline.refunds', { defaultValue: 'Refunds & Adjustments' })}</span>
            </div>
            <div className="font-display text-lg font-bold text-rose-700">
              {formatDollars(data.cashflowPipeline.refundedCents)}
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Interactive Charts Row (Orange & Blue Theme) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: GMV Timeline Trend */}
        <InteractiveChart
          title={t('finance.charts.gmvTrendTitle', { defaultValue: 'Gross Freight Volume (GMV) Trend' })}
          subtitle={t('finance.charts.gmvTrendSubtitle', {
            defaultValue: 'Timeline throughput of gross freight booked across the marketplace',
          })}
          items={timelineGmvItems}
          defaultVisual="area"
          allowedVisuals={['area', 'line', 'bar']}
          valuePrefix={CURRENCY_SYMBOL}
          formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
        />

        {/* Chart 2: 70/30 Revenue Split Allocation */}
        <InteractiveChart
          title={t('finance.charts.splitTitle', { defaultValue: 'Revenue Split Allocation' })}
          subtitle={t('finance.charts.splitSubtitle', {
            defaultValue: 'Fixed 70% Carrier share vs 30% Platform pool (HQ 15%, State 10%, Local 5%)',
          })}
          items={splitItems}
          defaultVisual="pie"
          allowedVisuals={['pie', 'bar', 'line']}
          valuePrefix={CURRENCY_SYMBOL}
          formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
        />
      </div>

      {/* ─── Surcharges Intelligence Section ─── */}
      {data?.surcharges ? (
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border-soft pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-clox-ink">
                {t('finance.surcharges.title', { defaultValue: 'Surcharges Intelligence & Gate Audits' })}
              </h2>
              <p className="mt-0.5 text-xs text-clox-mute">
                {t('finance.surcharges.subtitle', {
                  defaultValue: 'Mass discrepancy at Gate B checks vs Waiting detention timers at pickup/drop-off',
                })}
              </p>
            </div>
            <Link
              to="/surcharges"
              className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              <span>{t('finance.surcharges.manage', { defaultValue: 'Manage Surcharges' })}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Surcharges Chart */}
            <div className="lg:col-span-2">
              <InteractiveChart
                title={t('finance.charts.surchargesTitle', { defaultValue: 'Surcharges Breakdown by Gate Type' })}
                subtitle={t('finance.charts.surchargesSubtitle', { defaultValue: 'Paid vs Pending collections' })}
                items={surchargesItems}
                defaultVisual="bar"
                allowedVisuals={['bar', 'pie']}
                valuePrefix={CURRENCY_SYMBOL}
                formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
              />
            </div>

            {/* Surcharges Summary Stats */}
            <div className="flex flex-col justify-between space-y-4 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('finance.surcharges.collectionRates', { defaultValue: 'Collection Rates' })}
                </span>
                <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                  <span className="text-clox-mute">
                    {t('finance.surcharges.totalIncurred', { defaultValue: 'Total Incurred' })}
                  </span>
                  <span className="font-bold text-clox-ink">
                    {formatDollars(data.surcharges.totalAmountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('finance.surcharges.paidCleared', { defaultValue: 'Paid & Cleared' })}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatDollars(data.surcharges.paidAmountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <Clock className="h-3.5 w-3.5" />
                    {t('finance.surcharges.pendingPayment', { defaultValue: 'Pending Payment' })}
                  </span>
                  <span className="font-bold text-amber-700">
                    {formatDollars(data.surcharges.pendingAmountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-clox-faint">
                    {t('finance.surcharges.waivedAdmin', { defaultValue: 'Waived by Admin' })}
                  </span>
                  <span className="font-medium text-clox-faint">
                    {formatDollars(data.surcharges.waivedAmountCents)}
                  </span>
                </div>
              </div>

              <div className="rounded bg-sky-50 p-3 text-xs text-sky-900 ring-1 ring-sky-200">
                <p className="font-semibold">
                  {t('finance.surcharges.gateBNoticeTitle', { defaultValue: 'Automatic Gate B Enforcement' })}
                </p>
                <p className="mt-1 text-sky-800">
                  {t('finance.surcharges.gateBNoticeDesc', {
                    defaultValue:
                      'When actual scale weight exceeds declared weight, a mass surcharge is issued instantly via Stripe before trip start.',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Company Performance Leaderboard ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border-soft pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-clox-ink">
              {t('finance.leaderboard.title', { defaultValue: 'Company Financial Matrix & Leaderboard' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('finance.leaderboard.subtitle', {
                defaultValue: 'Ranking by freight expenditure (Senders) and net earnings (Carriers)',
              })}
            </p>
          </div>

          <div className="inline-flex rounded-clox-sm border border-clox-border bg-clox-surface p-0.5">
            <button
              type="button"
              onClick={() => setLeaderboardTab('senders')}
              className={cn(
                'rounded-[5px] px-3 py-1.5 text-xs font-semibold transition',
                leaderboardTab === 'senders'
                  ? 'bg-clox-navy-ink text-white'
                  : 'text-clox-mute hover:text-clox-ink',
              )}
            >
              {t('finance.leaderboard.topSenders', { defaultValue: 'Top Senders (Spend)' })}
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardTab('carriers')}
              className={cn(
                'rounded-[5px] px-3 py-1.5 text-xs font-semibold transition',
                leaderboardTab === 'carriers'
                  ? 'bg-clox-navy-ink text-white'
                  : 'text-clox-mute hover:text-clox-ink',
              )}
            >
              {t('finance.leaderboard.topCarriers', { defaultValue: 'Top Carriers (Earnings)' })}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {leaderboardTab === 'senders' ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                  <th className="pb-3 font-medium">{t('finance.leaderboard.rank', { defaultValue: 'Rank' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.senderOrg', { defaultValue: 'Sender Organization' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.jobs', { defaultValue: 'Deliveries' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.grossSpend', { defaultValue: 'Freight Spend (Gross)' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.surcharges', { defaultValue: 'Surcharges' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.avgSpend', { defaultValue: 'Average Spend' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border-soft">
                {data?.companies?.topSenders?.length ? (
                  data.companies.topSenders.map((s, idx) => {
                    const avgSpend = s.jobsCount > 0 ? Math.round(s.spendCents / s.jobsCount) : 0;
                    return (
                      <tr key={s.id} className="hover:bg-clox-surface-alt/50 transition">
                        <td className="py-3 font-bold text-clox-mute">#{idx + 1}</td>
                        <td className="py-3 font-semibold text-clox-ink">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-clox-orange shrink-0" />
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-clox-mute">{s.jobsCount} {t('finance.leaderboard.jobs', { defaultValue: 'jobs' })}</td>
                        <td className="py-3 font-bold text-clox-ink">{formatDollars(s.spendCents)}</td>
                        <td className="py-3 text-clox-mute">{formatDollars(s.surchargesCents)}</td>
                        <td className="py-3 text-xs text-clox-faint">{formatDollars(avgSpend)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-clox-faint">
                      {t('finance.leaderboard.noSenders', { defaultValue: 'No sender spending recorded for this period.' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                  <th className="pb-3 font-medium">{t('finance.leaderboard.rank', { defaultValue: 'Rank' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.carrierOrg', { defaultValue: 'Transport Carrier' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.trips', { defaultValue: 'Completed Trips' })}</th>
                  <th className="pb-3 font-medium">{t('finance.leaderboard.netEarned', { defaultValue: 'Net Earnings (70%)' })}</th>
                  <th className="pb-3 font-medium">{t('finance.carrier.paidOut', { defaultValue: 'Paid via Stripe' })}</th>
                  <th className="pb-3 font-medium">{t('finance.carrier.clearingHold', { defaultValue: '7-Day Clearing' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border-soft">
                {data?.companies?.topCarriers?.length ? (
                  data.companies.topCarriers.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-clox-surface-alt/50 transition">
                      <td className="py-3 font-bold text-clox-mute">#{idx + 1}</td>
                      <td className="py-3 font-semibold text-clox-ink">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-clox-mute">{c.tripsCount} {t('finance.leaderboard.trips', { defaultValue: 'trips' })}</td>
                      <td className="py-3 font-bold text-clox-ink">{formatDollars(c.earningsCents)}</td>
                      <td className="py-3 font-medium text-emerald-700">
                        {formatDollars(c.paidCents)}
                      </td>
                      <td className="py-3 text-amber-700 font-medium">
                        {formatDollars(c.clearingCents)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-clox-faint">
                      {t('finance.leaderboard.noCarriers', { defaultValue: 'No carrier payouts recorded for this period.' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── State & Regional Performance Matrix ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <h2 className="font-display text-lg font-bold text-clox-ink">
          {t('finance.regional.title', { defaultValue: 'State & Regional Performance Matrix' })}
        </h2>
        <p className="mt-0.5 text-xs text-clox-mute">
          {t('finance.regional.subtitle', {
            defaultValue: 'Gross volume, platform net margin, and regional partner shares by origin state',
          })}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                <th className="pb-3 font-medium">{t('finance.regional.stateCode', { defaultValue: 'State Code' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.state', { defaultValue: 'Region Name' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.jobs', { defaultValue: 'Deliveries' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.gmv', { defaultValue: 'Gross Freight (GMV)' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.platformShare', { defaultValue: 'Platform HQ Share' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.stateShare', { defaultValue: 'State Master (10%)' })}</th>
                <th className="pb-3 font-medium">{t('finance.regional.localShare', { defaultValue: 'Local BDE (5%)' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clox-border-soft">
              {data?.regionalBreakdown?.length ? (
                data.regionalBreakdown.map((reg) => (
                  <tr key={reg.regionCode} className="hover:bg-clox-surface-alt/50 transition">
                    <td className="py-3">
                      <span className="rounded bg-clox-surface-alt px-2.5 py-1 font-mono text-xs font-bold text-clox-ink">
                        {reg.regionCode}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-clox-ink">{reg.regionName}</td>
                    <td className="py-3 text-clox-mute">{reg.jobsCount}</td>
                    <td className="py-3 font-bold text-clox-ink">{formatDollars(reg.gmvCents)}</td>
                    <td className="py-3 font-semibold text-sky-900">
                      {formatDollars(reg.platformRevenueCents)}
                    </td>
                    <td className="py-3 text-clox-mute">{formatDollars(reg.stateShareCents)}</td>
                    <td className="py-3 text-clox-mute">{formatDollars(reg.localShareCents)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-clox-faint">
                    {t('finance.regional.empty', { defaultValue: 'No regional data recorded.' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
