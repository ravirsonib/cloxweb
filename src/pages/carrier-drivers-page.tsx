import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  ActionGroup,
  Button,
  DataCardList,
  DataTable,
  EmailLink,
  Field,
  Notice,
  PaginationBar,
  ResponsiveDataView,
  Select,
  StatusPill,
  dataCardClassName,
  useClientPagination,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  createDriverScheduleByCarrier,
  deleteCarrierDriver,
  disableCarrierDriver,
  getErrorDetail,
  getIdentityMe,
  getCarrierFleetSchedule,
  inviteCarrierDriver,
  listCarrierDrivers,
  listDocuments,
  openDocumentContent,
  reactivateCarrierDriver,
  resendCarrierDriverInvite,
  reviewDriverSchedule,
  type CarrierDriverListItem,
  type DriverScheduleEntryItem,
} from '@/lib/api';
import { formatCalendarDate, formatDateTime } from '@/lib/datetime';

type InviteForm = {
  name: string;
  email: string;
};

type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

function driverStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
      return 'ok';
    case 'INVITED':
      return 'info';
    case 'PENDING_REVIEW':
      return 'warn';
    case 'SUSPENDED':
    case 'DISABLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function activityStatusTone(activity: string): StatusTone {
  switch (activity) {
    case 'ON_BREAK':
      return 'warn';
    case 'BREAKDOWN':
      return 'danger';
    case 'PENDING_GATES':
      return 'info';
    case 'EN_ROUTE_PICKUP':
    case 'AT_PICKUP':
    case 'IN_TRANSIT':
    case 'AT_DROPOFF':
      return 'ok';
    default:
      return 'info';
  }
}

