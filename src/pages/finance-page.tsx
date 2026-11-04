import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Play,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { LoadingBlock } from '@/components/status-blocks';
import {
  AnimatedNumber,
  Button,
  InteractiveChart,
  Notice,
  StatusPill,
  useToast,
  type ChartDataItem,
} from '@/components/ui';
import {
  getActiveSettlementCycle,
  getErrorDetail,
  getReconciliationReport,
  getSettlementCycleDetail,
  getSuperFinance,
  listSettlementCycles,
  runSettlementDisbursement,
  type RunDisbursementResult,
  type SettlementCycleStatus,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { CURRENCY_SYMBOL, formatCompactDollars, formatDollars } from '@/lib/currency';
import { formatDate, formatDateTime } from '@/lib/datetime';
import { AdminRole, type FinanceQuery } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type PeriodOption = 'today' | 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all' | 'custom';
type MainTab = 'overview' | 'cycles' | 'reconciliation';

export function FinancePage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [period, setPeriod] = useState<PeriodOption>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustomDates, setAppliedCustomDates] = useState<{ from?: string; to?: string }>({});
  const [leaderboardTab, setLeaderboardTab] = useState<'senders' | 'carriers'>('senders');

  // Cycles state
  const [cyclesPage, setCyclesPage] = useState(1);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [runNotes, setRunNotes] = useState('');
  const [lastRunResult, setLastRunResult] = useState<RunDisbursementResult | null>(null);

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

  // Query 1: Super Finance Global
  const financeQuery = useQuery({
    queryKey: ['settlements', 'finance', 'super', query],
    queryFn: ({ signal }) => getSuperFinance(query, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  // Query 2: Fortnightly Settlement Cycles
  const cyclesQuery = useQuery({
    queryKey: ['settlements', 'cycles', cyclesPage],
    queryFn: ({ signal }) => listSettlementCycles({ page: cyclesPage, limit: 10 }, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN && mainTab === 'cycles',
  });

  // Query 3: Active Open Cycle
  const activeCycleQuery = useQuery({
    queryKey: ['settlements', 'cycles', 'active'],
    queryFn: ({ signal }) => getActiveSettlementCycle({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN && mainTab === 'cycles',
  });

  // Query 4: Daily Reconciliation Report
  const reconcileQuery = useQuery({
    queryKey: ['settlements', 'reconcile'],
    queryFn: ({ signal }) => getReconciliationReport(undefined, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN && mainTab === 'reconciliation',
  });

  // Query 5: Selected Cycle Detail
  const cycleDetailQuery = useQuery({
    queryKey: ['settlements', 'cycles', selectedCycleId],
    queryFn: ({ signal }) => getSettlementCycleDetail(selectedCycleId!, { signal }),
    enabled: Boolean(selectedCycleId),
  });

  // Mutation: Run Disbursement
  const runMutation = useMutation({
    mutationFn: (payload: { cycleId?: string; dryRun?: boolean; notes?: string }) =>
      runSettlementDisbursement(payload),
    onSuccess: (res) => {
      setLastRunResult(res);
      if (!res.dryRun) {
        toast.success(
          `Disbursement completed: $${((res.totalDisbursedCents ?? 0) / 100).toFixed(2)} AUD across ${res.lineCount} lines.`,
          'Cycle Disbursed',
        );
        void queryClient.invalidateQueries({ queryKey: ['settlements'] });
      } else {
        toast.info(
          `Dry run preview: $${(res.totalAccruedCents / 100).toFixed(2)} AUD eligible across ${res.lineCount} lines.`,
          'Dry Run Simulated',
        );
      }
    },
    onError: (err) => {
      toast.error(getErrorDetail(err), 'Disbursement Failed');
    },
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (financeQuery.isLoading && mainTab === 'overview') {
    return <LoadingBlock label={t('finance.loading', { defaultValue: 'Loading finance & settlements…' })} />;
  }

  const data = financeQuery.data;

  // Chart 1: Revenue Timeline (GMV vs Clox Revenue)
  const timelineGmvItems: ChartDataItem[] =
    data?.timeline?.map((item, idx) => ({
      id: `gmv-${item.date}-${idx}`,
      label: item.label,
      value: Math.round(item.gmvCents / 100),
      color: '#f97316',
    })) ?? [];

  // Chart 2: Surcharges Breakdown by Kind
  const surchargesItems: ChartDataItem[] = data?.surcharges
    ? [
        {
          id: 'sur-mass-paid',
          label: t('finance.surcharges.massPaid', { defaultValue: 'Mass Check (Paid)' }),
          value: Math.round(data.surcharges.byKind.mass.paidCents / 100),
          color: '#0284c7',
        },
        {
          id: 'sur-mass-pending',
          label: t('finance.surcharges.massPending', { defaultValue: 'Mass Check (Pending)' }),
          value: Math.round(
            (data.surcharges.byKind.mass.amountCents - data.surcharges.byKind.mass.paidCents) / 100,
          ),
          color: '#38bdf8',
        },
        {
          id: 'sur-wait-paid',
          label: t('finance.surcharges.waitPaid', { defaultValue: 'Detention Wait (Paid)' }),
          value: Math.round(data.surcharges.byKind.waiting.paidCents / 100),
          color: '#ea580c',
        },
        {
          id: 'sur-wait-pending',
          label: t('finance.surcharges.waitPending', { defaultValue: 'Detention Wait (Pending)' }),
          value: Math.round(
            (data.surcharges.byKind.waiting.amountCents - data.surcharges.byKind.waiting.paidCents) / 100,
          ),
          color: '#fb923c',
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
          color: '#2563eb',
        },
        {
          id: 'split-hq',
          label: t('finance.charts.splitHq', { defaultValue: 'Clox Platform HQ (15%)' }),
          value: Math.round(data.summary.hqShareCents / 100),
          color: '#f97316',
        },
        {
          id: 'split-state',
          label: t('finance.charts.splitState', { defaultValue: 'State Masters (10%)' }),
          value: Math.round(data.summary.stateCommissionsCents / 100),
          color: '#0284c7',
        },
        {
          id: 'split-local',
          label: t('finance.charts.splitLocal', { defaultValue: 'Local BDEs (5%)' }),
          value: Math.round(data.summary.localCommissionsCents / 100),
          color: '#fb923c',
        },
      ]
    : [];

  const getCycleStatusTone = (status: SettlementCycleStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'ok';
      case 'PROCESSING':
        return 'warn';
      case 'FAILED':
        return 'danger';
      case 'OPEN':
      default:
        return 'info';
    }
  };

  const getDiscrepancySeverityTone = (sev: 'CRITICAL' | 'WARN' | 'INFO') => {
    switch (sev) {
      case 'CRITICAL':
        return 'danger';
      case 'WARN':
        return 'warn';
      case 'INFO':
      default:
        return 'info';
    }
  };

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
                'National GMV, automated settlement disbursement cycles, carrier 7-day clearing pipeline, partner commissions, and daily reconciliation.',
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
            onClick={() => {
              void financeQuery.refetch();
              if (mainTab === 'cycles') {
                void cyclesQuery.refetch();
                void activeCycleQuery.refetch();
              }
              if (mainTab === 'reconciliation') {
                void reconcileQuery.refetch();
              }
            }}
            disabled={financeQuery.isFetching || cyclesQuery.isFetching || reconcileQuery.isFetching}
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5',
                (financeQuery.isFetching || cyclesQuery.isFetching || reconcileQuery.isFetching) &&
                  'animate-spin',
              )}
            />
          </Button>
        </div>
      </div>

      {/* ─── Main Sub-Navigation Tabs ─── */}
      <div className="flex border-b border-clox-border pb-px">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setMainTab('overview')}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition',
              mainTab === 'overview'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:border-clox-border hover:text-clox-ink',
            )}
          >
            <TrendingUp className="h-4 w-4" />
            <span>{t('finance.tabs.overview', { defaultValue: 'Overview & Matrix' })}</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('cycles')}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition',
              mainTab === 'cycles'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:border-clox-border hover:text-clox-ink',
            )}
          >
            <Clock className="h-4 w-4" />
            <span>{t('finance.tabs.cycles', { defaultValue: 'Settlement Cycles & Disbursement' })}</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('reconciliation')}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition',
              mainTab === 'reconciliation'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:border-clox-border hover:text-clox-ink',
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{t('finance.tabs.reconciliation', { defaultValue: 'Daily Ledger Reconciliation' })}</span>
          </button>
        </nav>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & MATRIX
          ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'overview' ? (
        <div className="space-y-6">
          {/* Period Filter Bar */}
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

          {/* Master KPI Cards */}
          {data?.summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. Gross Freight Volume (GMV) */}
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

              {/* 2. Clox Platform Net Profit */}
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

              {/* 3. Carrier Disbursements */}
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

              {/* 4. Partner Commissions */}
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

          {/* Cashflow Pipeline Status Banner */}
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

          {/* Interactive Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

          {/* Surcharges Section */}
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

                <div className="flex flex-col justify-between space-y-4 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                      {t('finance.surcharges.collectionRates', { defaultValue: 'Collection Rates' })}
                    </span>
                    <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                      <span className="text-clox-mute">{t('finance.surcharges.totalIncurred', { defaultValue: 'Total Incurred' })}</span>
                      <span className="font-bold text-clox-ink">{formatDollars(data.surcharges.totalAmountCents)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('finance.surcharges.paidCleared', { defaultValue: 'Paid & Cleared' })}
                      </span>
                      <span className="font-bold text-emerald-700">{formatDollars(data.surcharges.paidAmountCents)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-clox-border-soft pb-2 text-sm">
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {t('finance.surcharges.pendingPayment', { defaultValue: 'Pending Payment' })}
                      </span>
                      <span className="font-bold text-amber-700">{formatDollars(data.surcharges.pendingAmountCents)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-clox-faint">{t('finance.surcharges.waivedAdmin', { defaultValue: 'Waived by Admin' })}</span>
                      <span className="font-medium text-clox-faint">{formatDollars(data.surcharges.waivedAmountCents)}</span>
                    </div>
                  </div>

                  <div className="rounded bg-sky-50 p-3 text-xs text-sky-900 ring-1 ring-sky-200">
                    <p className="font-semibold">{t('finance.surcharges.gateBNoticeTitle', { defaultValue: 'Automatic Gate B Enforcement' })}</p>
                    <p className="mt-1 text-sky-800">
                      {t('finance.surcharges.gateBNoticeDesc', {
                        defaultValue: 'When actual scale weight exceeds declared weight, a mass surcharge is issued instantly via Stripe before trip start.',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Company Matrix Leaderboard */}
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
                    leaderboardTab === 'senders' ? 'bg-clox-navy-ink text-white' : 'text-clox-mute hover:text-clox-ink',
                  )}
                >
                  {t('finance.leaderboard.topSenders', { defaultValue: 'Top Senders (Spend)' })}
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('carriers')}
                  className={cn(
                    'rounded-[5px] px-3 py-1.5 text-xs font-semibold transition',
                    leaderboardTab === 'carriers' ? 'bg-clox-navy-ink text-white' : 'text-clox-mute hover:text-clox-ink',
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
                          <td className="py-3 font-medium text-emerald-700">{formatDollars(c.paidCents)}</td>
                          <td className="py-3 text-amber-700 font-medium">{formatDollars(c.clearingCents)}</td>
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

          {/* Regional Performance Matrix */}
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
                        <td className="py-3 font-semibold text-sky-900">{formatDollars(reg.platformRevenueCents)}</td>
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
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: FORTNIGHTLY CYCLES & DISBURSEMENT
          ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'cycles' ? (
        <div className="space-y-6">
          {/* Active Open Cycle Card */}
          {activeCycleQuery.data ? (
            <div className="rounded-clox-md border border-clox-border bg-gradient-to-r from-clox-surface via-clox-surface to-orange-50/30 p-6 shadow-clox-1">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border-soft pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-orange-100 p-3 text-clox-orange">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-clox-orange uppercase">Active Rolling Cycle</span>
                      <StatusPill tone="info">{activeCycleQuery.data.status}</StatusPill>
                    </div>
                    <h2 className="font-display text-xl font-bold text-clox-ink">
                      {activeCycleQuery.data.cycleNumber}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setIsDryRun(true);
                      setLastRunResult(null);
                      setRunModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Run Disbursement Engine</span>
                  </Button>
                </div>
              </div>

              {/* Cycle Metrics Grid */}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-clox-sm bg-clox-surface-alt/50 p-3">
                  <span className="text-xs text-clox-mute">Cycle Window</span>
                  <div className="mt-1 font-semibold text-clox-ink text-xs">
                    {formatDate(activeCycleQuery.data.periodStart)} – {formatDate(activeCycleQuery.data.periodEnd)}
                  </div>
                </div>
                <div className="rounded-clox-sm bg-clox-surface-alt/50 p-3">
                  <span className="text-xs text-clox-mute">Scheduled 4th Night</span>
                  <div className="mt-1 font-semibold text-sky-900 text-xs">
                    {formatDateTime(activeCycleQuery.data.scheduledDisburseAt)}
                  </div>
                </div>
                <div className="rounded-clox-sm bg-clox-surface-alt/50 p-3">
                  <span className="text-xs text-clox-mute">Total Accrued</span>
                  <div className="mt-1 font-display text-base font-bold text-clox-ink">
                    {formatDollars(activeCycleQuery.data.totalAccruedCents)}
                  </div>
                </div>
                <div className="rounded-clox-sm bg-clox-surface-alt/50 p-3">
                  <span className="text-xs text-clox-mute">Carrier Payout (70%)</span>
                  <div className="mt-1 font-display text-base font-bold text-blue-700">
                    {formatDollars(activeCycleQuery.data.carrierPayoutCents)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-clox-mute border-t border-clox-border-soft pt-3">
                <div className="flex items-center gap-4">
                  <span>State/Local Admin Commissions: <strong className="text-clox-ink">{formatDollars(activeCycleQuery.data.adminPayoutCents)}</strong></span>
                  <span>Vacant Holding Ledger: <strong className="text-clox-orange">{formatDollars(activeCycleQuery.data.hqHoldingCents)}</strong></span>
                </div>
                <span>Lines ready for clearing: <strong>{activeCycleQuery.data.lineCount}</strong></span>
              </div>
            </div>
          ) : activeCycleQuery.isLoading ? (
            <LoadingBlock label="Finding active rolling cycle…" />
          ) : null}

          {/* Historical Settlement Cycles Table */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border-soft pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-clox-ink">
                  Fortnightly Settlement Cycles History
                </h3>
                <p className="mt-0.5 text-xs text-clox-mute">
                  All 14-day rolling disbursement runs, aggregate line items, and Stripe transfer outcomes.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void cyclesQuery.refetch()}
                disabled={cyclesQuery.isFetching}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', cyclesQuery.isFetching && 'animate-spin')} />
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                    <th className="pb-3 font-medium">Cycle Number</th>
                    <th className="pb-3 font-medium">Period Window</th>
                    <th className="pb-3 font-medium">Scheduled Payout</th>
                    <th className="pb-3 font-medium">Accrued / Disbursed</th>
                    <th className="pb-3 font-medium">Carrier (70%)</th>
                    <th className="pb-3 font-medium">Partner (15%)</th>
                    <th className="pb-3 font-medium">HQ Holding</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clox-border-soft">
                  {cyclesQuery.data?.items?.length ? (
                    cyclesQuery.data.items.map((c) => (
                      <tr key={c.id} className="hover:bg-clox-surface-alt/50 transition">
                        <td className="py-3 font-mono font-bold text-xs text-clox-ink">
                          {c.cycleNumber}
                        </td>
                        <td className="py-3 text-xs text-clox-mute">
                          {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                        </td>
                        <td className="py-3 text-xs text-clox-mute">
                          {formatDateTime(c.scheduledDisburseAt)}
                        </td>
                        <td className="py-3 font-bold text-clox-ink">
                          {c.status === 'COMPLETED'
                            ? formatDollars(c.totalDisbursedCents)
                            : formatDollars(c.totalAccruedCents)}
                        </td>
                        <td className="py-3 font-medium text-blue-700">
                          {formatDollars(c.carrierPayoutCents)}
                        </td>
                        <td className="py-3 text-clox-mute">
                          {formatDollars(c.adminPayoutCents)}
                        </td>
                        <td className="py-3 text-xs text-clox-orange">
                          {formatDollars(c.hqHoldingCents)}
                        </td>
                        <td className="py-3">
                          <StatusPill tone={getCycleStatusTone(c.status)}>
                            {c.status}
                          </StatusPill>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedCycleId(c.id)}
                            className="inline-flex items-center gap-1 text-xs"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Lines</span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-sm text-clox-faint">
                        {cyclesQuery.isLoading
                          ? 'Loading settlement cycles…'
                          : 'No settlement cycles found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {cyclesQuery.data && cyclesQuery.data.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between border-t border-clox-border-soft pt-3">
                <span className="text-xs text-clox-mute">
                  Page {cyclesQuery.data.page} of {cyclesQuery.data.totalPages} ({cyclesQuery.data.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={cyclesPage <= 1}
                    onClick={() => setCyclesPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={cyclesPage >= cyclesQuery.data.totalPages}
                    onClick={() => setCyclesPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: DAILY LEDGER RECONCILIATION
          ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'reconciliation' ? (
        <div className="space-y-6">
          {reconcileQuery.data ? (
            <>
              {/* Reconciliation Status Health Banner */}
              <div
                className={cn(
                  'rounded-clox-md border p-6 shadow-clox-1 flex flex-wrap items-center justify-between gap-4',
                  reconcileQuery.data.status === 'HEALTHY'
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                    : reconcileQuery.data.status === 'WARNING'
                    ? 'border-amber-200 bg-amber-50/60 text-amber-950'
                    : 'border-rose-200 bg-rose-50/60 text-rose-950',
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'rounded-full p-3',
                      reconcileQuery.data.status === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-700'
                        : reconcileQuery.data.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700',
                    )}
                  >
                    {reconcileQuery.data.status === 'HEALTHY' ? (
                      <CheckCircle2 className="h-7 w-7" />
                    ) : reconcileQuery.data.status === 'WARNING' ? (
                      <AlertTriangle className="h-7 w-7" />
                    ) : (
                      <AlertOctagon className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">
                        Reconciliation Status
                      </span>
                      <StatusPill
                        tone={
                          reconcileQuery.data.status === 'HEALTHY'
                            ? 'ok'
                            : reconcileQuery.data.status === 'WARNING'
                            ? 'warn'
                            : 'danger'
                        }
                      >
                        {reconcileQuery.data.status}
                      </StatusPill>
                    </div>
                    <h2 className="mt-1 font-display text-xl font-bold">
                      {reconcileQuery.data.status === 'HEALTHY'
                        ? 'Stripe Escrow & Internal Ledger in 100% Balance'
                        : reconcileQuery.data.status === 'WARNING'
                        ? 'Ledger Warnings or Delayed Transfers Detected'
                        : 'Critical Discrepancies Detected Across Settlement Lines'}
                    </h2>
                    <p className="mt-1 text-xs opacity-80">
                      Generated at {formatDateTime(reconcileQuery.data.generatedAt)} across period{' '}
                      {formatDate(reconcileQuery.data.period.from)} to {formatDate(reconcileQuery.data.period.to)}.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void reconcileQuery.refetch()}
                  disabled={reconcileQuery.isFetching}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', reconcileQuery.isFetching && 'animate-spin')} />
                </Button>
              </div>

              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">Marketplace GMV</span>
                  <div className="mt-1 font-display text-lg font-bold text-clox-ink">
                    {formatDollars(reconcileQuery.data.metrics.totalGmvCents)}
                  </div>
                </div>
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">Stripe Collected</span>
                  <div className="mt-1 font-display text-lg font-bold text-emerald-800">
                    {formatDollars(reconcileQuery.data.metrics.totalCollectedCents)}
                  </div>
                </div>
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">Disbursed Funds</span>
                  <div className="mt-1 font-display text-lg font-bold text-sky-900">
                    {formatDollars(reconcileQuery.data.metrics.totalDisbursedCents)}
                  </div>
                </div>
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">7-Day Clearing Hold</span>
                  <div className="mt-1 font-display text-lg font-bold text-amber-700">
                    {formatDollars(reconcileQuery.data.metrics.totalPendingClearingCents)}
                  </div>
                </div>
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">HQ Vacant Holding</span>
                  <div className="mt-1 font-display text-lg font-bold text-clox-orange">
                    {formatDollars(reconcileQuery.data.metrics.totalHqHoldingCents)}
                  </div>
                </div>
                <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
                  <span className="text-xs font-medium text-clox-mute">Audit Discrepancies</span>
                  <div className="mt-1 font-display text-lg font-bold text-rose-700">
                    {reconcileQuery.data.metrics.discrepancyCount}
                  </div>
                </div>
              </div>

              {/* Discrepancies List */}
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
                <div className="flex items-center justify-between border-b border-clox-border-soft pb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-clox-ink">
                      Audit Discrepancies & Ledger Anomalies
                    </h3>
                    <p className="mt-0.5 text-xs text-clox-mute">
                      Automated 3-pillar checks: Stripe charges vs Job fares, clearing period limits, and surcharge spike volatility (&gt;20%).
                    </p>
                  </div>
                  <span className="rounded-full bg-clox-surface-alt px-3 py-1 text-xs font-bold text-clox-ink">
                    {reconcileQuery.data.discrepancies.length} issues
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {reconcileQuery.data.discrepancies.length > 0 ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                          <th className="pb-3 font-medium">Severity</th>
                          <th className="pb-3 font-medium">Anomaly Kind</th>
                          <th className="pb-3 font-medium">Entity Type</th>
                          <th className="pb-3 font-medium">Entity ID</th>
                          <th className="pb-3 font-medium">Variance (AUD)</th>
                          <th className="pb-3 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-clox-border-soft">
                        {reconcileQuery.data.discrepancies.map((d) => (
                          <tr key={d.id} className="hover:bg-clox-surface-alt/50 transition">
                            <td className="py-3">
                              <StatusPill tone={getDiscrepancySeverityTone(d.severity)}>
                                {d.severity}
                              </StatusPill>
                            </td>
                            <td className="py-3 font-mono text-xs font-semibold text-clox-ink">
                              {d.kind}
                            </td>
                            <td className="py-3 text-xs text-clox-mute">{d.entityType}</td>
                            <td className="py-3 font-mono text-xs text-clox-faint">
                              {d.entityId.slice(0, 8)}…
                            </td>
                            <td className="py-3 text-xs">
                              {d.expectedCents !== undefined && d.actualCents !== undefined ? (
                                <div className="space-y-0.5">
                                  <div>Exp: {formatDollars(d.expectedCents)}</div>
                                  <div className="font-bold text-rose-700">Act: {formatDollars(d.actualCents)}</div>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 text-xs text-clox-mute max-w-md">{d.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-clox-ink">
                        Zero Discrepancies Detected
                      </h4>
                      <p className="mt-1 text-xs text-clox-mute">
                        All platform gross volume, carrier 70% accruals, partner shares, and Stripe payment transfers reconcile perfectly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : reconcileQuery.isLoading ? (
            <LoadingBlock label="Executing automated ledger reconciliation cross-checks…" />
          ) : reconcileQuery.isError ? (
            <Notice tone="error">{getErrorDetail(reconcileQuery.error)}</Notice>
          ) : null}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: RUN DISBURSEMENT ENGINE
          ═══════════════════════════════════════════════════════════════════════ */}
      {runModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-clox-lg border border-clox-border bg-clox-surface p-6 shadow-clox-3">
            <div className="flex items-center justify-between border-b border-clox-border-soft pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-orange-100 p-2 text-clox-orange">
                  <Play className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-clox-ink">
                    Fortnightly Settlement Disbursement Engine
                  </h3>
                  <p className="text-xs text-clox-mute">
                    Executes automated sweeps of eligible accrued carrier and partner lines.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRunModalOpen(false)}
                className="text-clox-mute hover:text-clox-ink transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Dry Run Toggle */}
              <div className="flex items-start gap-3 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-3">
                <input
                  type="checkbox"
                  id="dryRunCheck"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-clox-border text-clox-orange focus:ring-clox-orange"
                />
                <label htmlFor="dryRunCheck" className="text-xs text-clox-ink cursor-pointer">
                  <strong className="block font-semibold">Dry Run Mode (Simulate Only)</strong>
                  <span className="text-clox-mute">
                    Calculate eligible amounts, line counts, and allocations without calling Stripe Transfers or mutating ledger statuses.
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-clox-ink mb-1">
                  Disbursement Run Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="e.g. Fortnightly cycle 2026-11 run after 4th night"
                  className="clox-field-control w-full text-xs"
                />
              </div>

              {/* Simulation / Result Summary */}
              {lastRunResult ? (
                <div
                  className={cn(
                    'rounded-clox-sm border p-4 text-xs space-y-2',
                    lastRunResult.dryRun
                      ? 'border-sky-200 bg-sky-50 text-sky-950'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-950',
                  )}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {lastRunResult.dryRun ? 'Dry Run Simulation Result' : 'Disbursement Run Succeeded'}
                    </span>
                    <StatusPill tone={lastRunResult.dryRun ? 'info' : 'ok'}>
                      {lastRunResult.dryRun ? 'SIMULATED' : 'LIVE EXECUTED'}
                    </StatusPill>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-clox-border-soft">
                    <div>
                      Cycle: <strong>{lastRunResult.cycleNumber}</strong>
                    </div>
                    <div>
                      Lines Matched: <strong>{lastRunResult.lineCount}</strong>
                    </div>
                    <div>
                      Carrier 70% Payout: <strong>{formatDollars(lastRunResult.carrierPayoutCents)}</strong>
                    </div>
                    <div>
                      Admin 15% Payout: <strong>{formatDollars(lastRunResult.adminPayoutCents)}</strong>
                    </div>
                    <div>
                      HQ Holding Ledger: <strong>{formatDollars(lastRunResult.hqHoldingCents)}</strong>
                    </div>
                    <div>
                      Total {lastRunResult.dryRun ? 'Eligible' : 'Disbursed'}:{' '}
                      <strong className="font-bold">
                        {formatDollars(
                          lastRunResult.dryRun
                            ? lastRunResult.totalAccruedCents
                            : lastRunResult.totalDisbursedCents ?? lastRunResult.totalAccruedCents,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}

              {runMutation.isError ? (
                <Notice tone="error">{getErrorDetail(runMutation.error)}</Notice>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-clox-border-soft pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRunModalOpen(false)}
              >
                Close
              </Button>
              {isDryRun ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => runMutation.mutate({ dryRun: true, notes: runNotes })}
                  disabled={runMutation.isPending}
                >
                  {runMutation.isPending ? 'Simulating…' : 'Simulate Dry Run'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => runMutation.mutate({ dryRun: false, notes: runNotes })}
                  disabled={runMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {runMutation.isPending ? 'Executing Transfers…' : 'Confirm & Execute Live Disbursement'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CYCLE LINE ITEMS DETAIL
          ═══════════════════════════════════════════════════════════════════════ */}
      {selectedCycleId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-clox-lg border border-clox-border bg-clox-surface p-6 shadow-clox-3">
            <div className="flex items-center justify-between border-b border-clox-border-soft pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-clox-ink">
                  Cycle Details & Settlement Lines
                </h3>
                {cycleDetailQuery.data ? (
                  <p className="text-xs text-clox-mute">
                    {cycleDetailQuery.data.cycleNumber} ({cycleDetailQuery.data.settlementLines.length} lines)
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCycleId(null)}
                className="text-clox-mute hover:text-clox-ink transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
              {cycleDetailQuery.isLoading ? (
                <LoadingBlock label="Loading cycle lines…" />
              ) : cycleDetailQuery.isError ? (
                <Notice tone="error">{getErrorDetail(cycleDetailQuery.error)}</Notice>
              ) : cycleDetailQuery.data ? (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-clox-sm bg-clox-surface-alt/40 p-3 text-xs">
                    <div>
                      <span className="text-clox-mute">Status:</span>{' '}
                      <StatusPill tone={getCycleStatusTone(cycleDetailQuery.data.status)}>
                        {cycleDetailQuery.data.status}
                      </StatusPill>
                    </div>
                    <div>
                      <span className="text-clox-mute">Carrier Payout:</span>{' '}
                      <strong>{formatDollars(cycleDetailQuery.data.carrierPayoutCents)}</strong>
                    </div>
                    <div>
                      <span className="text-clox-mute">Admin Partners:</span>{' '}
                      <strong>{formatDollars(cycleDetailQuery.data.adminPayoutCents)}</strong>
                    </div>
                    <div>
                      <span className="text-clox-mute">HQ Holding:</span>{' '}
                      <strong className="text-clox-orange">{formatDollars(cycleDetailQuery.data.hqHoldingCents)}</strong>
                    </div>
                  </div>

                  {/* Lines table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-clox-border-soft text-clox-mute">
                          <th className="pb-2 font-medium">Job Title</th>
                          <th className="pb-2 font-medium">Recipient Type</th>
                          <th className="pb-2 font-medium">Recipient Name</th>
                          <th className="pb-2 font-medium">Gross Fare</th>
                          <th className="pb-2 font-medium">Share %</th>
                          <th className="pb-2 font-medium">Disbursed Amount</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-clox-border-soft">
                        {cycleDetailQuery.data.settlementLines.length > 0 ? (
                          cycleDetailQuery.data.settlementLines.map((line) => {
                            const recipientName =
                              line.recipientType === 'CARRIER_COMPANY'
                                ? line.job.assignment?.carrierCompany?.legalName ?? 'Carrier Company'
                                : line.recipientType === 'ADMIN_PARTNER'
                                ? line.adminUser?.name ?? line.adminUser?.email ?? 'Admin Partner'
                                : 'Clox HQ Platform Holding';

                            return (
                              <tr key={line.id} className="hover:bg-clox-surface-alt/40 transition">
                                <td className="py-2.5 font-medium text-clox-ink max-w-xs truncate">
                                  {line.job.title}
                                </td>
                                <td className="py-2.5 font-mono text-clox-mute">
                                  {line.recipientType}
                                </td>
                                <td className="py-2.5 text-clox-ink font-semibold">
                                  {recipientName}
                                </td>
                                <td className="py-2.5 text-clox-mute">
                                  {formatDollars(line.grossFareCents)}
                                </td>
                                <td className="py-2.5 font-mono">
                                  {line.sharePercent}%
                                </td>
                                <td className="py-2.5 font-bold text-clox-ink">
                                  {formatDollars(line.amountCents)}
                                </td>
                                <td className="py-2.5">
                                  <StatusPill
                                    tone={
                                      line.status === 'PAID'
                                        ? 'ok'
                                        : line.status === 'PAYABLE'
                                        ? 'info'
                                        : 'neutral'
                                    }
                                  >
                                    {line.status}
                                  </StatusPill>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-clox-faint">
                              No settlement lines recorded for this cycle yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end border-t border-clox-border-soft pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCycleId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
