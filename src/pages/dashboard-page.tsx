import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  AnimatedNumber,
  DataCardList,
  DataTable,
  DistributionBars,
  InteractiveChart,
  Notice,
  ResponsiveDataView,
  Timeline,
  dataCardClassName,
  type ChartDataItem,
} from '@/components/ui';
import { getDashboardStats, getErrorDetail } from '@/lib/api';
import { formatAuditAction } from '@/lib/audit-format';
import { formatDateTime, formatLeadStatus, formatLeadType } from '@/lib/leads';
import { cn } from '@/lib/cn';
import type { AdminDashboardQuery } from '@/shared/types';

export function DashboardPage() {
  const { t } = useTranslation('common');

  // Filter state
  const [period, setPeriod] = useState<NonNullable<AdminDashboardQuery['period']>>('30d');
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showLegacyLeads, setShowLegacyLeads] = useState(false);

  const queryParams: AdminDashboardQuery = useMemo(() => {
    if (isCustomDate && customFrom) {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? new Date(customTo).toISOString() : undefined,
      };
    }
    return { period };
  }, [period, isCustomDate, customFrom, customTo]);

  const query = useQuery({
    queryKey: ['admin', 'dashboard', queryParams],
    queryFn: ({ signal }) => getDashboardStats(queryParams, { signal }),
  });

  const totals = query.data?.totals;
  const recentLeads = query.data?.recentLeads ?? [];
  const byStatus = query.data?.byStatus ?? {};
  const recentActivity = query.data?.recentActivity ?? [];
  const analytics = query.data?.analytics;

  const statusBars = Object.entries(byStatus).map(([status, count]) => ({
    id: status,
    label: formatLeadStatus(status),
    value: count,
  }));

  const activityItems = recentActivity.map((event, index) => ({
    id: event.id,
    title: formatAuditAction(event.action, t),
    subtitle: [
      event.lead?.companyName || event.lead?.email || null,
      event.actor?.email || t('system'),
      formatDateTime(event.createdAt),
    ]
      .filter(Boolean)
      .join(' · '),
    tone: (index === 0 ? 'now' : 'done') as 'now' | 'done',
  }));

  // Timeline chart data items
  const timelineChartData: ChartDataItem[] = useMemo(() => {
    if (!analytics?.timeline) return [];
    return analytics.timeline.map((pt, i) => ({
      id: `pt-${i}`,
      label: pt.label,
      value: pt.jobs,
      secondaryValue: pt.trips,
      color: '#f97316',
    }));
  }, [analytics?.timeline]);

  // Breakdown by kind chart data (Orange & Blue palette)
  const breakdownChartData: ChartDataItem[] = useMemo(() => {
    if (!analytics?.breakdowns.byKind) return [];
    const b = analytics.breakdowns.byKind;
    return [
      { id: 'breakdown', label: 'Vehicle Breakdown', value: b.breakdown, color: '#f97316' }, // Clox Orange
      { id: 'accident', label: 'Accident', value: b.accident, color: '#ea580c' }, // Deep Orange
      { id: 'traffic', label: 'Traffic Delay', value: b.traffic, color: '#0284c7' }, // Sky Blue
      { id: 'driver', label: 'Driver Unavailable', value: b.driverUnavailable, color: '#1d4ed8' }, // Navy Blue
      { id: 'other', label: 'Other', value: b.other, color: '#38bdf8' }, // Light Blue
    ];
  }, [analytics?.breakdowns.byKind]);

  // Fleet by class chart data (Orange & Blue palette)
  const fleetByClassData: ChartDataItem[] = useMemo(() => {
    if (!analytics?.trucks.byClass) return [];
    return Object.entries(analytics.trucks.byClass).map(([cls, count], idx) => {
      const colors = ['#f97316', '#0284c7', '#ea580c', '#2563eb', '#fb923c', '#1d4ed8', '#38bdf8'];
      return {
        id: cls,
        label: cls,
        value: count,
        color: colors[idx % colors.length],
      };
    });
  }, [analytics?.trucks.byClass]);

  const periods: Array<{ id: NonNullable<AdminDashboardQuery['period']>; label: string }> = [
    { id: 'today', label: t('admin.periodToday') },
    { id: 'week', label: t('admin.periodWeek') },
    { id: 'month', label: t('admin.periodMonth') },
    { id: '30d', label: t('admin.period30d') },
    { id: 'year', label: t('admin.periodYear') },
    { id: 'all', label: t('admin.periodAll') },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-clox-ink sm:text-3xl">
            {t('admin.dashboardTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-clox-mute">{t('admin.dashboardSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/companies" className="clox-btn clox-btn-secondary">
            <Building2 className="h-4 w-4" />
            {t('nav.companies')}
          </Link>
          <Link to="/admin/jobs" className="clox-btn clox-btn-secondary">
            <Package className="h-4 w-4" />
            {t('nav.adminJobs')}
          </Link>
          <Link to="/ops/exceptions" className="clox-btn clox-btn-secondary">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('nav.opsExceptions')}
          </Link>
          <Link to="/vehicle-classes" className="clox-btn clox-btn-secondary">
            <Truck className="h-4 w-4" />
            {t('nav.vehicleClasses', { defaultValue: 'Vehicle classes' })}
          </Link>
          <Link to="/ops/partners" className="clox-btn clox-btn-secondary">
            <Users className="h-4 w-4" />
            {t('nav.opsPartners')}
          </Link>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="clox-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-clox-mute">
            <Calendar className="h-3.5 w-3.5 text-clox-orange" />
            Filter Period:
          </span>
          {periods.map((p) => {
            const isActive = !isCustomDate && period === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  setIsCustomDate(false);
                  setPeriod(p.id);
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-clox-orange text-white shadow-sm'
                    : 'bg-clox-surface-alt/80 text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink',
                )}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustomDate((v) => !v)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-all duration-200',
              isCustomDate
                ? 'bg-clox-orange text-white shadow-sm'
                : 'bg-clox-surface-alt/80 text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink',
            )}
          >
            {t('admin.periodCustom')}
          </button>
        </div>

        {/* Custom Date Pickers */}
        {isCustomDate ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded border border-clox-border bg-clox-surface px-2 text-xs text-clox-ink focus:border-clox-orange focus:outline-none"
            />
            <span className="text-clox-mute">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded border border-clox-border bg-clox-surface px-2 text-xs text-clox-ink focus:border-clox-orange focus:outline-none"
            />
          </div>
        ) : (
          <div className="text-xs text-clox-mute">
            {query.isFetching ? (
              <span className="animate-pulse font-medium text-clox-orange">Updating data…</span>
            ) : (
              <span>Live Synced</span>
            )}
          </div>
        )}
      </div>

      {query.isLoading ? (
        <div className="py-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {query.isError ? (
        <Notice tone="error">{getErrorDetail(query.error)}</Notice>
      ) : null}

      {analytics ? (
        <>
          {/* Main Marketplace Operational Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Senders */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricSenders')}
                </span>
                <span className="rounded-lg bg-orange-500/10 p-2 text-clox-orange">
                  <Building2 className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.senders.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {analytics.senders.active} {t('admin.active')}
                  </span>
                  <span>·</span>
                  <span>+{analytics.senders.inPeriod} in period</span>
                </div>
              </div>
            </div>

            {/* 2. Carriers */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricCarriers')}
                </span>
                <span className="rounded-lg bg-sky-500/10 p-2 text-sky-600">
                  <Truck className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.carriers.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {analytics.carriers.active} {t('admin.active')}
                  </span>
                  <span>·</span>
                  <span>+{analytics.carriers.inPeriod} in period</span>
                </div>
              </div>
            </div>

            {/* 3. Trucks / Fleet */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricTrucks')}
                </span>
                <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <Navigation className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.trucks.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="font-semibold text-clox-orange">
                    {analytics.trucks.inTransit} {t('admin.inTransit')}
                  </span>
                  <span>·</span>
                  <span>{analytics.trucks.active} active fleet</span>
                </div>
              </div>
            </div>

            {/* 4. Drivers */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricDrivers')}
                </span>
                <span className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
                  <UserCheck className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.drivers.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="font-semibold text-purple-600">
                    {analytics.drivers.onTrip} {t('admin.onTrip')}
                  </span>
                  <span>·</span>
                  <span>{analytics.drivers.active} verified</span>
                </div>
              </div>
            </div>

            {/* 5. Marketplace Jobs */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricJobs')}
                </span>
                <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                  <Package className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.jobs.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="font-semibold text-clox-orange">
                    {analytics.jobs.active} bidding / active
                  </span>
                  <span>·</span>
                  <span>{analytics.jobs.completed} delivered</span>
                </div>
              </div>
            </div>

            {/* 6. Trips Executing */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricTrips')}
                </span>
                <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                  <Navigation className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.trips.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span className="font-semibold text-emerald-600">
                    {analytics.trips.completed} completed
                  </span>
                  <span>·</span>
                  <span>{analytics.trips.active} active now</span>
                </div>
              </div>
            </div>

            {/* 7. Breakdowns & Incidents */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricBreakdowns')}
                </span>
                <span className="rounded-lg bg-red-500/10 p-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber value={analytics.breakdowns.total} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <span
                    className={cn(
                      'font-semibold',
                      analytics.breakdowns.open > 0 ? 'text-red-600' : 'text-emerald-600',
                    )}
                  >
                    {analytics.breakdowns.open} open incidents
                  </span>
                  <span>·</span>
                  <span>{analytics.breakdowns.byKind.breakdown} vehicle breakdowns</span>
                </div>
              </div>
            </div>

            {/* 8. Receivers & Spend */}
            <div className="clox-card relative overflow-hidden p-5 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  {t('admin.metricSpend')}
                </span>
                <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="font-display text-3xl font-extrabold text-clox-ink">
                  <AnimatedNumber
                    value={Math.round(analytics.jobs.totalEstimateCents / 100)}
                    prefix="$"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                  <MapPin className="h-3.5 w-3.5 text-clox-orange" />
                  <span>{analytics.receivers.total} destination receivers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Interactive Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Chart 1: Marketplace Activity Trends */}
            <InteractiveChart
              title={t('admin.timelineTrendsTitle')}
              subtitle={t('admin.timelineTrendsSubtitle')}
              items={timelineChartData}
              defaultVisual="bar"
              allowedVisuals={['bar', 'line', 'area', 'pie']}
            />

            {/* Chart 2: Incidents & Exceptions Breakdown */}
            <InteractiveChart
              title={t('admin.exceptionsBreakdownTitle')}
              subtitle={t('admin.exceptionsBreakdownSubtitle')}
              items={breakdownChartData}
              defaultVisual="pie"
              allowedVisuals={['pie', 'bar', 'line', 'area']}
            />
          </div>

          {/* Additional Fleet Distribution Chart if fleet exists */}
          {fleetByClassData.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-1">
              <InteractiveChart
                title="Fleet Distribution by Vehicle Class"
                subtitle="Composition of active and registered fleet classes across carriers"
                items={fleetByClassData}
                defaultVisual="bar"
                allowedVisuals={['bar', 'pie', 'line', 'area']}
              />
            </div>
          ) : null}

          {/* Operational Feeds: Breakdowns / Incidents + Live Marketplace Jobs */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Incident Reports */}
            <section className="clox-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-clox-ink">
                    {t('admin.breakdownsTitle')}
                  </h2>
                  <p className="mt-0.5 text-xs text-clox-mute">
                    Live roadside breakdowns, accidents, and route exceptions
                  </p>
                </div>
                <Link
                  to="/ops/exceptions"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clox-orange hover:underline"
                >
                  View All <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {analytics.breakdowns.recent.length === 0 ? (
                <div className="mt-6">
                  <EmptyBlock
                    title="No open incidents"
                    description="All trips are proceeding safely without reported breakdown or accidents."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.breakdowns.recent.map((exc) => (
                    <div
                      key={exc.id}
                      className="flex items-start justify-between rounded-lg border border-clox-border-soft bg-clox-surface-alt/40 p-3 text-xs transition hover:bg-clox-surface-alt"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 text-[11px] font-bold uppercase',
                              exc.kind === 'VEHICLE_BREAKDOWN'
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-amber-500/10 text-amber-600',
                            )}
                          >
                            {exc.kind.replace('_', ' ')}
                          </span>
                          <span className="font-semibold text-clox-ink">{exc.companyName}</span>
                        </div>
                        {exc.note ? <p className="text-clox-mute line-clamp-1">{exc.note}</p> : null}
                        <div className="text-[11px] text-clox-faint">
                          {formatDateTime(exc.createdAt)}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-clox-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-clox-mute border border-clox-border">
                        {exc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Live Marketplace Deliveries */}
            <section className="clox-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-clox-ink">
                    {t('admin.recentJobsTitle')}
                  </h2>
                  <p className="mt-0.5 text-xs text-clox-mute">
                    Recently published, bidding, or completed loads
                  </p>
                </div>
                <Link
                  to="/admin/jobs"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clox-orange hover:underline"
                >
                  View All <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {analytics.jobs.recent.length === 0 ? (
                <div className="mt-6">
                  <EmptyBlock
                    title="No jobs published yet"
                    description="New freight shipments created by senders will appear here in real-time."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.jobs.recent.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border border-clox-border-soft bg-clox-surface-alt/40 p-3 text-xs transition hover:bg-clox-surface-alt"
                    >
                      <div className="min-w-0 pr-3">
                        <Link
                          to={`/admin/jobs/${job.id}`}
                          className="font-semibold text-clox-ink hover:text-clox-orange line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-clox-mute text-[11px]">
                          <span>{job.companyName}</span>
                          {job.receiverName ? (
                            <>
                              <span>→</span>
                              <span className="truncate max-w-[120px]">{job.receiverName}</span>
                            </>
                          ) : null}
                          <span>·</span>
                          <span>{formatDateTime(job.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-clox-ink">
                          ${(job.estimateIncGstCents / 100).toFixed(2)}
                        </div>
                        <span className="mt-0.5 inline-block rounded bg-clox-surface px-1.5 py-0.5 font-mono text-[10px] text-clox-mute border border-clox-border">
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Recent Receivers Served */}
          {analytics.receivers.recent.length > 0 ? (
            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-bold text-clox-ink">
                {t('admin.receiversTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-clox-mute">
                Recipient contacts verified across completed and active delivery consignments
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.receivers.recent.map((rcv, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-clox-border-soft bg-clox-surface p-3 text-xs shadow-sm"
                  >
                    <span className="rounded-full bg-clox-surface-alt p-1.5 text-clox-orange">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-clox-ink truncate">
                        {rcv.name || 'Unnamed Recipient'}
                      </div>
                      {rcv.email ? (
                        <div className="text-[11px] text-clox-mute truncate">{rcv.email}</div>
                      ) : null}
                      {rcv.phone ? (
                        <div className="text-[11px] text-clox-faint">{rcv.phone}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Collapsible Legacy Pre-Launch Registry Section (Clean, unobtrusive) */}
          <div className="border-t border-clox-border-soft pt-4">
            <button
              type="button"
              onClick={() => setShowLegacyLeads((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg bg-clox-surface-alt/60 px-4 py-2.5 text-left text-xs font-semibold text-clox-mute transition hover:bg-clox-surface-alt hover:text-clox-ink"
            >
              <span>{t('admin.legacyLeadsTitle')}</span>
              {showLegacyLeads ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showLegacyLeads ? (
              <div className="mt-4 space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="clox-card p-4">
                    <span className="text-xs text-clox-mute">{t('admin.statAll')}</span>
                    <div className="text-2xl font-bold text-clox-ink">{totals?.all ?? 0}</div>
                  </div>
                  <div className="clox-card p-4">
                    <span className="text-xs text-clox-mute">{t('admin.statInvestors')}</span>
                    <div className="text-2xl font-bold text-clox-ink">{totals?.investors ?? 0}</div>
                  </div>
                  <div className="clox-card p-4">
                    <span className="text-xs text-clox-mute">{t('admin.statEoiState')}</span>
                    <div className="text-2xl font-bold text-clox-ink">
                      {totals?.eoiStateMasters ?? 0}
                    </div>
                  </div>
                  <div className="clox-card p-4">
                    <span className="text-xs text-clox-mute">{t('admin.statEoiLocal')}</span>
                    <div className="text-2xl font-bold text-clox-ink">{totals?.eoiLocalBdes ?? 0}</div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <section className="clox-card p-5 lg:col-span-2">
                    <h3 className="font-display text-base font-semibold text-clox-ink">
                      {t('admin.byStatus')}
                    </h3>
                    <DistributionBars className="mt-4" items={statusBars} />
                  </section>
                  <section className="clox-card p-5">
                    <h3 className="font-display text-base font-semibold text-clox-ink">
                      {t('admin.activity')}
                    </h3>
                    <Timeline className="mt-4" items={activityItems} />
                  </section>
                </div>

                {recentLeads.length > 0 ? (
                  <section className="clox-card p-5">
                    <h3 className="font-display text-base font-semibold text-clox-ink">
                      {t('admin.recentLeads')}
                    </h3>
                    <ResponsiveDataView
                      className="mt-3"
                      cards={
                        <DataCardList
                          items={recentLeads}
                          getKey={(lead) => lead.id}
                          renderItem={(lead) => (
                            <Link
                              to={`/leads/${lead.id}`}
                              className={`block ${dataCardClassName}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-clox-ink">
                                    {lead.companyName || lead.email}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-clox-faint">
                                    {lead.email}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-md bg-clox-surface-alt px-2 py-1 text-xs text-clox-mute">
                                  {formatLeadStatus(lead.status)}
                                </span>
                              </div>
                            </Link>
                          )}
                        />
                      }
                      table={
                        <DataTable
                          minWidthClassName="min-w-[36rem]"
                          headers={[
                            t('admin.colCompany'),
                            t('admin.colType'),
                            t('admin.colStatus'),
                            t('admin.colCreated'),
                          ]}
                        >
                          {recentLeads.map((lead) => (
                            <tr
                              key={lead.id}
                              className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                            >
                              <td className="px-4 py-2.5">
                                <Link
                                  to={`/leads/${lead.id}`}
                                  className="font-medium text-clox-ink hover:text-clox-orange"
                                >
                                  {lead.companyName || lead.email}
                                </Link>
                                <div className="text-xs text-clox-faint">{lead.email}</div>
                              </td>
                              <td className="px-4 py-2.5 text-clox-mute">
                                {formatLeadType(lead.type)}
                              </td>
                              <td className="px-4 py-2.5 text-clox-mute">
                                {formatLeadStatus(lead.status)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-clox-mute">
                                {formatDateTime(lead.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      }
                    />
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
