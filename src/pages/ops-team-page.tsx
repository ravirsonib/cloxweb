import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  Kpi,
  KpiStrip,
  Notice,
  StatusPill,
  TextArea,
  type StatusPillTone,
} from '@/components/ui';
import {
  addBdeCoachingNote,
  getBdeTeamMember,
  getErrorDetail,
  listBdeTeam,
} from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';

function slaTone(status: 'GOOD' | 'WARNING' | 'BREACHED'): StatusPillTone {
  switch (status) {
    case 'GOOD':
      return 'ok';
    case 'WARNING':
      return 'warn';
    case 'BREACHED':
      return 'danger';
  }
}

function slaIcon(status: 'GOOD' | 'WARNING' | 'BREACHED') {
  switch (status) {
    case 'GOOD':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline mr-1" />;
    case 'WARNING':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline mr-1" />;
    case 'BREACHED':
      return <XCircle className="h-3.5 w-3.5 text-rose-600 inline mr-1" />;
  }
}

/**
 * OPS-STA-TEAM-01: State Master Local BDE Team View
 * Oversight of all Local BDEs in the state master's region, their territories, SLAs, open tasks, pipeline & earnings.
 */
export function OpsTeamPage() {
  const [search, setSearch] = useState('');
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'GOOD' | 'WARNING' | 'BREACHED'>('ALL');

  const query = useQuery({
    queryKey: ['ops', 'team'],
    queryFn: () => listBdeTeam(),
  });

  const data = query.data;
  const members = data?.members ?? [];

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (slaFilter !== 'ALL' && m.slaStatus !== slaFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q) ?? false;
        const matchEmail = m.email.toLowerCase().includes(q);
        const matchTerritory = (m.territoryCode || m.territoryName || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchTerritory) {
          return false;
        }
      }
      return true;
    });
  }, [members, search, slaFilter]);

  const totalPipeline = members.reduce((sum, m) => sum + m.pipelineCount, 0);
  const totalOverdue = members.reduce((sum, m) => sum + m.overdueTasksCount, 0);
  const totalRevenue = members.reduce((sum, m) => sum + m.accruedRevenueCents, 0);

  if (query.isLoading) {
    return <LoadingBlock label="Loading Local BDE field team..." />;
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <Notice tone="error">Failed to load team roster: {getErrorDetail(query.error)}</Notice>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="clox-card bg-gradient-to-r from-orange-50 via-white to-orange-50/30 p-6 border-orange-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-clox-orange">
                <MapPin className="h-3.5 w-3.5" />
                {data?.regionCode} &bull; Local BDE Field Team
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {data?.regionName} BDE Field Operations
            </h1>
            <p className="mt-1 text-sm text-clox-mute">
              State Master performance oversight: track Local BDE territory coverage, dispute triage SLAs, merchant acquisition pipelines, and 5% commission earnings.
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
          label="Field BDEs"
          value={members.length}
          delta="Assigned territory operators"
        />
        <Kpi
          label="State Acquisition Pipe"
          value={totalPipeline}
          delta="Active merchant & carrier leads"
        />
        <Kpi
          label="Overdue Triage SLAs"
          value={totalOverdue}
          urgent={totalOverdue > 0}
          delta="Disputes > 24h triage breach"
        />
        <Kpi
          label="Territory Share Pool"
          value={formatCurrency(totalRevenue)}
          delta="5% BDE commission accrual"
        />
      </KpiStrip>

      {/* Filters & Search */}
      <div className="clox-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clox-mute" />
            <input
              type="text"
              placeholder="Search by BDE name, email, or territory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-clox-border bg-clox-surface pl-9 pr-3 py-2 text-sm text-clox-ink focus:border-clox-orange focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-clox-mute uppercase tracking-wide">
              SLA Health:
            </span>
            {(['ALL', 'GOOD', 'WARNING', 'BREACHED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSlaFilter(filter)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  slaFilter === filter
                    ? 'bg-clox-orange text-white'
                    : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
                )}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Team Roster Table */}
      <div className="clox-card p-5">
        <div className="flex items-center justify-between border-b border-clox-border pb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-clox-orange" />
            <h2 className="font-display text-lg font-bold text-clox-ink">
              Territory Franchisee Roster ({filteredMembers.length})
            </h2>
          </div>
        </div>

        {filteredMembers.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-clox-surface-alt/70 text-xs font-semibold uppercase tracking-wider text-clox-mute">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">BDE Name & Contact</th>
                  <th className="px-4 py-3">Territory</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA Status</th>
                  <th className="px-4 py-3">Open / Overdue Tasks</th>
                  <th className="px-4 py-3">Pipeline</th>
                  <th className="px-4 py-3">5% Accrual</th>
                  <th className="px-4 py-3 text-right rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-clox-surface-alt/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-clox-ink">{member.name || 'Unnamed BDE'}</p>
                      <p className="text-xs text-clox-mute">{member.email}</p>
                      {member.phone ? (
                        <p className="text-xs text-clox-mute">{member.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-clox-ink bg-clox-surface-alt px-2 py-0.5 rounded">
                        {member.territoryCode || 'UNASSIGNED'}
                      </span>
                      {member.territoryName ? (
                        <p className="text-xs text-clox-mute mt-0.5">{member.territoryName}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill tone={member.active ? 'ok' : 'warn'}>
                        {member.status}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill tone={slaTone(member.slaStatus)}>
                        {slaIcon(member.slaStatus)}
                        {member.slaStatus}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-clox-ink">
                        {member.openTasksCount} open
                        {member.overdueTasksCount > 0 ? (
                          <span className="ml-1 text-rose-600 font-bold">
                            ({member.overdueTasksCount} overdue)
                          </span>
                        ) : null}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-clox-ink">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        {member.pipelineCount} leads
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-clox-ink">
                      {formatCurrency(member.accruedRevenueCents)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link to={`/ops/team/${member.id}`}>
                        <Button variant="secondary" className="text-xs">
                          Inspect &rarr;
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyBlock
            title="No Local BDEs match criteria"
            description="Adjust your search query or SLA filter to view team members."
          />
        )}
      </div>
    </div>
  );
}

/**
 * OPS-STA-TEAM-02: State Master Local BDE Detail & Coaching Page
 * In-depth performance inspection, triage disputes queue, assigned pipeline, and coaching notes log.
 */
export function OpsTeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'DISPUTES' | 'PIPELINE' | 'COACHING'>('DISPUTES');
  const [noteText, setNoteText] = useState('');

  const query = useQuery({
    queryKey: ['ops', 'team', id],
    queryFn: () => (id ? getBdeTeamMember(id) : null),
    enabled: Boolean(id),
  });

  const addNoteMutation = useMutation({
    mutationFn: (text: string) => (id ? addBdeCoachingNote(id, text) : Promise.reject('No ID')),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['ops', 'team', id] });
    },
  });

  const member = query.data;

  if (query.isLoading) {
    return <LoadingBlock label="Loading BDE telemetry and queue..." />;
  }

  if (query.isError || !member) {
    return (
      <div className="space-y-4">
        <Notice tone="error">Failed to load BDE details: {getErrorDetail(query.error)}</Notice>
        <Link to="/ops/team">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Team Roster
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/ops/team"
          className="inline-flex items-center text-sm font-semibold text-clox-mute hover:text-clox-ink"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Team Roster
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="clox-card p-6 bg-gradient-to-r from-orange-50/60 via-white to-blue-50/40 border-clox-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-800">
                <MapPin className="h-3.5 w-3.5" />
                {member.regionCode} &bull; {member.territoryCode || 'FIELD'}
              </span>
              <StatusPill tone={slaTone(member.slaStatus)}>
                {slaIcon(member.slaStatus)}
                SLA: {member.slaStatus}
              </StatusPill>
              <StatusPill tone={member.active ? 'ok' : 'warn'}>{member.status}</StatusPill>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {member.name || 'Unnamed BDE'}
            </h1>
            <p className="mt-1 text-sm text-clox-mute">
              Territory Operator: <span className="font-semibold text-clox-ink">{member.territoryName || member.territoryCode}</span>
              {member.companyName ? ` &bull; ${member.companyName}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-clox-mute">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {member.email}
              </span>
              {member.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {member.phone}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Joined {new Date(member.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          label="Open Tasks"
          value={member.openTasksCount}
          delta="Dispute triage & initial leads"
        />
        <Kpi
          label="Overdue Triage"
          value={member.overdueTasksCount}
          urgent={member.overdueTasksCount > 0}
          delta="Disputes > 24h unresolved"
        />
        <Kpi
          label="Pipeline Prospects"
          value={member.prospects.length}
          delta="Territory acquisition leads"
        />
        <Kpi
          label="5% Accrued Earnings"
          value={formatCurrency(member.accruedRevenueCents)}
          delta="Gross platform commission"
        />
      </KpiStrip>

      {/* Navigation Tabs */}
      <div className="flex border-b border-clox-border">
        <button
          onClick={() => setActiveTab('DISPUTES')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors',
            activeTab === 'DISPUTES'
              ? 'border-clox-orange text-clox-orange'
              : 'border-transparent text-clox-mute hover:text-clox-ink',
          )}
        >
          <ShieldAlert className="h-4 w-4" />
          Dispute Triage Queue ({member.recentDisputes.length})
        </button>

        <button
          onClick={() => setActiveTab('PIPELINE')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors',
            activeTab === 'PIPELINE'
              ? 'border-clox-orange text-clox-orange'
              : 'border-transparent text-clox-mute hover:text-clox-ink',
          )}
        >
          <TrendingUp className="h-4 w-4" />
          Pipeline & Prospects ({member.prospects.length})
        </button>

        <button
          onClick={() => setActiveTab('COACHING')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors',
            activeTab === 'COACHING'
              ? 'border-clox-orange text-clox-orange'
              : 'border-transparent text-clox-mute hover:text-clox-ink',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Coaching Notes ({member.coachingNotes.length})
        </button>
      </div>

      {/* Tab 1: Dispute Triage Queue */}
      {activeTab === 'DISPUTES' ? (
        <div className="clox-card p-5">
          <div className="flex items-center justify-between border-b border-clox-border pb-3">
            <h2 className="font-display text-lg font-bold text-clox-ink">
              Territory Disputes & First-Line Triage
            </h2>
            <Link
              to="/ops/disputes"
              className="text-xs font-semibold text-clox-orange hover:underline"
            >
              Open Disputes System &rarr;
            </Link>
          </div>

          {member.recentDisputes.length > 0 ? (
            <div className="mt-4 divide-y divide-clox-border">
              {member.recentDisputes.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 hover:bg-clox-surface-alt/40 rounded-lg px-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-clox-ink">
                        {d.disputeNumber}
                      </span>
                      <StatusPill tone={d.isOverdue ? 'danger' : 'warn'}>
                        {d.status}
                      </StatusPill>
                      {d.isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3" /> SLA BREACH (&gt;24h)
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-clox-ink font-medium">
                      {d.reason} &bull; <span className="text-xs text-clox-mute">{d.type}</span>
                    </p>
                    <p className="text-xs text-clox-mute">
                      Amount: {d.disputedAmountCents ? formatCurrency(d.disputedAmountCents) : 'N/A'} &bull; Created {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Link to={`/ops/disputes/${d.id}`}>
                    <Button variant="secondary" className="text-xs whitespace-nowrap">
                      Inspect Dispute &rarr;
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="No territory disputes"
              description="This Local BDE's territory has zero disputes currently pending triage or review."
            />
          )}
        </div>
      ) : null}

      {/* Tab 2: Pipeline & Prospects */}
      {activeTab === 'PIPELINE' ? (
        <div className="clox-card p-5">
          <div className="flex items-center justify-between border-b border-clox-border pb-3">
            <h2 className="font-display text-lg font-bold text-clox-ink">
              Acquisition Pipeline
            </h2>
            <Link
              to="/ops/growth"
              className="text-xs font-semibold text-clox-orange hover:underline"
            >
              Open Growth Module &rarr;
            </Link>
          </div>

          {member.prospects.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-clox-surface-alt/70 text-xs font-semibold uppercase tracking-wider text-clox-mute">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Company Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 rounded-r-lg">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clox-border">
                  {member.prospects.map((p) => (
                    <tr key={p.id} className="hover:bg-clox-surface-alt/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-clox-ink">{p.legalName}</td>
                      <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-clox-mute">
                        {p.companyType}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone="info">{p.stage}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-xs text-clox-mute">
                        {p.contactName || '-'}
                        {p.email ? ` · ${p.email}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-clox-mute">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyBlock
              title="No prospects recorded"
              description="This Local BDE has not yet added any commercial accounts to their territory pipeline."
            />
          )}
        </div>
      ) : null}

      {/* Tab 3: Coaching Notes */}
      {activeTab === 'COACHING' ? (
        <div className="space-y-6">
          {/* Add Note Form */}
          <div className="clox-card p-5">
            <h2 className="font-display text-base font-bold text-clox-ink">
              Log State Master Coaching / SLA Note
            </h2>
            <p className="mt-1 text-xs text-clox-mute">
              Document 1-on-1 operational coaching sessions, territory realignment instructions, or SLA breach remediation plans.
            </p>
            <div className="mt-4 space-y-3">
              <TextArea
                rows={3}
                placeholder="Enter coaching notes, SLA warnings, or territory action items..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  variant="cta"
                  className="text-xs"
                  onClick={() => addNoteMutation.mutate(noteText)}
                  disabled={noteText.trim().length < 3 || addNoteMutation.isPending}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {addNoteMutation.isPending ? 'Logging Note...' : 'Save Coaching Note'}
                </Button>
              </div>
            </div>
          </div>

          {/* Coaching Notes History */}
          <div className="clox-card p-5">
            <h2 className="font-display text-base font-bold text-clox-ink border-b border-clox-border pb-3">
              Coaching & Remediation History ({member.coachingNotes.length})
            </h2>

            {member.coachingNotes.length > 0 ? (
              <div className="mt-4 space-y-4">
                {member.coachingNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-clox-border bg-clox-surface-alt/40 p-4"
                  >
                    <div className="flex items-center justify-between text-xs text-clox-mute border-b border-clox-border/60 pb-2">
                      <span className="font-semibold text-clox-ink">
                        Logged by {note.authorName}
                      </span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm text-clox-ink whitespace-pre-wrap">{note.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="No coaching notes recorded"
                description="Use the form above to log performance feedback and coaching items for this BDE."
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
