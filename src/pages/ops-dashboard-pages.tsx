import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  DollarSign,
  FileCheck2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { Button, Kpi, KpiStrip, Notice, StatusPill, type StatusPillTone } from '@/components/ui';
import { getErrorDetail, getOpsDashboardStats } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';

function statusTone(status: string): StatusPillTone {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED_LOCAL':
    case 'DELIVERED':
    case 'COMPLETED':
    case 'ACTIVE':
    case 'APPROVED':
      return 'ok';
    case 'OPEN_TRIAGE':
    case 'DRAFT':
    case 'SUBMITTED':
      return 'warn';
    case 'ESCALATED_STATE':
    case 'PENDING_REVIEW':
    case 'IN_TRANSIT':
      return 'urgent';
    case 'ESCALATED_SUPER':
    case 'REJECTED':
    case 'FAILED':
      return 'danger';
    case 'IN_REVIEW':
    case 'ASSIGNED':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * OPS-STA-DSH-01: State Master Operational Dashboard
 * Regional scope oversight: carriers, jobs, tier-2 disputes, compliance & 10% gross platform share earnings.
 */
export function StateMasterDashboard() {
  const query = useQuery({
    queryKey: ['ops', 'dashboard', 'stats'],
    queryFn: () => getOpsDashboardStats(),
    refetchInterval: 30000,
  });

  const stats = query.data;

  if (query.isLoading) {
    return <LoadingBlock label="Loading state operations telemetry..." />;
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <Notice tone="error">Failed to load dashboard data: {getErrorDetail(query.error)}</Notice>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const regionName = stats?.scope.regionName || stats?.scope.regionCode || 'State';
  const regionCode = stats?.scope.regionCode || 'AU';
  const kpis = stats?.kpis;

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="clox-card bg-gradient-to-r from-orange-50 via-white to-orange-50/30 p-6 border-orange-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-clox-orange">
                <MapPin className="h-3.5 w-3.5" />
                {regionCode} &bull; State Master Operations
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {regionName} Operations Hub
            </h1>
            <p className="mt-1 text-sm text-clox-mute">
              Regional oversight of carrier networks, active freight dispatch, compliance audits, and Tier-2 dispute resolution.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', query.isFetching && 'animate-spin')} />
              Refresh Telemetry
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <Kpi
          label="Active Carriers"
          value={kpis?.activeCarriers ?? 0}
          delta="Accredited & operational in state"
        />
        <Kpi
          label="In-Progress Jobs"
          value={kpis?.activeJobs ?? 0}
          delta="Active statewide freight loads"
        />
        <Kpi
          label="Accrued State Share"
          value={formatCurrency(kpis?.accruedRevenueCents ?? 0)}
          delta="10% gross platform share pool"
        />
        <Kpi
          label="Open Disputes"
          value={kpis?.openDisputes ?? 0}
          urgent={(kpis?.openDisputes ?? 0) > 0}
          delta="State triage & escalated cases"
        />
      </KpiStrip>

      {/* Main Grid: 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 spans): Disputes & Jobs */}
        <div className="space-y-6 lg:col-span-2">
          {/* Open Disputes Section (WF-OPS-002) */}
          <div className="clox-card p-5">
            <div className="flex items-center justify-between border-b border-clox-border pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-clox-orange" />
                <h2 className="font-display text-lg font-bold text-clox-ink">
                  In-State Disputes & Surcharges
                </h2>
              </div>
              <Link
                to="/ops/disputes"
                className="inline-flex items-center text-sm font-semibold text-clox-orange hover:underline"
              >
                View Dispute Ledger <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {stats?.recentDisputes && stats.recentDisputes.length > 0 ? (
              <div className="mt-4 divide-y divide-clox-border">
                {stats.recentDisputes.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-clox-surface-alt/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-clox-ink">
                          {d.disputeNumber}
                        </span>
                        <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>
                        <span className="text-xs text-clox-mute">({d.type})</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-clox-ink truncate">
                        {d.companyName} &bull; <span className="text-clox-mute">{d.reason}</span>
                      </p>
                      <p className="text-xs text-clox-mute">
                        Disputed Amount: {d.disputedAmountCents ? formatCurrency(d.disputedAmountCents) : 'N/A'}
                      </p>
                    </div>
                    <Link to={`/ops/disputes/${d.id}`}>
                      <Button variant="secondary" className="text-xs whitespace-nowrap">
                        Review & Rulings
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="No disputes active in your state"
                description="Carrier and sender transactions in your region are running smoothly without active dispute claims."
              />
            )}
          </div>

          {/* Recent Active Freight Section */}
          <div className="clox-card p-5">
            <div className="flex items-center justify-between border-b border-clox-border pb-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-clox-ink" />
                <h2 className="font-display text-lg font-bold text-clox-ink">
                  Recent In-State Freight Jobs
                </h2>
              </div>
              <Link
                to="/jobs"
                className="inline-flex items-center text-sm font-semibold text-clox-orange hover:underline"
              >
                All Jobs <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {stats?.recentJobs && stats.recentJobs.length > 0 ? (
              <div className="mt-4 divide-y divide-clox-border">
                {stats.recentJobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-clox-surface-alt/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-clox-ink">
                          {j.title || 'Freight Shipment'}
                        </span>
                        <StatusPill tone={statusTone(j.status)}>{j.status}</StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-clox-mute">
                        Route: {j.pickupSuburb || 'Pickup'} &rarr; {j.dropoffSuburb || 'Dropoff'}
                      </p>
                    </div>
                    <Link to={`/jobs/${j.id}`}>
                      <Button variant="secondary" className="text-xs">
                        Details
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="No recent jobs recorded"
                description="New bookings in your state will populate this ledger in real-time."
              />
            )}
          </div>
        </div>

        {/* Right Column (1 span): Compliance & Quick Actions */}
        <div className="space-y-6">
          {/* Pending Compliance Queue */}
          <div className="clox-card p-5">
            <div className="flex items-center justify-between border-b border-clox-border pb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-amber-600" />
                <h2 className="font-display text-lg font-bold text-clox-ink">Compliance Queue</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {stats?.kpis.pendingCompliance ?? 0} Pending
              </span>
            </div>

            {stats?.recentComplianceCases && stats.recentComplianceCases.length > 0 ? (
              <div className="mt-4 space-y-3">
                {stats.recentComplianceCases.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-clox-border p-3 hover:border-clox-orange/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-clox-ink uppercase tracking-wide">
                        {c.caseType}
                      </span>
                      <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                    </div>
                    <p className="mt-1 text-sm font-medium text-clox-ink truncate">{c.companyName}</p>
                    <div className="mt-3 flex justify-end">
                      <Link to="/compliance">
                        <Button variant="secondary" className="text-xs">
                          Inspect Verification
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-clox-mute py-4 text-center">
                All state carrier and partner KYC/KYB audits are currently up to date.
              </p>
            )}
          </div>

          {/* Operational Quick Actions */}
          <div className="clox-card p-5">
            <h2 className="font-display text-lg font-bold text-clox-ink border-b border-clox-border pb-3">
              Operations Navigator
            </h2>
            <div className="mt-4 space-y-2">
              <Link
                to="/ops/team"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-clox-orange" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">Local BDE Field Team</p>
                    <p className="text-xs text-clox-mute">Territory oversight & SLA monitoring</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>

              <Link
                to="/ops/growth"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">State Growth Pipeline</p>
                    <p className="text-xs text-clox-mute">Territory carrier & sender prospects</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>

              <Link
                to="/surcharges"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">Surcharge Auditing</p>
                    <p className="text-xs text-clox-mute">Fuel, demurrage & oversize approvals</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * OPS-LOC-DSH-01: Local BDE Operational Dashboard
 * Field territory hub: territory prospects, stuck onboardings, first-line triage & 5% gross share earnings.
 */
export function LocalBdeDashboard() {
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ['ops', 'dashboard', 'stats'],
    queryFn: () => getOpsDashboardStats(),
    refetchInterval: 30000,
  });

  const stats = query.data;

  if (query.isLoading) {
    return <LoadingBlock label="Loading local territory operations..." />;
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <Notice tone="error">Failed to load dashboard data: {getErrorDetail(query.error)}</Notice>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const territoryName = stats?.scope.territoryName || stats?.scope.territoryCode || 'Territory';
  const territoryCode = stats?.scope.territoryCode || 'FIELD';
  const regionCode = stats?.scope.regionCode || 'AU';
  const kpis = stats?.kpis;

  const referralLink = `${window.location.origin}/register?ref=${encodeURIComponent(territoryCode)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="clox-card bg-gradient-to-r from-blue-50 via-white to-blue-50/20 p-6 border-blue-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-800">
                <MapPin className="h-3.5 w-3.5" />
                {regionCode} &bull; {territoryCode} Local BDE Hub
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {territoryName} Field Office
            </h1>
            <p className="mt-1 text-sm text-clox-mute">
              Local merchant acquisition, onboarding support, Tier-1 dispute triage, and 5% territory gross revenue commission.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', query.isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <Kpi
          label="Prospects in Pipe"
          value={kpis?.prospectsInPipeline ?? 0}
          delta="Assigned territory leads"
        />
        <Kpi
          label="Active Territory Jobs"
          value={kpis?.activeJobs ?? 0}
          delta="Freight origins/destinations"
        />
        <Kpi
          label="Accrued Territory Share"
          value={formatCurrency(kpis?.accruedRevenueCents ?? 0)}
          delta="5% gross platform share pool"
        />
        <Kpi
          label="First-Line Triage"
          value={kpis?.firstLineDisputes ?? 0}
          urgent={(kpis?.firstLineDisputes ?? 0) > 0}
          delta="Awaiting 24h checklist"
        />
      </KpiStrip>

      {/* Main Grid: 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 spans): Action Required Task Queue & Triage Disputes */}
        <div className="space-y-6 lg:col-span-2">
          {/* Daily Action Task Queue */}
          <div className="clox-card p-5">
            <div className="flex items-center justify-between border-b border-clox-border pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-clox-orange" />
                <h2 className="font-display text-lg font-bold text-clox-ink">
                  Daily Action Queue & SLAs
                </h2>
              </div>
              <span className="text-xs font-medium text-clox-mute">Priority items</span>
            </div>

            {stats?.tasks && stats.tasks.length > 0 ? (
              <div className="mt-4 divide-y divide-clox-border">
                {stats.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-clox-surface-alt/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-bold uppercase',
                            task.kind === 'DISPUTE_TRIAGE'
                              ? 'bg-red-100 text-red-800'
                              : task.kind === 'ONBOARDING_STUCK'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800',
                          )}
                        >
                          {task.kind === 'DISPUTE_TRIAGE'
                            ? 'Dispute Triage'
                            : task.kind === 'ONBOARDING_STUCK'
                            ? 'Onboarding'
                            : 'Prospect Follow-up'}
                        </span>
                        <span className="text-xs font-semibold text-rose-600">{task.dueText}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-clox-ink">{task.title}</p>
                      <p className="text-xs text-clox-mute truncate">{task.description}</p>
                    </div>
                    <Link to={task.href}>
                      <Button variant="cta" className="text-xs whitespace-nowrap">
                        Act Now <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="Action queue clear"
                description="You have no outstanding triage checklists or critical bottlenecks requiring immediate attention."
              />
            )}
          </div>

          {/* Territory Disputes */}
          <div className="clox-card p-5">
            <div className="flex items-center justify-between border-b border-clox-border pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-clox-ink" />
                <h2 className="font-display text-lg font-bold text-clox-ink">
                  Territory First-Line Disputes
                </h2>
              </div>
              <Link
                to="/ops/disputes"
                className="inline-flex items-center text-sm font-semibold text-clox-orange hover:underline"
              >
                All Disputes <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {stats?.recentDisputes && stats.recentDisputes.length > 0 ? (
              <div className="mt-4 divide-y divide-clox-border">
                {stats.recentDisputes.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-clox-surface-alt/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-clox-ink">
                          {d.disputeNumber}
                        </span>
                        <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm text-clox-ink font-medium">
                        {d.companyName} &bull; <span className="text-clox-mute">{d.reason}</span>
                      </p>
                      <p className="text-xs text-clox-mute">
                        Disputed: {d.disputedAmountCents ? formatCurrency(d.disputedAmountCents) : 'N/A'}
                      </p>
                    </div>
                    <Link to={`/ops/disputes/${d.id}`}>
                      <Button variant="secondary" className="text-xs">
                        Open Triage
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="No territory disputes"
                description="Your local territory currently has zero open dispute claims."
              />
            )}
          </div>
        </div>

        {/* Right Column (1 span): Referral Kit & Navigation */}
        <div className="space-y-6">
          {/* BDE Referral Attribution Kit */}
          <div className="clox-card p-5 bg-gradient-to-br from-amber-500/5 via-white to-orange-500/10 border-clox-orange/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-clox-orange" />
              <h2 className="font-display text-lg font-bold text-clox-ink">
                Territory Referral Link
              </h2>
            </div>
            <p className="mt-2 text-xs text-clox-mute">
              Share your direct territory onboarding link with prospective senders and carriers. All accounts created with this link attribute their gross freight spend to your 5% revenue commission share.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="block w-full rounded-lg border border-clox-border bg-clox-surface px-3 py-2 text-xs font-mono text-clox-ink select-all focus:outline-none"
              />
              <Button
                variant={copied ? 'secondary' : 'cta'}
                className="shrink-0 text-xs"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 pt-3 border-t border-clox-border flex items-center justify-between">
              <Link to="/ops/growth/invite" className="text-xs font-semibold text-clox-orange hover:underline">
                Send Direct Email Invite &rarr;
              </Link>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="clox-card p-5">
            <h2 className="font-display text-lg font-bold text-clox-ink border-b border-clox-border pb-3">
              Field Shortcuts
            </h2>
            <div className="mt-4 space-y-2">
              <Link
                to="/ops/growth"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">Lead Management</p>
                    <p className="text-xs text-clox-mute">Track territory prospects & stages</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>

              <Link
                to="/compliance"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">Carrier Compliance</p>
                    <p className="text-xs text-clox-mute">Assist stuck KYC & insurance uploads</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>

              <Link
                to="/account"
                className="flex items-center justify-between rounded-lg p-3 hover:bg-clox-surface-alt border border-clox-border transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign className="h-4 w-4 text-clox-orange" />
                  <div>
                    <p className="text-sm font-semibold text-clox-ink">My Earnings & Payouts</p>
                    <p className="text-xs text-clox-mute">View monthly 5% commission ledger</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-clox-mute" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