export function CarrierDriversPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [disableTarget, setDisableTarget] = useState<CarrierDriverListItem | null>(null);
  const [docsTarget, setDocsTarget] = useState<CarrierDriverListItem | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{
    inviteUrl: string;
    debugToken?: string;
    mailSkipped: boolean;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'drivers' | 'schedule'>('drivers');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDriverId, setSchedDriverId] = useState('');
  const [schedType, setSchedType] = useState('ANNUAL_LEAVE');
  const [schedStartAt, setSchedStartAt] = useState('');
  const [schedEndAt, setSchedEndAt] = useState('');
  const [schedReason, setSchedReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<DriverScheduleEntryItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const meQuery = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
  });
  const companyId = meQuery.data?.company?.id ?? null;

  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  const driverDocsQuery = useQuery({
    queryKey: ['documents', 'list', companyId, docsTarget?.id],
    queryFn: () =>
      listDocuments({ companyId: companyId!, driverId: docsTarget!.id }),
    enabled: Boolean(companyId && docsTarget?.id),
  });

  const fleetScheduleQuery = useQuery({
    queryKey: ['carrier', 'fleet', 'schedule'],
    queryFn: () => getCarrierFleetSchedule(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const scheduleItems = fleetScheduleQuery.data ?? [];
  const pendingSchedulesCount = scheduleItems.filter((s) => s.status === 'PENDING').length;
  const pagedSchedules = useClientPagination(scheduleItems);

  const createScheduleMutation = useMutation({
    mutationFn: (payload: {
      driverId: string;
      type: string;
      startAt: string;
      endAt: string;
      reason?: string;
    }) => createDriverScheduleByCarrier(payload),
    onSuccess: async () => {
      toast.success(
        t('drivers.scheduleCreated', {
          defaultValue: 'Schedule block-out created successfully',
        }),
      );
      setShowScheduleModal(false);
      setSchedDriverId('');
      setSchedStartAt('');
      setSchedEndAt('');
      setSchedReason('');
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet', 'schedule'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const reviewScheduleMutation = useMutation({
    mutationFn: ({
      id,
      status,
      rejectionReason,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      rejectionReason?: string;
    }) => reviewDriverSchedule(id, { status, rejectionReason }),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === 'APPROVED'
          ? t('drivers.scheduleApproved', { defaultValue: 'Time-off request approved' })
          : t('drivers.scheduleRejected', { defaultValue: 'Time-off request rejected' }),
      );
      setRejectTarget(null);
      setRejectionReason('');
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet', 'schedule'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const handleApproveSchedule = async (item: DriverScheduleEntryItem) => {
    const ok = await confirm({
      title: t('confirm.approveScheduleTitle', { defaultValue: 'Approve Time-Off Request' }),
      description: t('confirm.approveScheduleBody', {
        defaultValue: `Approve time-off for ${item.driver?.user?.name || 'this driver'} from ${formatDateTime(item.startAt)} to ${formatDateTime(item.endAt)}? The driver will be marked unavailable for job matching during this window.`,
      }),
      confirmLabel: t('confirm.approve', { defaultValue: 'Approve Request' }),
    });
    if (ok) {
      await reviewScheduleMutation.mutateAsync({ id: item.id, status: 'APPROVED' });
    }
  };

  const handleOpenRejectModal = (item: DriverScheduleEntryItem) => {
    setRejectTarget(item);
    setRejectionReason('');
  };

  const handleConfirmRejectSchedule = async () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      toast.error(
        t('drivers.rejectionReasonRequired', { defaultValue: 'A rejection reason is required.' }),
      );
      return;
    }
    const ok = await confirm({
      title: t('confirm.rejectScheduleTitle', { defaultValue: 'Reject Time-Off Request' }),
      description: t('confirm.rejectScheduleBody', {
        defaultValue: `Reject time-off request for ${rejectTarget.driver?.user?.name || 'this driver'} with note: "${rejectionReason.trim()}"?`,
      }),
      confirmLabel: t('confirm.reject', { defaultValue: 'Reject' }),
      tone: 'destructive',
    });
    if (ok) {
      await reviewScheduleMutation.mutateAsync({
        id: rejectTarget.id,
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
    }
  };

  const handleCreateScheduleSubmit = async () => {
    if (!schedDriverId) {
      toast.error(t('drivers.selectDriverRequired', { defaultValue: 'Please select a driver.' }));
      return;
    }
    if (!schedStartAt || !schedEndAt) {
      toast.error(
        t('drivers.datesRequired', {
          defaultValue: 'Please provide both start and end date/time.',
        }),
      );
      return;
    }
    const start = new Date(schedStartAt);
    const end = new Date(schedEndAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      toast.error(
        t('drivers.startBeforeEnd', {
          defaultValue: 'Start time must be before end time.',
        }),
      );
      return;
    }

    const selectedDrv = items.find((d) => d.id === schedDriverId);
    const ok = await confirm({
      title: t('confirm.createScheduleTitle', { defaultValue: 'Confirm Schedule Block-out' }),
      description: t('confirm.createScheduleBody', {
        defaultValue: `Block out schedule for ${selectedDrv?.user?.name || selectedDrv?.user?.email || 'selected driver'} from ${formatDateTime(start)} to ${formatDateTime(end)}? This will auto-approve the block-out.`,
      }),
      confirmLabel: t('confirm.confirmBlockout', { defaultValue: 'Create Block-out' }),
    });
    if (ok) {
      await createScheduleMutation.mutateAsync({
        driverId: schedDriverId,
        type: schedType,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        reason: schedReason.trim() || undefined,
      });
    }
  };

  const schema = z.object({
    name: z.string().trim().min(2, t('validation.nameRequired')),
    email: z.string().trim().email(t('validation.emailInvalid')),
  });

  const form = useForm<InviteForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['carrier', 'drivers'] });

  const inviteMutation = useMutation({
    mutationFn: (values: InviteForm) =>
      inviteCarrierDriver({ email: values.email, name: values.name }),
    onSuccess: async (res) => {
      if (res.invite) {
        setLastInvite({
          inviteUrl: res.invite.inviteUrl,
          debugToken: res.invite.debugToken,
          mailSkipped: res.invite.mailSkipped,
        });
      }
      form.reset({ name: '', email: '' });
      setShowForm(false);
      toast.success(t('drivers.inviteSuccess'));
      await invalidate();
    },
  });

  const resendMutation = useMutation({
    mutationFn: (driverId: string) => resendCarrierDriverInvite(driverId),
    onSuccess: (res) => {
      setLastInvite({
        inviteUrl: res.inviteUrl,
        debugToken: res.debugToken,
        mailSkipped: res.mailSkipped,
      });
      toast.success(t('drivers.resendSuccess'));
    },
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      disableCarrierDriver(disableTarget!.id, {
        reason: reason.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      setDisableTarget(null);
      setReason('');
      setNote('');
      setActionError(null);
      toast.success(t('drivers.disableSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateCarrierDriver(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('drivers.reactivateSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarrierDriver(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('drivers.deleteSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const items = driversQuery.data?.items ?? [];
  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedDrivers,
  } = useClientPagination(items, 10);
  const inviting = inviteMutation.isPending;
  const busy =
    inviting ||
    disableMutation.isPending ||
    reactivateMutation.isPending ||
    resendMutation.isPending ||
    deleteMutation.isPending;

  function statusLabel(status: string) {
    return t(`drivers.statuses.${status}`, { defaultValue: status });
  }

  function activityLabel(activity: string) {
    return t(`drivers.activity.${activity}`, { defaultValue: activity });
  }

  async function onReactivate(row: CarrierDriverListItem) {
    const ok = await confirm({
      title: t('drivers.reactivateTitle'),
      description: t('drivers.reactivateBody', {
        name: row.user.name ?? row.user.email,
      }),
      confirmLabel: t('drivers.reactivate'),
    });
    if (!ok) return;
    reactivateMutation.mutate(row.id);
  }

  async function onDelete(row: CarrierDriverListItem) {
    const ok = await confirm({
      title: t('drivers.deleteTitle'),
      description: t('drivers.deleteBody', {
        name: row.user.name ?? row.user.email,
      }),
      confirmLabel: t('drivers.deleteConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  function renderStatus(row: CarrierDriverListItem) {
    const activity = row.activityStatus ?? null;
    const tripLabel =
      row.currentTrip?.jobTitle?.trim() ||
      (row.currentTrip?.jobId ? row.currentTrip.jobId.slice(0, 8) : null);
    const activeLeave = scheduleItems.find(
      (s) =>
        s.driverId === row.id &&
        s.status === 'APPROVED' &&
        new Date(s.startAt).getTime() <= Date.now() &&
        new Date(s.endAt).getTime() >= Date.now(),
    );
    return (
      <div className="flex min-w-[9.5rem] max-w-[15rem] flex-col items-start gap-1">
        {activeLeave ? (
          <StatusPill tone="warn" className="max-w-full">
            <span className="truncate">{activeLeave.type.replace(/_/g, ' ')} (On Leave)</span>
          </StatusPill>
        ) : null}
        {activity ? (
          <>
            <StatusPill tone={activityStatusTone(activity)} className="max-w-full">
              <span className="truncate">{activityLabel(activity)}</span>
            </StatusPill>
            <p className="text-[11px] leading-tight text-clox-mute">
              {t('drivers.accountStatus', { status: statusLabel(row.status) })}
            </p>
          </>
        ) : (
          <StatusPill tone={driverStatusTone(row.status)} className="max-w-full">
            <span className="truncate">{statusLabel(row.status)}</span>
          </StatusPill>
        )}
        {tripLabel ? (
          <p className="w-full truncate text-[11px] leading-tight text-clox-faint" title={tripLabel}>
            {tripLabel}
          </p>
        ) : null}
        {typeof row.reliabilityScore === 'number' ? (
          <StatusPill tone="info" className="max-w-full">
            {t('drivers.reliabilityScore', { score: row.reliabilityScore })}
          </StatusPill>
        ) : null}
      </div>
    );
  }

  function licenceExpiryTone(expiry: string | null): StatusTone {
    if (!expiry) return 'warn';
    const ms = new Date(expiry).getTime() - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return 'danger';
    if (ms <= 30 * 24 * 60 * 60 * 1000) return 'warn';
    return 'ok';
  }

  function renderLicenceExpiry(row: CarrierDriverListItem) {
    if (!row.licenceExpiry) {
      return <StatusPill tone="warn">{t('drivers.licenceMissing')}</StatusPill>;
    }
    const date = formatCalendarDate(row.licenceExpiry);
    const tone = licenceExpiryTone(row.licenceExpiry);
    const key =
      tone === 'danger'
        ? 'drivers.licenceExpired'
        : tone === 'warn'
          ? 'drivers.licenceExpiring'
          : 'drivers.licenceOk';
    return <StatusPill tone={tone}>{t(key, { date })}</StatusPill>;
  }

  async function viewDriverDoc(documentId: string) {
    setOpeningDocId(documentId);
    try {
      await openDocumentContent(documentId);
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setOpeningDocId(null);
    }
  }

  function renderActions(row: CarrierDriverListItem) {
    const isSuspended = row.status === 'SUSPENDED' || row.status === 'DISABLED';
    return (
      <ActionGroup className="max-w-full flex-wrap sm:flex-nowrap">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => setDocsTarget(row)}
        >
          {t('drivers.documents')}
        </Button>
        {isSuspended ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('drivers.reactivate')}
          </Button>
        ) : null}
        {!isSuspended && row.status === 'INVITED' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => resendMutation.mutate(row.id)}
          >
            {t('carrierOnboarding.resend')}
          </Button>
        ) : null}
        {!isSuspended && row.status !== 'INVITED' ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              setActionError(null);
              setReason('');
              setNote('');
              setDisableTarget(row);
            }}
          >
            {t('drivers.disable')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={isSuspended ? 'destructive' : 'ghost'}
          size="sm"
          disabled={busy}
          onClick={() => void onDelete(row)}
        >
          {t('drivers.delete')}
        </Button>
      </ActionGroup>
    );
  }

  return (
    <div className="relative" aria-busy={busy || undefined}>
      {inviting ? (
        <div
          className="clox-dialog-backdrop"
          role="status"
          aria-live="polite"
          aria-label={t('drivers.inviting')}
        >
          <div className="clox-dialog max-w-sm">
            <LoadingBlock label={t('drivers.inviting')} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('drivers.title')}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-clox-mute">
            <span>
              {t('drivers.subtitle')} · {t('totalCount', { count: items.length })}
            </span>
            {typeof meQuery.data?.company?.reliabilityScore === 'number' ? (
              <StatusPill tone="info">
                {t('companies.reliabilityScore', {
                  score: meQuery.data.company.reliabilityScore,
                })}
              </StatusPill>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <span
              className="clox-btn clox-btn-secondary inline-flex cursor-not-allowed items-center opacity-50"
              aria-disabled="true"
            >
              {t('drivers.manageFleet')}
            </span>
          ) : (
            <Link
              to="/carrier/fleet"
              className="clox-btn clox-btn-secondary inline-flex items-center"
            >
              {t('drivers.manageFleet')}
            </Link>
          )}
          {activeTab === 'drivers' ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => setShowForm((open) => !open)}
            >
              {showForm ? t('cancel') : t('drivers.inviteDriver')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowScheduleModal(true)}
            >
              {t('drivers.btnAddSchedule', { defaultValue: '+ Schedule Block-out' })}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 mb-6 flex border-b border-clox-border">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'drivers'
              ? 'border-clox-orange text-clox-ink font-bold'
              : 'border-transparent text-clox-mute hover:text-clox-ink'
          }`}
          onClick={() => setActiveTab('drivers')}
        >
          {t('drivers.tabDrivers', { defaultValue: 'All Drivers' })} ({items.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'border-clox-orange text-clox-ink font-bold'
              : 'border-transparent text-clox-mute hover:text-clox-ink'
          }`}
          onClick={() => setActiveTab('schedule')}
        >
          {t('drivers.tabSchedule', { defaultValue: 'Schedule & Time-Off' })}
          {pendingSchedulesCount > 0 ? (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-xs font-bold text-amber-600 dark:text-amber-400">
              {pendingSchedulesCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeTab === 'drivers' ? (
        <>
          {actionError ? (
            <Notice tone="error" className="mt-4">
              {actionError}
            </Notice>
          ) : null}

      {items.some((d) => d.status === 'PENDING_REVIEW') ? (
        <Notice tone="info" className="mt-4">
          {t('drivers.pendingReviewHint')}
        </Notice>
      ) : null}

      {showForm ? (
        <form
          className="clox-card mt-6 p-4 sm:p-5"
          onSubmit={form.handleSubmit((values) => {
            if (busy) return;
            inviteMutation.mutate(values);
          })}
          noValidate
        >
          <fieldset disabled={busy} className="min-w-0 border-0 p-0">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('drivers.inviteTitle')}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">{t('carrierOnboarding.driversHint')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label={t('carrierOnboarding.placeholderDriverName')}
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />
              <Field
                type="email"
                label={t('carrierOnboarding.placeholderDriverEmail')}
                error={form.formState.errors.email?.message}
                {...form.register('email')}
              />
            </div>
            {inviteMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(inviteMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-4">
              <Button type="submit" variant="cta" disabled={busy}>
                {inviting ? t('drivers.inviting') : t('drivers.inviteDriver')}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : null}

      {lastInvite ? (
        <Notice tone="info" className="mt-4">
          <p className="font-semibold">{t('carrierOnboarding.inviteUrlLabel')}</p>
          <p className="mt-1 break-all text-sm">{lastInvite.inviteUrl}</p>
          {lastInvite.mailSkipped && lastInvite.debugToken ? (
            <p className="mt-1 text-sm">
              {t('carrierOnboarding.smtpSkippedDebugToken', {
                token: lastInvite.debugToken,
              })}
            </p>
          ) : null}
        </Notice>
      ) : null}

      {driversQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {driversQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(driversQuery.error)}
        </Notice>
      ) : null}

      {resendMutation.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(resendMutation.error)}
        </Notice>
      ) : null}

      {!driversQuery.isLoading && !driversQuery.isError ? (
        items.length === 0 ? (
          <div className="mt-6">
            <EmptyBlock title={t('drivers.emptyTitle')} description={t('drivers.emptyHint')} />
          </div>
        ) : (
          <>
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={pagedDrivers}
                  getKey={(row) => row.id}
                  renderItem={(row) => (
                    <div className={dataCardClassName}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-clox-ink">
                            {row.user.name ?? t('dash')}
                          </p>
                          <EmailLink email={row.user.email} maxWidthClassName="max-w-[200px]" />
                        </div>
                        <div className="shrink-0">{renderLicenceExpiry(row)}</div>
                      </div>
                      <div className="mt-3">{renderStatus(row)}</div>
                      {row.disabledReason ? (
                        <p className="mt-2 text-xs text-clox-mute">
                          {t('drivers.reasonLabel')}: {row.disabledReason}
                        </p>
                      ) : null}
                      <div className="mt-3 overflow-x-auto">{renderActions(row)}</div>
                    </div>
                  )}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[72rem]"
                  headers={[
                    t('drivers.colName'),
                    t('drivers.colEmail'),
                    t('drivers.colLicence'),
                    t('drivers.colLicenceExpiry'),
                    t('drivers.colStatus'),
                    t('drivers.colReason'),
                    t('drivers.colActions'),
                  ]}
                  headerClassNames={[
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    'text-right',
                  ]}
                >
                  {pagedDrivers.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-4 py-3 align-top text-clox-ink">
                        {row.user.name ?? t('dash')}
                      </td>
                      <td className="px-4 py-3 align-top text-clox-mute">
                        <EmailLink email={row.user.email} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-clox-mute">
                        {row.licenceNo ?? t('dash')}
                        {row.licenceClass ? ` · ${row.licenceClass}` : ''}
                      </td>
                      <td className="px-4 py-3 align-top">{renderLicenceExpiry(row)}</td>
                      <td className="px-4 py-3 align-top">{renderStatus(row)}</td>
                      <td className="max-w-[12rem] px-4 py-3 align-top text-xs text-clox-mute">
                        {row.disabledReason ? (
                          <span className="line-clamp-2" title={row.disabledReason}>
                            {row.disabledReason}
                          </span>
                        ) : (
                          t('dash')
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">{renderActions(row)}</td>
                    </tr>
                  ))}
                </DataTable>
              }
            />
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )
      ) : null}
      </>
      ) : (
        <div className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('drivers.fleetScheduleTitle', { defaultValue: 'Fleet Driver Schedules & Time-Off' })}
              </h2>
              <p className="text-xs text-clox-mute">
                {t('drivers.fleetScheduleSubtitle', {
                  defaultValue: 'Review pending driver time-off requests or directly block out scheduled leave.',
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowScheduleModal(true)}
            >
              {t('drivers.btnAddSchedule', { defaultValue: '+ Schedule Block-out' })}
            </Button>
          </div>

          {fleetScheduleQuery.isLoading ? (
            <LoadingBlock label={t('loading')} />
          ) : fleetScheduleQuery.isError ? (
            <Notice tone="error">{getErrorDetail(fleetScheduleQuery.error)}</Notice>
          ) : scheduleItems.length === 0 ? (
            <EmptyBlock
              title={t('drivers.scheduleEmptyTitle', { defaultValue: 'No schedule entries found' })}
              description={t('drivers.scheduleEmptyDesc', {
                defaultValue: 'No scheduled leaves, rostered off days, or time-off requests recorded for your fleet.',
              })}
            />
          ) : (
            <>
              <ResponsiveDataView
                className="mt-4"
                cards={
                  <DataCardList
                    items={pagedSchedules.pagedItems}
                    getKey={(row) => row.id}
                    renderItem={(row) => (
                      <div className={dataCardClassName}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-clox-ink">
                              {row.driver?.user?.name || row.driver?.user?.email || 'Driver'}
                            </p>
                            <p className="text-xs text-clox-mute">
                              {row.driver?.user?.email} · {row.driver?.licenceClass || 'Licence'}
                            </p>
                          </div>
                          <StatusPill
                            tone={
                              row.status === 'APPROVED'
                                ? 'ok'
                                : row.status === 'PENDING'
                                  ? 'warn'
                                  : row.status === 'REJECTED'
                                    ? 'danger'
                                    : 'neutral'
                            }
                          >
                            {row.status}
                          </StatusPill>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="font-medium text-clox-ink">
                            <span className="text-clox-mute">Window:</span> {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                          </p>
                          <p className="mt-1 text-clox-mute">
                            <span className="font-semibold text-clox-ink">Type:</span> {row.type.replace(/_/g, ' ')}
                            {row.reason ? ` · ${row.reason}` : ''}
                          </p>
                        </div>
                        {row.rejectionReason ? (
                          <p className="mt-1 text-xs text-clox-danger font-medium">
                            Note: {row.rejectionReason}
                          </p>
                        ) : null}
                        {row.status === 'PENDING' ? (
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={reviewScheduleMutation.isPending}
                              onClick={() => void handleApproveSchedule(row)}
                            >
                              {t('drivers.scheduleApprove', { defaultValue: 'Approve' })}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={reviewScheduleMutation.isPending}
                              onClick={() => handleOpenRejectModal(row)}
                            >
                              {t('drivers.scheduleReject', { defaultValue: 'Reject' })}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  />
                }
                table={
                  <DataTable
                    minWidthClassName="min-w-[64rem]"
                    headers={[
                      t('drivers.scheduleColDriver', { defaultValue: 'Driver' }),
                      t('drivers.scheduleColType', { defaultValue: 'Type' }),
                      t('drivers.scheduleColDates', { defaultValue: 'Time Window' }),
                      t('drivers.scheduleColStatus', { defaultValue: 'Status' }),
                      t('drivers.scheduleColReason', { defaultValue: 'Reason / Note' }),
                      t('drivers.scheduleColActions', { defaultValue: 'Actions' }),
                    ]}
                    headerClassNames={[
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      'text-right',
                    ]}
                  >
                    {pagedSchedules.pagedItems.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                      >
                        <td className="px-4 py-3 align-top text-clox-ink">
                          <p className="font-semibold">{row.driver?.user?.name || row.driver?.user?.email || 'Driver'}</p>
                          <p className="text-xs text-clox-mute">{row.driver?.user?.email} · {row.driver?.licenceClass || 'Licence'}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusPill tone={row.type === 'OVERTIME_AVAILABLE' ? 'ok' : 'info'}>
                            {row.type.replace(/_/g, ' ')}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <p className="font-medium text-clox-ink">{formatDateTime(row.startAt)} →</p>
                          <p className="text-clox-mute">{formatDateTime(row.endAt)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusPill
                            tone={
                              row.status === 'APPROVED'
                                ? 'ok'
                                : row.status === 'PENDING'
                                  ? 'warn'
                                  : row.status === 'REJECTED'
                                    ? 'danger'
                                    : 'neutral'
                            }
                          >
                            {row.status}
                          </StatusPill>
                          {row.rejectionReason ? (
                            <p className="text-[11px] text-clox-danger mt-0.5 truncate max-w-[12rem]" title={row.rejectionReason}>
                              {row.rejectionReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 align-top text-xs text-clox-mute">
                          <span className="line-clamp-2" title={row.reason || row.notes || undefined}>
                            {row.reason || row.notes || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          {row.status === 'PENDING' ? (
                            <ActionGroup>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={reviewScheduleMutation.isPending}
                                onClick={() => void handleApproveSchedule(row)}
                              >
                                {t('drivers.scheduleApprove', { defaultValue: 'Approve' })}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={reviewScheduleMutation.isPending}
                                onClick={() => handleOpenRejectModal(row)}
                              >
                                {t('drivers.scheduleReject', { defaultValue: 'Reject' })}
                              </Button>
                            </ActionGroup>
                          ) : (
                            <span className="text-xs text-clox-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                }
              />
              <PaginationBar
                page={pagedSchedules.page}
                totalPages={pagedSchedules.totalPages}
                onPageChange={pagedSchedules.setPage}
              />
            </>
          )}
        </div>
      )}

      {disableTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !disableMutation.isPending) {
              setDisableTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('drivers.disableTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('drivers.disableBody', {
                name: disableTarget.user.name ?? disableTarget.user.email,
              })}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('drivers.reasonLabel')}
              </span>
              <textarea
                className="clox-field-control min-h-[4.5rem]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('drivers.reasonPlaceholder')}
                maxLength={500}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('drivers.noteLabel')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('drivers.notePlaceholder')}
                maxLength={2000}
              />
            </label>
            {disableMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(disableMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={disableMutation.isPending}
                onClick={() => setDisableTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disableMutation.isPending || reason.trim().length < 3}
                onClick={() => disableMutation.mutate()}
              >
                {disableMutation.isPending ? t('loading') : t('drivers.disableConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {docsTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDocsTarget(null);
            }
          }}
        >
          <div className="clox-dialog max-w-lg" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('drivers.documentsTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('drivers.documentsBody', {
                name: docsTarget.user.name ?? docsTarget.user.email,
              })}
            </p>
            {driverDocsQuery.isLoading ? (
              <p className="mt-4 text-sm text-clox-faint">{t('documentsUpload.loadingDocs')}</p>
            ) : null}
            {driverDocsQuery.isError ? (
              <Notice tone="error" className="mt-4">
                {getErrorDetail(driverDocsQuery.error)}
              </Notice>
            ) : null}
            {!driverDocsQuery.isLoading &&
            !driverDocsQuery.isError &&
            (driverDocsQuery.data?.items.length ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-clox-faint">{t('documentsUpload.noneYet')}</p>
            ) : null}
            {(driverDocsQuery.data?.items.length ?? 0) > 0 ? (
              <ul className="mt-4 space-y-2">
                {driverDocsQuery.data!.items.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-clox-ink">
                        {doc.docType}
                        {doc.originalFilename ? ` · ${doc.originalFilename}` : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-clox-faint">
                        {doc.status}
                        {doc.createdAt
                          ? ` · ${formatDateTime(doc.createdAt)}`
                          : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={openingDocId === doc.id}
                      onClick={() => void viewDriverDoc(doc.id)}
                    >
                      {openingDocId === doc.id
                        ? t('documentsUpload.opening')
                        : t('documentsUpload.viewDocument')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setDocsTarget(null)}>
                {t('confirm.cancel')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showScheduleModal ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !createScheduleMutation.isPending) {
              setShowScheduleModal(false);
            }
          }}
        >
          <div className="clox-dialog max-w-md" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('drivers.modalScheduleTitle', { defaultValue: 'Schedule Driver Time-Off / Block-out' })}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">
              {t('drivers.modalScheduleDesc', {
                defaultValue: 'Directly record planned leave or off-duty time for a driver. This will auto-approve the block-out.',
              })}
            </p>

            <div className="mt-4 space-y-3">
              <Select
                label={t('drivers.selectDriver', { defaultValue: 'Driver' })}
                value={schedDriverId}
                onChange={(e) => setSchedDriverId(e.target.value)}
                required
              >
                <option value="">{t('drivers.selectDriverPlaceholder', { defaultValue: 'Select a driver...' })}</option>
                {items
                  .filter((d) => d.status === 'ACTIVE')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.name ?? d.user?.email ?? 'Driver'} ({d.licenceClass ?? 'Licence'})
                    </option>
                  ))}
              </Select>

              <Select
                label={t('drivers.selectType', { defaultValue: 'Availability / Leave Type' })}
                value={schedType}
                onChange={(e) => setSchedType(e.target.value)}
              >
                <option value="ANNUAL_LEAVE">Annual Leave</option>
                <option value="MEDICAL_LEAVE">Medical / Sick Leave</option>
                <option value="ROSTERED_OFF">Rostered Day Off (RDO)</option>
                <option value="PERSONAL">Personal / Emergency</option>
                <option value="OVERTIME_AVAILABLE">Overtime / Priority Shift</option>
              </Select>

              <Field
                type="datetime-local"
                label={t('drivers.startAt', { defaultValue: 'Start Date & Time' })}
                value={schedStartAt}
                onChange={(e) => setSchedStartAt(e.target.value)}
                required
              />

              <Field
                type="datetime-local"
                label={t('drivers.endAt', { defaultValue: 'End Date & Time' })}
                value={schedEndAt}
                onChange={(e) => setSchedEndAt(e.target.value)}
                required
              />

              <label className="block">
                <span className="mb-1 block text-[12.5px] font-semibold text-clox-ink">
                  {t('drivers.reasonLabel', { defaultValue: 'Reason / Notes (Optional)' })}
                </span>
                <textarea
                  className="clox-field-control min-h-[3rem]"
                  value={schedReason}
                  onChange={(e) => setSchedReason(e.target.value)}
                  placeholder={t('drivers.reasonPlaceholder', { defaultValue: 'e.g. Approved holiday leave' })}
                  maxLength={500}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={createScheduleMutation.isPending}
                onClick={() => setShowScheduleModal(false)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={createScheduleMutation.isPending || !schedDriverId || !schedStartAt || !schedEndAt}
                onClick={() => void handleCreateScheduleSubmit()}
              >
                {createScheduleMutation.isPending ? t('loading') : t('confirm.save', { defaultValue: 'Create Block-out' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reviewScheduleMutation.isPending) {
              setRejectTarget(null);
            }
          }}
        >
          <div className="clox-dialog max-w-sm" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('drivers.rejectModalTitle', { defaultValue: 'Reject Time-Off Request' })}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('drivers.rejectModalDesc', {
                defaultValue: `Provide a reason for rejecting ${rejectTarget.driver?.user?.name || 'this driver'}'s leave request:`,
              })}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('drivers.rejectionReasonLabel', { defaultValue: 'Rejection Reason' })}
              </span>
              <textarea
                className="clox-field-control min-h-[4rem]"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('drivers.rejectionReasonPlaceholder', { defaultValue: 'e.g. Insufficient fleet coverage during this period' })}
                maxLength={500}
                required
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={reviewScheduleMutation.isPending}
                onClick={() => setRejectTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={reviewScheduleMutation.isPending || !rejectionReason.trim()}
                onClick={() => void handleConfirmRejectSchedule()}
              >
                {reviewScheduleMutation.isPending ? t('loading') : t('confirm.reject', { defaultValue: 'Confirm Rejection' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
