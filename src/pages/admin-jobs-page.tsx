import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  CardCollection,
  DataCard,
  DataTable,
  Notice,
  ResponsiveDataView,
  Select,
  StatusPill,
  useConfirm,
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
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminJobsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
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
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
        {t('adminJobs.title')}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-clox-mute">{t('adminJobs.subtitle')}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] sm:items-end">
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
        <Notice tone="error" className="mt-4">
          {getErrorDetail(jobsQuery.error)}
        </Notice>
      ) : null}

      {items.length === 0 && !jobsQuery.isError ? (
        <div className="mt-8">
          <EmptyBlock
            title={t('adminJobs.emptyTitle')}
            description={t('adminJobs.emptyHint')}
          />
        </div>
      ) : (
        <div className="mt-6">
          <ResponsiveDataView
            cards={
              <CardCollection>
                {items.map((job) => (
                  <DataCard key={job.id}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/admin-jobs/${job.id}`}
                          className="font-medium text-clox-orange hover:underline"
                        >
                          {job.title ?? job.id.slice(0, 8)}
                        </Link>
                        <div className="truncate font-mono text-[11px] text-clox-faint">
                          {job.id}
                        </div>
                      </div>
                      <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
                    </div>
                    <p className="mt-2 truncate text-sm text-clox-mute">
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
                          {job.trip.status}
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
                        className="clox-btn clox-btn-primary inline-flex px-3 py-1.5 text-[12.5px]"
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
                ))}
              </CardCollection>
            }
            table={
              <DataTable
                minWidthClassName="min-w-[64rem]"
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
                {items.map((job) => (
                  <tr
                    key={job.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin-jobs/${job.id}`}
                        className="font-medium text-clox-orange hover:underline"
                      >
                        {job.title ?? job.id.slice(0, 8)}
                      </Link>
                      <div className="font-mono text-[11px] text-clox-faint">{job.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <div>{job.senderCompany.legalName}</div>
                      <div className="text-xs text-clox-mute">{job.senderCompany.email}</div>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      {job.trip?.status ? (
                        <StatusPill tone={tripStatusTone(job.trip.status)}>
                          {job.trip.status}
                        </StatusPill>
                      ) : (
                        <span className="text-sm text-clox-faint">{t('dash')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {estimateLabel(job.estimateIncGstCents, t('dash'))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-clox-mute">
                      {formatDateTime(job.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          to={`/admin-jobs/${job.id}`}
                          className="clox-btn clox-btn-primary inline-flex px-3 py-1.5 text-[12.5px]"
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
                ))}
              </DataTable>
            }
          />
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('page', String(page - 1));
              setSearchParams(next);
            }}
          >
            {t('prev', { defaultValue: 'Prev' })}
          </Button>
          <span className="order-first w-full text-center text-sm text-clox-mute sm:order-none sm:w-auto">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('page', String(page + 1));
              setSearchParams(next);
            }}
          >
            {t('next', { defaultValue: 'Next' })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

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

  return (
    <div>
      <Link to="/admin-jobs" className="text-sm text-clox-orange hover:underline">
        ← {t('adminJobs.backToList')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink">
        {job.title ?? t('adminJobs.detailTitle')}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-clox-mute">
        <StatusPill tone={jobStatusTone(job.status)}>{job.status}</StatusPill>
        <span className="font-mono">
          {job.pricingModel} · {job.id}
        </span>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-clox-mute">
        <li>
          {job.senderCompany.legalName} · {job.senderCompany.email}
        </li>
        <li>
          {t('jobs.receiverName')}: {job.receiverName ?? t('dash')} · {job.receiverEmail ?? t('dash')}
        </li>
        <li>
          {t('adminJobs.colEstimate')}:{' '}
          {estimateLabel(job.estimateIncGstCents, t('dash'))}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>{t('adminJobs.colAssignment')}:</span>
          {job.assignment ? (
            <>
              <StatusPill tone={assignmentStatusTone(job.assignment.status)}>
                {job.assignment.status}
              </StatusPill>
              {job.assignment.carrierCompany ? (
                <span>{job.assignment.carrierCompany.legalName}</span>
              ) : null}
            </>
          ) : (
            <span>{t('dash')}</span>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>{t('adminJobs.colTrip')}:</span>
          {job.trip?.status ? (
            <StatusPill tone={tripStatusTone(job.trip.status)}>{job.trip.status}</StatusPill>
          ) : (
            <span>{t('dash')}</span>
          )}
        </li>
        <li>
          {t('adminJobs.colCreated')}: {formatDateTime(job.createdAt)}
        </li>
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="warn"
          disabled={!job.canSoftDelete || softDelete.isPending}
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

      <h2 className="mt-8 font-display text-lg font-semibold">{t('adminJobs.stops')}</h2>
      <ul className="mt-2 space-y-1 text-sm text-clox-mute">
        {(job.stops ?? []).map((s) => (
          <li key={s.id}>
            {s.sequence}. {s.stopType} · {s.suburb ?? t('dash')}, {s.state ?? ''} ·{' '}
            {s.addressLine ?? ''}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-lg font-semibold">{t('adminJobs.proposals')}</h2>
      {(job.proposals ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-clox-faint">{t('dash')}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-clox-mute">
          {job.proposals.map((p) => (
            <li key={p.id}>
              {p.carrierCompany.legalName} · {p.status} · $
              {(p.amountIncGstCents / 100).toFixed(2)}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold">{t('adminJobs.payments')}</h2>
      {(job.paymentEvents ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-clox-faint">{t('dash')}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-clox-mute">
          {job.paymentEvents.map((p) => (
            <li key={p.id}>
              {p.status} · ${(p.amountIncGstCents / 100).toFixed(2)} ·{' '}
              {p.stripePaymentIntentId ?? t('dash')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
