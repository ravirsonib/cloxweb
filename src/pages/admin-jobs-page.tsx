import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  CardCollection,
  DataCard,
  DataTable,
  Money,
  Notice,
  PaginationBar,
  Select,
  StatusPill,
  ViewModeToggle,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import {
  getAdminJob,
  getErrorDetail,
  hardDeleteAdminJob,
  listAdminJobs,
  softDeleteAdminJob,
  type AdminJobListItem,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDollars } from '@/lib/currency';
import { formatDateTime } from '@/lib/leads';
import {
  assignmentStatusTone,
  jobStatusTone,
  tripStatusTone,
} from '@/lib/status-tone';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const JOB_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'BIDDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;

function estimateLabel(cents: number | null | undefined, dash: string) {
  if (cents == null) return dash;
  return formatDollars(cents);
}

export function AdminJobsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useDataViewMode('admin-jobs', 'list');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1') || 1;
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const [searchDraft, setSearchDraft] = useState(q);

  const query = useMemo(
    () => ({
      page,
      pageSize: 20,
      q: q || undefined,
      status: status || undefined,
    }),
    [page, q, status],
  );

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  }

  function applySearch() {
    updateFilter('q', searchDraft.trim());
  }

  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs', query],
    queryFn: ({ signal }) => listAdminJobs(query, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const hardDelete = useMutation({
    mutationFn: (id: string) => hardDeleteAdminJob(id),
    onSuccess: async () => {
      toast.success(t('adminJobs.hardDeleteSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) => softDeleteAdminJob(id),
    onSuccess: async () => {
      toast.success(t('adminJobs.softDeleteSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (jobsQuery.isLoading) return <LoadingBlock label={t('adminJobs.loadingList')} />;

  const items = jobsQuery.data?.items ?? [];
  const totalPages = jobsQuery.data?.totalPages ?? 1;

  async function onHardDelete(job: AdminJobListItem) {
    if (!job.canHardDelete) {
      toast.warn(t('adminJobs.hardDeleteDisabled'));
      return;
    }
    const ok = await confirm({
      title: t('adminJobs.hardDeleteTitle'),
      description: t('adminJobs.hardDeleteBody'),
      confirmLabel: t('adminJobs.hardDeleteConfirm'),
      tone: 'destructive',
    });
    if (ok) hardDelete.mutate(job.id);
  }

  async function onSoftDelete(job: AdminJobListItem) {
    if (!job.canSoftDelete) {
      toast.warn(t('adminJobs.softDeleteDisabled'));
      return;
    }
    const ok = await confirm({
      title: t('adminJobs.softDeleteTitle'),
      description: t('adminJobs.softDeleteBody'),
      confirmLabel: t('adminJobs.softDeleteConfirm'),
      tone: 'destructive',
    });
    if (ok) softDelete.mutate(job.id);
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('adminJobs.title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-clox-mute">
            {t('adminJobs.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] sm:items-end">
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search')}
          </span>
          <input
            className="clox-field-control"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch();
            }}
            placeholder={t('adminJobs.searchPlaceholder')}
          />
        </label>
        <Select
          className="mb-0"
          label={t('adminJobs.colStatus')}
          value={status}
          onChange={(e) => updateFilter('status', e.target.value)}
        >
          <option value="">{t('adminJobs.allStatuses')}</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button type="button" variant="primary" onClick={applySearch}>
          {t('search')}
        </Button>
      </div>

      {jobsQuery.isError ? (
        <Notice tone="error">
          {getErrorDetail(jobsQuery.error)}
        </Notice>
      ) : null}

      {/* Empty State */}
      {items.length === 0 && !jobsQuery.isError ? (
        <div className="mt-8">
          <EmptyBlock
            title={t('adminJobs.emptyTitle')}
            description={t('adminJobs.emptyHint')}
          />
        </div>
      ) : viewMode === 'grid' ? (
        /* ─── Grid View ─── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((job) => {
            const jobTitle = job.title || t('adminJobs.untitledJob', { defaultValue: 'Shipment' });
            return (
              <div
                key={job.id}
                className="group flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-clox-orange/60 hover:shadow-clox-2"
              >
                <div>
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/admin-jobs/${job.id}`}
                      className="font-display font-semibold text-clox-ink transition-colors hover:text-clox-orange"
                    >
                      {jobTitle}
                    </Link>
                    <StatusPill tone={jobStatusTone(job.status)}>
                      {job.status}
                    </StatusPill>
                  </div>

                  {/* Pricing Model & Class Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-clox-mute">
                    <span className="rounded bg-clox-surface-alt px-2 py-0.5 font-medium">
                      {job.pricingModel}
                    </span>
                    {job.proposalCount > 0 ? (
                      <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-clox-mute">
                        {t('adminJobs.proposals')}: {job.proposalCount}
                      </span>
                    ) : null}
                  </div>

                  {/* Sender Details */}
                  <div className="mt-3.5 flex items-center gap-2 text-xs text-clox-mute">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-clox-faint" />
                    <span className="truncate font-medium text-clox-ink">
                      {job.senderCompany.legalName}
                    </span>
                  </div>

                  {/* Assignment / Carrier */}
                  {job.assignment ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-clox-mute">
                      <Truck className="h-3.5 w-3.5 shrink-0 text-clox-faint" />
                      <span className="truncate">
                        {job.assignment.carrierCompany?.legalName || t('adminJobs.colAssignment')}
                      </span>
                      <StatusPill tone={assignmentStatusTone(job.assignment.status)}>
                        {job.assignment.status}
                      </StatusPill>
                    </div>
                  ) : null}

                  {/* Trip Execution Status */}
                  {job.trip?.status ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusPill tone={tripStatusTone(job.trip.status)}>
                        {t(`tripStatuses.${job.trip.status}`, {
                          defaultValue: job.trip.status,
                        })}
                      </StatusPill>
                      {job.trip.podAwaitingExit ? (
                        <StatusPill tone="info">
                          {t('adminJobs.podAwaitingExitPill')}
                        </StatusPill>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Financial & Created metadata */}
                  <div className="mt-4 border-t border-clox-border-soft pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-clox-mute">{t('adminJobs.colEstimate')}</span>
                      <span className="font-display text-base font-bold text-clox-ink">
                        {estimateLabel(job.estimateIncGstCents, t('dash'))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-clox-faint">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{formatDateTime(job.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-clox-border-soft pt-3">
                  <Link
                    to={`/admin-jobs/${job.id}`}
                    className="clox-btn clox-btn-primary inline-flex flex-1 items-center justify-center py-1.5 text-xs font-semibold"
                  >
                    {t('adminJobs.view')}
                  </Link>
                  <Button
                    type="button"
                    variant="warn"
                    size="sm"
                    disabled={!job.canSoftDelete || softDelete.isPending}
                    title={
                      job.canSoftDelete ? undefined : t('adminJobs.softDeleteDisabled')
                    }
                    onClick={() => void onSoftDelete(job)}
                  >
                    {t('adminJobs.softDelete')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!job.canHardDelete || hardDelete.isPending}
                    title={
                      job.canHardDelete ? undefined : t('adminJobs.hardDeleteDisabled')
                    }
                    onClick={() => void onHardDelete(job)}
                  >
                    {t('adminJobs.hardDelete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── List View ─── */
        <div>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <DataTable
              minWidthClassName="min-w-[62rem]"
              headers={[
                t('adminJobs.colJob'),
                t('adminJobs.colStatus'),
                t('adminJobs.colSender'),
                t('adminJobs.colAssignment'),
                t('adminJobs.colTrip'),
                t('adminJobs.colEstimate'),
                t('adminJobs.colCreated'),
                t('adminJobs.colActions'),
              ]}
            >
              {items.map((job) => {
                const jobTitle = job.title || t('adminJobs.untitledJob', { defaultValue: 'Shipment' });
                return (
                  <tr
                    key={job.id}
                    className="border-t border-clox-border-soft transition-colors hover:bg-clox-surface-alt/60"
                  >
                    {/* Job Title & Pricing */}
                    <td className="px-4 py-3.5">
                      <Link
                        to={`/admin-jobs/${job.id}`}
                        className="font-medium text-clox-orange hover:underline"
                      >
                        {jobTitle}
                      </Link>
                      <div className="mt-0.5 text-xs text-clox-mute">
                        {job.pricingModel}
                      </div>
                    </td>

                    {/* Job Status */}
                    <td className="px-4 py-3.5">
                      <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
                    </td>

                    {/* Sender Company */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-clox-ink">{job.senderCompany.legalName}</div>
                      <div className="text-xs text-clox-mute">{job.senderCompany.email || t('dash')}</div>
                    </td>

                    {/* Assignment */}
                    <td className="px-4 py-3.5">
                      {job.assignment ? (
                        <div className="space-y-1">
                          <StatusPill tone={assignmentStatusTone(job.assignment.status)}>
                            {job.assignment.status}
                          </StatusPill>
                          {job.assignment.carrierCompany ? (
                            <div className="text-xs text-clox-mute">
                              {job.assignment.carrierCompany.legalName}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-clox-faint">{t('dash')}</span>
                      )}
                    </td>

                    {/* Trip Status */}
                    <td className="px-4 py-3.5">
                      {job.trip?.status ? (
                        <div className="space-y-1">
                          <StatusPill tone={tripStatusTone(job.trip.status)}>
                            {t(`tripStatuses.${job.trip.status}`, {
                              defaultValue: job.trip.status,
                            })}
                          </StatusPill>
                          {job.trip.podAwaitingExit ? (
                            <StatusPill tone="info">
                              {t('adminJobs.podAwaitingExitPill')}
                            </StatusPill>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-clox-faint">{t('dash')}</span>
                      )}
                    </td>

                    {/* Estimate */}
                    <td className="px-4 py-3.5 font-medium text-clox-ink">
                      {estimateLabel(job.estimateIncGstCents, t('dash'))}
                    </td>

                    {/* Created Date */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-clox-mute">
                      {formatDateTime(job.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={`/admin-jobs/${job.id}`}
                          className="clox-btn clox-btn-primary inline-flex px-3 py-1.5 text-xs font-semibold"
                        >
                          {t('adminJobs.view')}
                        </Link>
                        <Button
                          type="button"
                          variant="warn"
                          size="sm"
                          disabled={!job.canSoftDelete || softDelete.isPending}
                          title={
                            job.canSoftDelete
                              ? undefined
                              : t('adminJobs.softDeleteDisabled')
                          }
                          onClick={() => void onSoftDelete(job)}
                        >
                          {t('adminJobs.softDelete')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={!job.canHardDelete || hardDelete.isPending}
                          title={
                            job.canHardDelete
                              ? undefined
                              : t('adminJobs.hardDeleteDisabled')
                          }
                          onClick={() => void onHardDelete(job)}
                        >
                          {t('adminJobs.hardDelete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </div>

          {/* Mobile Stacked Cards for List Mode */}
          <div className="md:hidden">
            <CardCollection>
              {items.map((job) => {
                const jobTitle = job.title || t('adminJobs.untitledJob', { defaultValue: 'Shipment' });
                return (
                  <DataCard key={job.id}>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/admin-jobs/${job.id}`}
                        className="font-medium text-clox-orange hover:underline"
                      >
                        {jobTitle}
                      </Link>
                      <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-clox-mute">
                      {job.senderCompany.legalName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {job.assignment ? (
                        <StatusPill tone={assignmentStatusTone(job.assignment.status)}>
                          {job.assignment.status}
                        </StatusPill>
                      ) : null}
                      {job.trip?.status ? (
                        <StatusPill tone={tripStatusTone(job.trip.status)}>
                          {t(`tripStatuses.${job.trip.status}`, {
                            defaultValue: job.trip.status,
                          })}
                        </StatusPill>
                      ) : null}
                      {job.trip?.podAwaitingExit ? (
                        <StatusPill tone="info">
                          {t('adminJobs.podAwaitingExitPill')}
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-clox-faint">
                      {estimateLabel(job.estimateIncGstCents, t('dash'))} ·{' '}
                      {formatDateTime(job.createdAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Link
                        to={`/admin-jobs/${job.id}`}
                        className="clox-btn clox-btn-primary inline-flex px-3 py-1.5 text-xs font-semibold"
                      >
                        {t('adminJobs.view')}
                      </Link>
                      <Button
                        type="button"
                        variant="warn"
                        size="sm"
                        disabled={!job.canSoftDelete || softDelete.isPending}
                        title={
                          job.canSoftDelete ? undefined : t('adminJobs.softDeleteDisabled')
                        }
                        onClick={() => void onSoftDelete(job)}
                      >
                        {t('adminJobs.softDelete')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={!job.canHardDelete || hardDelete.isPending}
                        title={
                          job.canHardDelete ? undefined : t('adminJobs.hardDeleteDisabled')
                        }
                        onClick={() => void onHardDelete(job)}
                      >
                        {t('adminJobs.hardDelete')}
                      </Button>
                    </div>
                  </DataCard>
                );
              })}
            </CardCollection>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {items.length > 0 ? (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => {
            const next = new URLSearchParams(searchParams);
            next.set('page', String(nextPage));
            setSearchParams(next);
          }}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Job Detail Page (Redesigned View Page)
// ─────────────────────────────────────────────────────────────────────────────

export function AdminJobDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ['admin', 'jobs', id],
    queryFn: ({ signal }) => getAdminJob(id, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN && Boolean(id),
  });

  const hardDelete = useMutation({
    mutationFn: () => hardDeleteAdminJob(id),
    onSuccess: async () => {
      toast.success(t('adminJobs.hardDeleteSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      window.location.href = '/admin-jobs';
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const softDelete = useMutation({
    mutationFn: () => softDeleteAdminJob(id),
    onSuccess: async () => {
      toast.success(t('adminJobs.softDeleteSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs', id] });
      await detail.refetch();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (detail.isLoading) return <LoadingBlock label={t('adminJobs.loadingDetail')} />;
  if (detail.isError || !detail.data) {
    return <Notice tone="error">{getErrorDetail(detail.error)}</Notice>;
  }

  const job = detail.data;
  const jobTitle = job.title || t('adminJobs.untitledJob', { defaultValue: 'Shipment' });

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          to="/admin-jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-clox-orange transition-colors hover:text-clox-orange-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('adminJobs.backToList')}
        </Link>
      </div>

      {/* Header Banner: Title, Badges, and Action Buttons */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
              {jobTitle}
            </h1>
            <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-clox-mute">
            <span className="rounded bg-clox-surface-alt px-2.5 py-1 font-semibold text-clox-ink">
              {job.pricingModel}
            </span>
            {job.minVehicleClass ? (
              <span className="rounded bg-clox-surface-alt px-2.5 py-1 text-clox-mute">
                {t('adminJobs.vehicle')}: {job.minVehicleClass}
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-clox-faint">
              <Calendar className="h-3.5 w-3.5" />
              {t('adminJobs.colCreated')}: {formatDateTime(job.createdAt)}
            </span>
          </div>
        </div>

        {/* Administrative Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="warn"
            disabled={!job.canSoftDelete || softDelete.isPending}
            title={job.canSoftDelete ? undefined : t('adminJobs.softDeleteDisabled')}
            onClick={() => {
              void (async () => {
                if (!job.canSoftDelete) {
                  toast.warn(t('adminJobs.softDeleteDisabled'));
                  return;
                }
                const ok = await confirm({
                  title: t('adminJobs.softDeleteTitle'),
                  description: t('adminJobs.softDeleteBody'),
                  confirmLabel: t('adminJobs.softDeleteConfirm'),
                  tone: 'destructive',
                });
                if (ok) softDelete.mutate();
              })();
            }}
          >
            {t('adminJobs.softDelete')}
          </Button>

          <Button
            type="button"
            variant="destructive"
            disabled={!job.canHardDelete || hardDelete.isPending}
            title={job.canHardDelete ? undefined : t('adminJobs.hardDeleteDisabled')}
            onClick={() => {
              void (async () => {
                if (!job.canHardDelete) {
                  toast.warn(t('adminJobs.hardDeleteDisabled'));
                  return;
                }
                const ok = await confirm({
                  title: t('adminJobs.hardDeleteTitle'),
                  description: t('adminJobs.hardDeleteBody'),
                  confirmLabel: t('adminJobs.hardDeleteConfirm'),
                  tone: 'destructive',
                });
                if (ok) hardDelete.mutate();
              })();
            }}
          >
            {t('adminJobs.hardDelete')}
          </Button>
        </div>
      </div>

      {/* POD Awaiting Exit Warning Alert Callout */}
      {job.trip?.podAwaitingExit ? (
        <div className="flex items-start gap-3 rounded-clox-md border border-amber-300 bg-amber-50/80 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold">{t('adminJobs.podAwaitingExitPill')}</p>
            <p className="text-amber-800">{t('adminJobs.podAwaitingExitHint')}</p>
          </div>
        </div>
      ) : null}

      {/* 4 Primary Operational Metric & Entity Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Financial Overview */}
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clox-mute">
            <DollarSign className="h-4 w-4 text-clox-orange" />
            {t('adminJobs.financials')}
          </div>
          <div className="mt-3">
            <div className="font-display text-2xl font-bold text-clox-ink">
              {estimateLabel(job.estimateIncGstCents, t('dash'))}
            </div>
            <p className="mt-1 text-xs text-clox-mute">
              {job.pricingModel} · {job.proposals?.length ?? 0} {t('adminJobs.proposals').toLowerCase()}
            </p>
          </div>
        </div>

        {/* 2. Sender Details */}
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clox-mute">
            <Building2 className="h-4 w-4 text-clox-orange" />
            {t('adminJobs.senderDetails')}
          </div>
          <div className="mt-3 space-y-1">
            <div className="truncate font-semibold text-clox-ink">
              {job.senderCompany.legalName}
            </div>
            <p className="truncate text-xs text-clox-mute">
              {job.senderCompany.email || t('dash')}
            </p>
            <div className="pt-1">
              <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-[11px] font-medium text-clox-mute">
                {job.senderCompany.type}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Carrier Assignment */}
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clox-mute">
            <Truck className="h-4 w-4 text-clox-orange" />
            {t('adminJobs.carrierAssignment')}
          </div>
          <div className="mt-3 space-y-1">
            {job.assignment ? (
              <>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-semibold text-clox-ink">
                    {job.assignment.carrierCompany?.legalName || t('adminJobs.colAssignment')}
                  </span>
                  <StatusPill tone={assignmentStatusTone(job.assignment.status)}>
                    {job.assignment.status}
                  </StatusPill>
                </div>
                {job.assignment.vehicle ? (
                  <p className="text-xs text-clox-mute">
                    {t('adminJobs.vehicle')}: {job.assignment.vehicle.registration} ({job.assignment.vehicle.vehicleClass})
                  </p>
                ) : null}
                {job.assignment.driver?.user?.name ? (
                  <p className="text-xs text-clox-mute">
                    {t('adminJobs.driver')}: {job.assignment.driver.user.name}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-clox-faint italic">
                {t('adminJobs.noCarrierAssigned')}
              </p>
            )}
          </div>
        </div>

        {/* 4. Trip Status */}
        <div className="rounded-clox-md border border-clox-border bg-clox-surface p-5 shadow-clox-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clox-mute">
            <ShieldCheck className="h-4 w-4 text-clox-orange" />
            {t('adminJobs.tripDetails')}
          </div>
          <div className="mt-3 space-y-1.5">
            {job.trip ? (
              <>
                <div className="flex items-center gap-1.5">
                  <StatusPill tone={tripStatusTone(job.trip.status)}>
                    {t(`tripStatuses.${job.trip.status}`, { defaultValue: job.trip.status })}
                  </StatusPill>
                </div>
                {job.trip.startedAt ? (
                  <p className="text-xs text-clox-mute">
                    Started: {formatDateTime(job.trip.startedAt)}
                  </p>
                ) : null}
                {job.trip.completedAt ? (
                  <p className="text-xs text-clox-mute">
                    Completed: {formatDateTime(job.trip.completedAt)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-clox-faint italic">{t('dash')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Route & Itinerary Stops */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <h2 className="font-display text-lg font-bold text-clox-ink">
          {t('adminJobs.routeStops')}
        </h2>
        <div className="mt-4 space-y-3">
          {(job.stops ?? []).length === 0 ? (
            <p className="text-sm text-clox-faint">{t('dash')}</p>
          ) : (
            job.stops.map((stop) => {
              const isPickup = stop.stopType === 'PICKUP';
              return (
                <div
                  key={stop.id}
                  className="relative flex items-start gap-4 rounded-clox-sm border border-clox-border-soft bg-clox-surface-alt/40 p-4 transition hover:bg-clox-surface-alt/80"
                >
                  {/* Sequence Marker Circle */}
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm',
                      isPickup ? 'bg-clox-navy-ink' : 'bg-clox-orange',
                    )}
                  >
                    {stop.sequence}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                          isPickup
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {stop.stopType}
                      </span>
                      <span className="font-medium text-clox-ink">
                        {stop.suburb ? `${stop.suburb}, ` : ''}{stop.state || ''} {stop.postcode || ''}
                      </span>
                    </div>

                    {stop.addressLine ? (
                      <p className="text-xs text-clox-mute">{stop.addressLine}</p>
                    ) : null}

                    {/* Receiver Contact Details (for drop-offs) */}
                    {(stop.receiverName || stop.receiverEmail) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 pt-1 text-xs text-clox-mute">
                        {stop.receiverName ? (
                          <span className="flex items-center gap-1 font-medium text-clox-ink">
                            <User className="h-3 w-3 text-clox-faint" />
                            {stop.receiverName}
                          </span>
                        ) : null}
                        {stop.receiverEmail ? (
                          <span>{stop.receiverEmail}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Carrier Proposals Table */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-clox-ink">
            {t('adminJobs.proposals')}
          </h2>
          <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-xs text-clox-mute">
            {job.proposals?.length ?? 0}
          </span>
        </div>

        {(job.proposals ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-clox-faint italic">
            {t('adminJobs.noProposals')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                  <th className="pb-2 font-medium">Carrier</th>
                  <th className="pb-2 font-medium">{t('adminJobs.colStatus')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.amount')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.eta')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.colCreated')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border-soft">
                {job.proposals.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-clox-surface-alt/50">
                    <td className="py-2.5 font-medium text-clox-ink">
                      {proposal.carrierCompany.legalName}
                    </td>
                    <td className="py-2.5">
                      <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-xs font-semibold">
                        {proposal.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-clox-ink">
                      <Money cents={proposal.amountIncGstCents} />
                    </td>
                    <td className="py-2.5 text-xs text-clox-mute">
                      {proposal.etaMinutes ? `${proposal.etaMinutes} mins` : t('dash')}
                    </td>
                    <td className="py-2.5 text-xs text-clox-mute">
                      {formatDateTime(proposal.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment & Escrow Events */}
      <div className="rounded-clox-md border border-clox-border bg-clox-surface p-6 shadow-clox-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-clox-ink">
            {t('adminJobs.payments')}
          </h2>
          <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-xs text-clox-mute">
            {job.paymentEvents?.length ?? 0}
          </span>
        </div>

        {(job.paymentEvents ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-clox-faint italic">
            {t('adminJobs.noPayments')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border-soft text-xs text-clox-mute">
                  <th className="pb-2 font-medium">{t('adminJobs.colStatus')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.amount')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.stripeRef')}</th>
                  <th className="pb-2 font-medium">{t('adminJobs.colCreated')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clox-border-soft">
                {job.paymentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-clox-surface-alt/50">
                    <td className="py-2.5">
                      <span className="rounded bg-clox-surface-alt px-2 py-0.5 text-xs font-semibold text-clox-ink">
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-clox-ink">
                      <Money cents={evt.amountIncGstCents} />
                    </td>
                    <td className="py-2.5 font-mono text-xs text-clox-mute">
                      {evt.stripePaymentIntentId || t('dash')}
                    </td>
                    <td className="py-2.5 text-xs text-clox-mute">
                      {formatDateTime(evt.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
