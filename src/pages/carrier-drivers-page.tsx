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
  inviteCarrierDriver,
  listCarrierDrivers,
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

export function CarrierDriversPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [disableTarget, setDisableTarget] = useState<CarrierDriverListItem | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{
    inviteUrl: string;
    debugToken?: string;
    mailSkipped: boolean;
  } | null>(null);

  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
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
    return (
      <StatusPill tone={driverStatusTone(row.status)}>{statusLabel(row.status)}</StatusPill>
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

  function renderActions(row: CarrierDriverListItem) {
    if (row.status === 'SUSPENDED' || row.status === 'DISABLED') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('drivers.reactivate')}
          </Button>
          <Button
            type="button"
            variant="destructive"
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
      <div className="flex flex-wrap gap-2">
        {row.status === 'INVITED' ? (
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
        {row.status !== 'INVITED' ? (
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
          variant="ghost"
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
                      <div className="flex flex-col items-end gap-1">
                        {renderStatus(row)}
                        {renderLicenceExpiry(row)}
                      </div>
                    </div>
                    {row.disabledReason ? (
                      <p className="mt-2 text-xs text-clox-mute">
                        {t('drivers.reasonLabel')}: {row.disabledReason}
                      </p>
                    ) : null}
                    <div className="mt-3">{renderActions(row)}</div>
                  </div>
                )}
              />
            }
            table={
              <DataTable
                minWidthClassName="min-w-[56rem]"
                headers={[
                  t('drivers.colName'),
                  t('drivers.colEmail'),
                  t('drivers.colLicence'),
                  t('drivers.colLicenceExpiry'),
                  t('drivers.colStatus'),
                  t('drivers.colReason'),
                  t('drivers.colActions'),
                ]}
              >
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 text-clox-ink">{row.user.name ?? t('dash')}</td>
                    <td className="px-4 py-3 text-clox-mute">{row.user.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                      {row.licenceNo ?? t('dash')}
                      {row.licenceClass ? ` · ${row.licenceClass}` : ''}
                    </td>
                    <td className="px-4 py-3">{renderLicenceExpiry(row)}</td>
                    <td className="px-4 py-3">{renderStatus(row)}</td>
                    <td className="max-w-[14rem] px-4 py-3 text-xs text-clox-mute">
                      {row.disabledReason ? (
                        <span className="line-clamp-2" title={row.disabledReason}>
                          {row.disabledReason}
                        </span>
                      ) : (
                        t('dash')
                      )}
                    </td>
                    <td className="px-4 py-3">{renderActions(row)}</td>
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
    </div>
  );
}
