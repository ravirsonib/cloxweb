import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  DataTable,
  Field,
  Notice,
  ResponsiveDataView,
  StatusPill,
  dataCardClassName,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  deleteCarrierDriver,
  disableCarrierDriver,
  getErrorDetail,
  getIdentityMe,
  inviteCarrierDriver,
  listCarrierDrivers,
  listDocuments,
  openDocumentContent,
  reactivateCarrierDriver,
  resendCarrierDriverInvite,
  type CarrierDriverListItem,
} from '@/lib/api';

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

  const meQuery = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
  });
  const companyId = meQuery.data?.company?.id ?? null;

  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
  });

  const driverDocsQuery = useQuery({
    queryKey: ['documents', 'list', companyId, docsTarget?.id],
    queryFn: () =>
      listDocuments({ companyId: companyId!, driverId: docsTarget!.id }),
    enabled: Boolean(companyId && docsTarget?.id),
  });

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
    return (
      <div className="flex min-w-[9.5rem] max-w-[15rem] flex-col items-start gap-1">
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
    const date = new Date(row.licenceExpiry).toLocaleDateString();
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
      <div className="inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
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
      </div>
    );
  }

  return (
    <div className="relative" aria-busy={busy || undefined}>
      {inviting ? (
        <div
          className="clox-dialog-backdrop z-40"
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
          <p className="mt-2 text-sm text-clox-mute">
            {t('drivers.subtitle')} · {t('totalCount', { count: items.length })}
          </p>
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
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? t('cancel') : t('drivers.inviteDriver')}
          </Button>
        </div>
      </div>

      {actionError ? (
        <Notice tone="error" className="mt-4">
          {actionError}
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
          <ResponsiveDataView
            className="mt-6"
            cards={
              <DataCardList
                items={items}
                getKey={(row) => row.id}
                renderItem={(row) => (
                  <div className={dataCardClassName}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-clox-ink">
                          {row.user.name ?? t('dash')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-clox-faint">{row.user.email}</p>
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
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 align-top text-clox-ink">
                      {row.user.name ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 align-top text-clox-mute">{row.user.email}</td>
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
        )
      ) : null}

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
                          ? ` · ${new Date(doc.createdAt).toLocaleString()}`
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
    </div>
  );
}
