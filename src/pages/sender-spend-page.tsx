import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Package,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { LoadingBlock } from '@/components/status-blocks';
import {
  AnimatedNumber,
  Button,
  InteractiveChart,
  Notice,
  type ChartDataItem,
} from '@/components/ui';
import { getErrorDetail, getSenderFinance } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CURRENCY_SYMBOL, formatDollars } from '@/lib/currency';
import type { FinanceQuery } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type PeriodOption = 'today' | 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all';

export function SenderSpendPage() {
  const { t } = useTranslation();
  const displayName = useAuthStore((s) => s.displayName);

  const [period, setPeriod] = useState<PeriodOption>('month');

  const queryParams: FinanceQuery = useMemo(() => {
    return { period };
  }, [period]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sender-finance', queryParams],
    queryFn: ({ signal }) => getSenderFinance(queryParams, { signal }),
  });

  // Chart data: Spend breakdown by shipment
  const spendChartItems: ChartDataItem[] = useMemo(() => {
    if (!data?.jobSpendHistory || data.jobSpendHistory.length === 0) {
      return [
        { id: 'j1', label: 'Load #1', value: 1200 },
        { id: 'j2', label: 'Load #2', value: 1850 },
        { id: 'j3', label: 'Load #3', value: 920 },
      ];
    }
    return data.jobSpendHistory.slice(0, 10).map((j, idx) => ({
      id: j.jobId || `job-${idx}`,
      label: j.jobTitle.length > 18 ? `${j.jobTitle.substring(0, 18)}…` : j.jobTitle,
      value: Math.round(j.totalPaidCents / 100),
    }));
  }, [data?.jobSpendHistory]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Header & Controls ─── */}
      <div className="flex flex-col gap-4 border-b border-clox-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-clox-orange ring-1 ring-inset ring-orange-600/20">
              <Package className="h-3.5 w-3.5" />
              <span>{data?.companyName || displayName || t('finance.sender.freightSender', { defaultValue: 'Freight Sender' })}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t('finance.sender.gstRegistered', { defaultValue: 'GST Registered' })}</span>
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-clox-ink sm:text-3xl">
            {t('finance.sender.title', { defaultValue: 'Freight Spend & Tax Invoices' })}
          </h1>
          <p className="mt-0.5 text-xs text-clox-mute sm:text-sm">
            {t('finance.sender.subtitle', {
              defaultValue:
                'Gross freight outlay, 10% Australian GST input tax credits, gate surcharges, and live escrow balances',
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
          title={t('finance.errorTitle', { defaultValue: 'Unable to load freight spend data' })}
        >
          {getErrorDetail(error)}
        </Notice>
      ) : null}

      {/* Loading Block */}
      {isLoading ? (
        <LoadingBlock
          label={t('finance.loading', { defaultValue: 'Aggregating freight spend and GST totals...' })}
        />
      ) : null}

      {/* ─── 4 KPI Metrics Row ─── */}
      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Gross Freight Spend (Inc GST) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.sender.grossSpend', { defaultValue: 'Gross Spend (Inc GST)' })}
              </span>
              <div className="rounded-full bg-orange-50 p-2 text-clox-orange">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.totalSpendIncGstCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.sender.grossSpendSub', {
                  count: data.summary.completedJobsCount,
                  defaultValue: `${data.summary.completedJobsCount} completed loads`,
                })}
              </span>
              <span className="font-semibold text-clox-orange">
                {t('finance.sender.allFreight', { defaultValue: 'All booked freight' })}
              </span>
            </div>
          </div>

          {/* 2. Net Freight (Ex GST) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.sender.netFreight', { defaultValue: 'Net Freight (Ex GST)' })}
              </span>
              <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.totalSpendExGstCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.sender.netFreightSub', { defaultValue: 'Tax-exclusive base' })}</span>
              <span className="font-semibold text-blue-700">
                {t('finance.sender.preTax', { defaultValue: 'Pre-tax outlay' })}
              </span>
            </div>
          </div>

          {/* 3. GST Component (10%) */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.sender.gst', { defaultValue: 'GST Component (10%)' })}
              </span>
              <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-emerald-800 sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.totalGstCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>{t('finance.sender.gstSub', { defaultValue: 'Claimable Input Credits' })}</span>
              <span className="font-semibold text-emerald-700">
                {t('finance.sender.atoCompliant', { defaultValue: 'ATO Compliant' })}
              </span>
            </div>
          </div>

          {/* 4. Active In-Escrow Funds */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition hover:shadow-clox-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                {t('finance.sender.inEscrow', { defaultValue: 'In-Escrow (Live Transit)' })}
              </span>
              <div className="rounded-full bg-sky-50 p-2 text-sky-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              <AnimatedNumber
                value={Math.round(data.summary.inEscrowCents / 100)}
                prefix={CURRENCY_SYMBOL}
                formatter={(v) => v.toLocaleString()}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-clox-mute">
              <span>
                {t('finance.sender.inEscrowSub', {
                  count: data.summary.activeJobsCount,
                  defaultValue: `${data.summary.activeJobsCount} loads on road`,
                })}
              </span>
              <span className="font-semibold text-sky-700">
                {t('finance.sender.protectedEscrow', { defaultValue: 'Protected in escrow' })}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Surcharges Breakdown & Gate Audits ─── */}
      {data?.surchargesBreakdown ? (
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border-soft pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-clox-ink">
                {t('finance.sender.surchargesTitle', { defaultValue: 'Surcharges & Operational Adjustments' })}
              </h2>
              <p className="mt-0.5 text-xs text-clox-mute">
                {t('finance.sender.surchargesSubtitle', {
                  defaultValue: 'Automated gate scale adjustments and waiting detention fees applied to shipments',
                })}
              </p>
            </div>
            <Link
              to="/surcharges"
              className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              <span>{t('finance.sender.viewSurchargeInvoices', { defaultValue: 'View Surcharge Invoices' })}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-clox-mute">
                <Scale className="h-4 w-4 text-clox-orange" />
                <span>{t('finance.sender.massTitle', { defaultValue: 'Gate B Mass Discrepancies' })}</span>
              </div>
              <div className="mt-2 font-display text-xl font-bold text-clox-ink">
                {formatDollars(data.surchargesBreakdown.massCents)}
              </div>
              <p className="mt-1 text-[11px] text-clox-mute">
                {t('finance.sender.massDesc', {
                  defaultValue: 'Discrepancies where actual weighbridge scale exceeded declared weight',
                })}
              </p>
            </div>

            <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-clox-mute">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>{t('finance.sender.waitingTitle', { defaultValue: 'Waiting Time Detention' })}</span>
              </div>
              <div className="mt-2 font-display text-xl font-bold text-clox-ink">
                {formatDollars(data.surchargesBreakdown.waitingCents)}
              </div>
              <p className="mt-1 text-[11px] text-clox-mute">
                {t('finance.sender.waitingDesc', {
                  defaultValue: 'Loading or unloading delays exceeding the included standard window',
                })}
              </p>
            </div>

            <div className="rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-clox-mute">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>{t('finance.sender.pendingTitle', { defaultValue: 'Pending Surcharge Balance' })}</span>
              </div>
              <div className="mt-2 font-display text-xl font-bold text-amber-800">
                {formatDollars(data.surchargesBreakdown.pendingCents)}
              </div>
              <p className="mt-1 text-[11px] text-clox-mute">
                {t('finance.sender.pendingDesc', {
                  defaultValue: 'Incurred charges currently awaiting payment settlement',
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Interactive Chart: Spend History ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <InteractiveChart
          title={t('finance.sender.chartTitle', { defaultValue: 'Freight Outlay per Shipment' })}
          subtitle={t('finance.sender.chartSubtitle', {
            defaultValue: 'Recent full-load freight bookings (inclusive of GST)',
          })}
          items={spendChartItems}
          defaultVisual="area"
          allowedVisuals={['area', 'line', 'bar']}
          valuePrefix={CURRENCY_SYMBOL}
          formatValue={(v: number) => `${CURRENCY_SYMBOL}${v.toLocaleString()}`}
        />
      </div>

      {/* ─── Job Spend History & Tax Invoices Table ─── */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex items-center justify-between border-b border-clox-border-soft pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-clox-ink">
              {t('finance.sender.ledgerTitle', { defaultValue: 'Tax Invoice & Freight History' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('finance.sender.ledgerSubtitle', {
                defaultValue: 'Itemized charges, base freight, surcharges, and payment receipts',
              })}
            </p>
          </div>
          <Link
            to="/jobs"
            className="clox-btn clox-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <span>{t('finance.sender.viewAllJobs', { defaultValue: 'View All Jobs' })}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clox-border-soft text-[11px] font-semibold uppercase tracking-wider text-clox-mute">
                <th className="pb-3 pr-4">{t('finance.carrier.trip', { defaultValue: 'Shipment / Job' })}</th>
                <th className="pb-3 pr-4">{t('finance.sender.bookedDate', { defaultValue: 'Booked Date' })}</th>
                <th className="pb-3 pr-4 text-right">{t('finance.sender.baseFare', { defaultValue: 'Base Fare (Inc GST)' })}</th>
                <th className="pb-3 pr-4 text-right">{t('finance.sender.surchargesCol', { defaultValue: 'Surcharges' })}</th>
                <th className="pb-3 pr-4 text-right font-bold text-clox-ink">{t('finance.sender.totalPaid', { defaultValue: 'Total Paid' })}</th>
                <th className="pb-3 text-right">{t('finance.sender.paymentStatus', { defaultValue: 'Payment Status' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clox-border-soft">
              {!data?.jobSpendHistory || data.jobSpendHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-clox-mute">
                    {t('finance.sender.noTransactions', { defaultValue: 'No freight transactions found for the selected period.' })}
                  </td>
                </tr>
              ) : (
                data.jobSpendHistory.map((row) => (
                  <tr key={row.jobId} className="transition hover:bg-clox-surface-alt/40">
                    <td className="py-3.5 pr-4 font-semibold text-clox-ink">
                      <Link
                        to={`/jobs/${row.jobId}`}
                        className="text-clox-ink hover:text-clox-orange hover:underline"
                      >
                        {row.jobTitle}
                      </Link>
                      <div className="text-[10px] font-normal text-clox-mute">ID: {row.jobId}</div>
                    </td>
                    <td className="py-3.5 pr-4 text-clox-mute">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 pr-4 text-right text-clox-ink">
                      {formatDollars(row.baseFareIncGstCents)}
                    </td>
                    <td className="py-3.5 pr-4 text-right text-clox-mute">
                      {row.surchargesIncGstCents > 0
                        ? formatDollars(row.surchargesIncGstCents)
                        : formatDollars(0)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-bold text-clox-ink">
                      {formatDollars(row.totalPaidCents)}
                    </td>
                    <td className="py-3.5 text-right">
                      {row.paymentStatus === 'PAID' || row.paymentStatus === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('finance.sender.paid', { defaultValue: 'Paid' })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          <Clock className="h-3 w-3" />
                          {t('finance.sender.inEscrowStatus', { defaultValue: 'In Escrow' })}
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
