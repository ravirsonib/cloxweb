import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Scale,
  Truck,
} from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  Notice,
  PaginationBar,
  RoleBadge,
  Select,
  StatusPill,
  dataCardClassName,
  useClientPagination,
} from '@/components/ui';
import {
  closeLocalDispute,
  escalateDispute,
  getDispute,
  getErrorDetail,
  listDisputes,
  resolveDispute,
  triageDispute,
  type DisputeSummaryRow,
} from '@/lib/api';
import { formatDollars } from '@/lib/currency';
import { AdminRole, DisputeRuling, DisputeStatus, DisputeType } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function statusTone(status: DisputeStatus): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case DisputeStatus.OPEN_TRIAGE:
      return 'warn';
    case DisputeStatus.TRIAGED:
      return 'info';
    case DisputeStatus.ESCALATED_STATE:
    case DisputeStatus.ESCALATED_SUPER:
      return 'danger';
    case DisputeStatus.RESOLVED:
      return 'ok';
    case DisputeStatus.CLOSED:
    case DisputeStatus.REJECTED:
    default:
      return 'neutral';
  }
}

function typeLabel(type: DisputeType): string {
  switch (type) {
    case DisputeType.WAITING_SURCHARGE:
      return 'Waiting Surcharge';
    case DisputeType.MASS_SURCHARGE:
      return 'Mass Discrepancy';
    case DisputeType.DAMAGE:
      return 'Cargo Damage';
    case DisputeType.CANCELLATION:
      return 'Cancellation Dispute';
    case DisputeType.GENERAL:
    default:
      return 'General Dispute';
  }
}

export function OpsDisputesPage() {
  const role = useAuthStore((s) => s.role);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'escalated' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['disputes', 'list'],
    queryFn: ({ signal }) => listDisputes({ page: 1, pageSize: 50 }, { signal }),
  });

  const allItems = query.data?.items ?? [];

  const filteredItems = allItems.filter((item) => {
    if (activeTab === 'open') {
      if (item.status !== DisputeStatus.OPEN_TRIAGE && item.status !== DisputeStatus.TRIAGED) {
        return false;
      }
    } else if (activeTab === 'escalated') {
      if (
        item.status !== DisputeStatus.ESCALATED_STATE &&
        item.status !== DisputeStatus.ESCALATED_SUPER
      ) {
        return false;
      }
    } else if (activeTab === 'resolved') {
      if (item.status !== DisputeStatus.RESOLVED && item.status !== DisputeStatus.CLOSED) {
        return false;
      }
    }

    if (typeFilter !== 'ALL' && item.type !== typeFilter) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = item.disputeNumber.toLowerCase().includes(q);
      const matchReason = item.reason.toLowerCase().includes(q);
      const matchJob = item.job.title?.toLowerCase().includes(q);
      const matchCompany = item.company.legalName.toLowerCase().includes(q);
      if (!matchNum && !matchReason && !matchJob && !matchCompany) {
        return false;
      }
    }

    return true;
  });

  const pager = useClientPagination(filteredItems, 10);

  if (query.isLoading) return <LoadingBlock label="Loading disputes..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-clox-ink">
              Dispute Adjudication
            </h1>
            <RoleBadge role={role} />
          </div>
          <p className="mt-1 text-sm text-clox-mute">
            {role === AdminRole.SUPER_ADMIN
              ? 'National oversight and binding dispute rulings'
              : role === AdminRole.STATE_MASTER
              ? 'Regional dispute resolution and Super Admin escalation'
              : 'Local territory dispute intake, customer evidence & first-line triage'}
          </p>
        </div>
      </div>

      {query.isError ? (
        <Notice tone="error">{getErrorDetail(query.error)}</Notice>
      ) : null}

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border pb-3">
        <div className="flex gap-2">
          {(
            [
              { id: 'all', label: 'All Disputes' },
              { id: 'open', label: 'Open / Triage' },
              { id: 'escalated', label: 'Escalated' },
              { id: 'resolved', label: 'Resolved / Closed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-clox-ink text-white'
                  : 'bg-clox-surface text-clox-mute hover:bg-clox-border/60 hover:text-clox-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search dispute #, reason, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-clox-border bg-white px-3 py-1.5 text-xs text-clox-ink placeholder:text-clox-faint focus:border-clox-accent focus:outline-none"
          />

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">All Dispute Types</option>
            <option value="WAITING_SURCHARGE">Waiting Surcharge</option>
            <option value="MASS_SURCHARGE">Mass Discrepancy</option>
            <option value="DAMAGE">Cargo Damage</option>
            <option value="CANCELLATION">Cancellation</option>
            <option value="GENERAL">General</option>
          </Select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyBlock
          title="No disputes found"
          description="There are currently no dispute records matching the selected view or filters."
        />
      ) : (
        <>
          <DataCardList
            items={pager.pagedItems}
            getKey={(row) => row.id}
            renderItem={(row) => <DisputeCard row={row} />}
          />
          <PaginationBar
            page={pager.page}
            totalPages={pager.totalPages}
            onPageChange={pager.setPage}
          />
        </>
      )}
    </div>
  );
}

function DisputeCard({ row }: { row: DisputeSummaryRow }) {
  return (
    <Link
      to={`/ops/disputes/${row.id}`}
      className={`block h-full transition hover:border-clox-accent/50 ${dataCardClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-clox-accent">
              {row.disputeNumber}
            </span>
            <span className="text-xs text-clox-faint">·</span>
            <span className="text-xs font-semibold text-clox-ink">
              {typeLabel(row.type)}
            </span>
            {row.job.originRegion ? (
              <span className="rounded bg-clox-surface-alt px-1.5 py-0.5 text-[10px] font-bold text-clox-mute">
                {row.job.originRegion.code}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 font-medium text-clox-ink">
            {row.reason}
          </p>
          <p className="mt-0.5 text-xs text-clox-mute">
            {row.company.legalName} · Job: {row.job.title || row.jobId.slice(0, 8)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
          {row.disputedAmountCents ? (
            <span className="font-mono text-xs font-bold text-clox-ink">
              {formatDollars(row.disputedAmountCents)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-clox-border/60 pt-2.5 text-[11px] text-clox-mute">
        <span>Opened {new Date(row.createdAt).toLocaleDateString()}</span>
        <span className="font-medium text-clox-accent flex items-center gap-1">
          Review Dispute <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

export function OpsDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);

  const query = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => getDispute(id!),
    enabled: Boolean(id),
  });

  const dispute = query.data;

  // Local BDE Triage Form state
  const [contactedSender, setContactedSender] = useState(false);
  const [contactedCarrier, setContactedCarrier] = useState(false);
  const [evidenceComplete, setEvidenceComplete] = useState(false);
  const [triageNotes, setTriageNotes] = useState('');

  // Ruling Form state
  const [ruling, setRuling] = useState<DisputeRuling>(DisputeRuling.FAVOR_SENDER);
  const [financialAdjustment, setFinancialAdjustment] = useState<string>('NONE');
  const [rulingNotes, setRulingNotes] = useState('');

  // Escalation note state
  const [escalationNote, setEscalationNote] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);

  // Sync state when data loads
  const [synced, setSynced] = useState(false);
  if (dispute && !synced) {
    setContactedSender(dispute.contactedSender);
    setContactedCarrier(dispute.contactedCarrier);
    setEvidenceComplete(dispute.evidenceComplete);
    setTriageNotes(dispute.triageNotes || '');
    if (dispute.ruling) setRuling(dispute.ruling);
    if (dispute.financialAdjustment) setFinancialAdjustment(dispute.financialAdjustment);
    if (dispute.rulingNotes) setRulingNotes(dispute.rulingNotes);
    setSynced(true);
  }

  const triageMutation = useMutation({
    mutationFn: () =>
      triageDispute(id!, {
        contactedSender,
        contactedCarrier,
        evidenceComplete,
        triageNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (target: 'STATE' | 'SUPER') =>
      escalateDispute(id!, {
        target,
        notes: escalationNote || undefined,
      }),
    onSuccess: () => {
      setShowEscalateModal(false);
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });

  const closeLocalMutation = useMutation({
    mutationFn: () =>
      closeLocalDispute(id!, {
        notes: triageNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      resolveDispute(id!, {
        ruling,
        rulingNotes,
        financialAdjustment: financialAdjustment as any,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });

  if (query.isLoading) return <LoadingBlock label="Loading dispute details..." />;
  if (query.isError || !dispute) {
    return (
      <div className="space-y-4">
        <Link to="/ops/disputes" className="inline-flex items-center gap-1.5 text-xs text-clox-accent">
          <ArrowLeft className="h-4 w-4" /> Back to Disputes
        </Link>
        <Notice tone="error">{getErrorDetail(query.error || new Error('Dispute not found'))}</Notice>
      </div>
    );
  }

  const isClosed = dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/ops/disputes"
            className="rounded-lg border border-clox-border bg-white p-2 text-clox-mute hover:bg-clox-surface hover:text-clox-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-clox-accent">
                {dispute.disputeNumber}
              </span>
              <span className="text-sm font-bold text-clox-ink">·</span>
              <h1 className="font-display text-xl font-bold text-clox-ink">
                {typeLabel(dispute.type)}
              </h1>
              <StatusPill tone={statusTone(dispute.status)}>{dispute.status}</StatusPill>
            </div>
            <p className="text-xs text-clox-mute">
              Opened on {new Date(dispute.createdAt).toLocaleString()} by {dispute.openedByUser?.name || dispute.openedByUser?.email} ({dispute.company.legalName})
            </p>
          </div>
        </div>

        {dispute.disputedAmountCents ? (
          <div className="rounded-xl border border-clox-border bg-white px-4 py-2.5 shadow-sm text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-clox-faint">
              Disputed Amount
            </span>
            <p className="font-mono text-xl font-bold text-clox-ink">
              {formatDollars(dispute.disputedAmountCents)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Context, Statement & Evidence */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dispute Statement */}
          <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ink">
              <AlertCircle className="h-4 w-4 text-clox-accent" />
              Dispute Statement
            </h2>
            <div className="mt-3">
              <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                Reason Cited
              </p>
              <p className="mt-1 text-sm font-semibold text-clox-ink">
                {dispute.reason}
              </p>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                Full Description
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-clox-mute leading-relaxed">
                {dispute.description}
              </p>
            </div>

            {dispute.evidenceUrls.length > 0 ? (
              <div className="mt-4 border-t border-clox-border/60 pt-3">
                <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Attached Evidence
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dispute.evidenceUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-clox-border bg-clox-surface px-3 py-1.5 text-xs font-medium text-clox-ink hover:border-clox-accent"
                    >
                      <FileText className="h-3.5 w-3.5 text-clox-accent" /> Evidence #{idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Surcharge / Job Context */}
          {dispute.surcharge ? (
            <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ink">
                <DollarSign className="h-4 w-4 text-clox-accent" />
                Disputed Surcharge Breakdown
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-clox-surface p-3">
                  <span className="text-[11px] text-clox-mute">Surcharge Kind</span>
                  <p className="mt-0.5 text-sm font-bold text-clox-ink">{dispute.surcharge.kind}</p>
                </div>
                <div className="rounded-lg bg-clox-surface p-3">
                  <span className="text-[11px] text-clox-mute">Amount (Inc GST)</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-clox-ink">
                    {formatDollars(dispute.surcharge.amountIncGstCents / 100)}
                  </p>
                </div>
                <div className="rounded-lg bg-clox-surface p-3">
                  <span className="text-[11px] text-clox-mute">Current Surcharge Status</span>
                  <p className="mt-0.5 text-sm font-bold text-clox-ink">{dispute.surcharge.status}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Job & Involved Parties */}
          <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ink">
              <Truck className="h-4 w-4 text-clox-accent" />
              Job & Assigned Carrier Details
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Sender (Customer)
                </p>
                <p className="mt-1 text-sm font-bold text-clox-ink">
                  {dispute.job.senderCompany?.legalName || 'N/A'}
                </p>
                <p className="text-xs text-clox-mute">{dispute.job.senderCompany?.email}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Assigned Carrier
                </p>
                <p className="mt-1 text-sm font-bold text-clox-ink">
                  {dispute.job.assignment?.carrierCompany?.legalName || 'None assigned'}
                </p>
                {dispute.job.assignment?.driver ? (
                  <p className="text-xs text-clox-mute">
                    Driver: {dispute.job.assignment.driver.user.name} ({dispute.job.assignment.driver.user.phone})
                  </p>
                ) : null}
              </div>
            </div>

            {dispute.job.stops ? (
              <div className="mt-4 border-t border-clox-border/60 pt-3">
                <p className="text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Route Stops
                </p>
                <div className="mt-2 space-y-1.5">
                  {dispute.job.stops.map((stop: any) => (
                    <div key={stop.id} className="flex items-center gap-2 text-xs text-clox-ink">
                      <MapPin className="h-3.5 w-3.5 text-clox-accent shrink-0" />
                      <span className="font-semibold">{stop.stopType}:</span>
                      <span>
                        {stop.addressLine}, {stop.suburb} {stop.state} {stop.postcode}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Ruling Result if Resolved */}
          {dispute.status === DisputeStatus.RESOLVED ? (
            <div className="rounded-xl border border-clox-ok/40 bg-clox-ok/5 p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ok">
                <CheckCircle2 className="h-5 w-5" />
                Dispute Ruling: {dispute.ruling}
              </h2>
              <div className="mt-2 text-xs text-clox-ink">
                <p className="font-medium">
                  Financial Adjustment: <span className="font-mono font-bold">{dispute.financialAdjustment}</span>
                </p>
                <p className="mt-2 whitespace-pre-line text-clox-mute">
                  {dispute.rulingNotes}
                </p>
                <p className="mt-3 text-[11px] text-clox-faint">
                  Resolved by {dispute.resolvedByAdmin?.name || dispute.resolvedByAdmin?.email} on{' '}
                  {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Role Action Cards */}
        <div className="space-y-6">
          {/* Action Card: Local BDE Triage (OPS-LOC-DSP-02) */}
          {(role === AdminRole.LOCAL_BDE || role === AdminRole.SUPER_ADMIN) && !isClosed ? (
            <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ink">
                <Clock className="h-4 w-4 text-clox-accent" />
                First-Line Triage (Local BDE)
              </h2>
              <p className="mt-1 text-xs text-clox-mute">
                Complete evidence checklist and triage before escalating to State Master.
              </p>

              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-medium text-clox-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactedSender}
                    onChange={(e) => setContactedSender(e.target.checked)}
                    className="rounded border-clox-border text-clox-accent focus:ring-clox-accent"
                  />
                  <span>Contacted Sender (Customer)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-clox-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactedCarrier}
                    onChange={(e) => setContactedCarrier(e.target.checked)}
                    className="rounded border-clox-border text-clox-accent focus:ring-clox-accent"
                  />
                  <span>Contacted Carrier / Driver</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-clox-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evidenceComplete}
                    onChange={(e) => setEvidenceComplete(e.target.checked)}
                    className="rounded border-clox-border text-clox-accent focus:ring-clox-accent"
                  />
                  <span>Evidence & Geofence Verified</span>
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Triage Notes
                </label>
                <textarea
                  rows={3}
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Summarize communication with sender and carrier..."
                  className="mt-1 w-full rounded-lg border border-clox-border p-2.5 text-xs text-clox-ink focus:border-clox-accent focus:outline-none"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="cta"
                  size="sm"
                  disabled={triageMutation.isPending}
                  onClick={() => triageMutation.mutate()}
                  className="w-full justify-center"
                >
                  {triageMutation.isPending ? 'Saving...' : 'Save Triage Progress'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={closeLocalMutation.isPending}
                  onClick={() => closeLocalMutation.mutate()}
                  className="w-full justify-center text-xs"
                >
                  Close Locally (Informal Agreement)
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowEscalateModal(true)}
                  className="w-full justify-center text-xs"
                >
                  Escalate to State Master →
                </Button>
              </div>
            </div>
          ) : null}

          {/* Action Card: State Master & Super Admin Adjudication (OPS-STA-DSP-02 & OPS-SUP-DSP-02) */}
          {(role === AdminRole.STATE_MASTER || role === AdminRole.SUPER_ADMIN) && !isClosed ? (
            <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-clox-ink">
                <Scale className="h-4 w-4 text-clox-accent" />
                {role === AdminRole.SUPER_ADMIN
                  ? 'National Adjudication (Super)'
                  : `State Adjudication (${dispute.region?.code || dispute.job?.originRegion?.code || dispute.job?.stops?.[0]?.state || 'State'})`}
              </h2>
              <p className="mt-1 text-xs text-clox-mute">
                Issue a formal binding ruling and trigger automated financial adjustments.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                    Ruling
                  </label>
                  <div className="mt-2 space-y-2">
                    {[
                      { id: DisputeRuling.FAVOR_SENDER, label: 'Favor Sender (Customer)' },
                      { id: DisputeRuling.FAVOR_CARRIER, label: 'Favor Carrier (Driver)' },
                      { id: DisputeRuling.SPLIT, label: '50/50 Split Settlement' },
                    ].map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 text-xs font-medium text-clox-ink cursor-pointer">
                        <input
                          type="radio"
                          name="ruling"
                          value={opt.id}
                          checked={ruling === opt.id}
                          onChange={() => setRuling(opt.id as DisputeRuling)}
                          className="text-clox-accent focus:ring-clox-accent"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                    Financial Adjustment Hook
                  </label>
                  <Select
                    value={financialAdjustment}
                    onChange={(e) => setFinancialAdjustment(e.target.value)}
                    className="mt-1 w-full text-xs"
                  >
                    <option value="NONE">None (No Money Adjustment)</option>
                    <option value="WAIVE_SURCHARGE">Waive Surcharge (Cancel Fee)</option>
                    <option value="REFUND_SENDER">Refund Sender Credit</option>
                    <option value="ADJUST_PAYOUT">Adjust Carrier Payout</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                    Ruling Rationale (Mandatory)
                  </label>
                  <textarea
                    rows={3}
                    value={rulingNotes}
                    onChange={(e) => setRulingNotes(e.target.value)}
                    placeholder="Document basis of ruling based on GPS logs, geofence timestamps or POD..."
                    className="mt-1 w-full rounded-lg border border-clox-border p-2.5 text-xs text-clox-ink focus:border-clox-accent focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={!rulingNotes.trim() || resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate()}
                    className="w-full justify-center"
                  >
                    {resolveMutation.isPending ? 'Resolving...' : 'Confirm Binding Ruling'}
                  </Button>

                  {role === AdminRole.STATE_MASTER ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowEscalateModal(true)}
                      className="w-full justify-center text-xs"
                    >
                      Escalate to Super Admin ★
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Read-Only Status Card for Senders or Closed Disputes */}
          {isClosed ? (
            <div className="rounded-xl border border-clox-border bg-white p-5 shadow-sm text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-clox-ok" />
              <h3 className="mt-2 font-display text-base font-bold text-clox-ink">
                Dispute {dispute.status}
              </h3>
              <p className="mt-1 text-xs text-clox-mute">
                This dispute case has been concluded and the ruling recorded.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Escalation Modal */}
      {showEscalateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-clox-ink">
              {role === AdminRole.LOCAL_BDE
                ? 'Escalate Dispute to State Master'
                : 'Escalate Dispute to Super Admin (National)'}
            </h3>
            <p className="mt-1 text-xs text-clox-mute">
              Provide context and justification for escalating this case to higher governance.
            </p>

            <textarea
              rows={4}
              value={escalationNote}
              onChange={(e) => setEscalationNote(e.target.value)}
              placeholder="Explain why local/state resolution could not be achieved..."
              className="mt-3 w-full rounded-lg border border-clox-border p-3 text-xs text-clox-ink focus:border-clox-accent focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEscalateModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={escalateMutation.isPending}
                onClick={() =>
                  escalateMutation.mutate(
                    role === AdminRole.LOCAL_BDE ? 'STATE' : 'SUPER',
                  )
                }
              >
                {escalateMutation.isPending ? 'Escalating...' : 'Confirm Escalation'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
