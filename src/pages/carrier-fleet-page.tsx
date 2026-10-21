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
  Select,
  StatusPill,
  dataCardClassName,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  addCarrierVehicle,
  deleteCarrierVehicle,
  disableCarrierVehicle,
  getErrorDetail,
  listCarrierVehicles,
  reactivateCarrierVehicle,
  retireCarrierVehicle,
  type CarrierVehicleListItem,
} from '@/lib/api';
import { VEHICLE_CLASSES } from '@/lib/validation';

type VehicleForm = {
  label: string;
  registration: string;
  vehicleClass: (typeof VEHICLE_CLASSES)[number];
};

type ReasonAction = 'disable' | 'retire';

type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

function vehicleStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
      return 'ok';
    case 'DRAFT':
      return 'info';
    case 'PENDING_REVIEW':
      return 'warn';
    case 'SUSPENDED':
    case 'RETIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function rwcTone(state: string): StatusTone {
  switch (state) {
    case 'OK':
      return 'ok';
    case 'EXPIRING':
    case 'PENDING':
      return 'warn';
    case 'EXPIRED':
    case 'MISSING':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function CarrierFleetPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reasonTarget, setReasonTarget] = useState<{
    row: CarrierVehicleListItem;
    action: ReasonAction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
  });

  const schema = z.object({
    label: z.string().trim().min(1, t('validation.vehicleLabelRequired')),
    registration: z.string().trim().min(1, t('validation.registrationRequired')),
    vehicleClass: z.enum(VEHICLE_CLASSES, {
      message: t('validation.vehicleClassRequired'),
    }),
  });

  const form = useForm<VehicleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: '',
      registration: '',
      vehicleClass: 'RIGID_1_2T',
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['carrier', 'vehicles'] });

  const addMutation = useMutation({
    mutationFn: (values: VehicleForm) =>
      addCarrierVehicle({
        label: values.label,
        registration: values.registration,
        vehicleClass: values.vehicleClass,
        tareKg: 3500,
        gvmKg: 8000,
      }),
    onSuccess: async () => {
      form.reset({ label: '', registration: '', vehicleClass: 'RIGID_1_2T' });
      setShowForm(false);
      toast.success(t('fleet.addSuccess'));
      await invalidate();
    },
  });

  const reasonMutation = useMutation({
    mutationFn: () => {
      const payload = { reason: reason.trim(), note: note.trim() || undefined };
      if (reasonTarget!.action === 'retire') {
        return retireCarrierVehicle(reasonTarget!.row.id, payload);
      }
      return disableCarrierVehicle(reasonTarget!.row.id, payload);
    },
    onSuccess: async () => {
      setReasonTarget(null);
      setReason('');
      setNote('');
      setActionError(null);
      toast.success(
        reasonTarget?.action === 'retire' ? t('fleet.retireSuccess') : t('fleet.disableSuccess'),
      );
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateCarrierVehicle(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('fleet.reactivateSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarrierVehicle(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('fleet.deleteSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const items = vehiclesQuery.data?.items ?? [];
  const busy =
    addMutation.isPending ||
    reasonMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending;

  function statusLabel(status: string) {
    return t(`fleet.statuses.${status}`, { defaultValue: status });
  }

  function openReason(row: CarrierVehicleListItem, action: ReasonAction) {
    setActionError(null);
    setReason('');
    setNote('');
    setReasonTarget({ row, action });
  }

  async function onReactivate(row: CarrierVehicleListItem) {
    const ok = await confirm({
      title: t('fleet.reactivateTitle'),
      description: t('fleet.reactivateBody', {
        rego: row.registration ?? row.label ?? row.id,
      }),
      confirmLabel: t('fleet.reactivate'),
    });
    if (!ok) return;
    reactivateMutation.mutate(row.id);
  }

  async function onDelete(row: CarrierVehicleListItem) {
    const ok = await confirm({
      title: t('fleet.deleteTitle'),
      description: t('fleet.deleteBody', {
        rego: row.registration ?? row.label ?? row.id,
      }),
      confirmLabel: t('fleet.deleteConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  function renderStatus(row: CarrierVehicleListItem) {
    return (
      <StatusPill tone={vehicleStatusTone(row.status)}>{statusLabel(row.status)}</StatusPill>
    );
  }

  function renderRwc(row: CarrierVehicleListItem) {
    const rwc = row.compliance?.rwc;
    if (!rwc) {
      return <StatusPill tone="neutral">{t('fleet.rwc.UNKNOWN')}</StatusPill>;
    }
    const expiry =
      rwc.expiresAt != null
        ? new Date(rwc.expiresAt).toLocaleDateString()
        : null;
    const label =
      expiry && (rwc.state === 'OK' || rwc.state === 'EXPIRING' || rwc.state === 'EXPIRED')
        ? t(`fleet.rwc.${rwc.state}WithDate`, {
            date: expiry,
            defaultValue: `${t(`fleet.rwc.${rwc.state}`)} · ${expiry}`,
          })
        : t(`fleet.rwc.${rwc.state}`, { defaultValue: rwc.state });
    return <StatusPill tone={rwcTone(rwc.state)}>{label}</StatusPill>;
  }

  function renderActions(row: CarrierVehicleListItem) {
    if (row.status === 'SUSPENDED' || row.status === 'RETIRED') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('fleet.reactivate')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onDelete(row)}
          >
            {t('fleet.delete')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => openReason(row, 'disable')}
        >
          {t('fleet.disable')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => openReason(row, 'retire')}
        >
          {t('fleet.retire')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void onDelete(row)}
        >
          {t('fleet.delete')}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" aria-busy={busy || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('fleet.title')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('fleet.subtitle')} · {t('totalCount', { count: items.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <span
              className="clox-btn clox-btn-secondary inline-flex cursor-not-allowed items-center opacity-50"
              aria-disabled="true"
            >
              {t('fleet.manageDrivers')}
            </span>
          ) : (
            <Link
              to="/carrier/drivers"
              className="clox-btn clox-btn-secondary inline-flex items-center"
            >
              {t('fleet.manageDrivers')}
            </Link>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? t('cancel') : t('fleet.addVehicle')}
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
            addMutation.mutate(values);
          })}
          noValidate
        >
          <fieldset disabled={busy} className="min-w-0 border-0 p-0">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('fleet.addVehicleTitle')}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">{t('fleet.addVehicleHint')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field
                label={t('carrierOnboarding.placeholderLabel')}
                error={form.formState.errors.label?.message}
                {...form.register('label')}
              />
              <Field
                label={t('carrierOnboarding.placeholderRegistration')}
                error={form.formState.errors.registration?.message}
                {...form.register('registration')}
              />
              <Select
                label={t('validation.vehicleClassLabel')}
                error={form.formState.errors.vehicleClass?.message}
                value={form.watch('vehicleClass')}
                {...form.register('vehicleClass')}
              >
                {VEHICLE_CLASSES.map((vehicleClass) => (
                  <option key={vehicleClass} value={vehicleClass}>
                    {vehicleClass}
                  </option>
                ))}
              </Select>
            </div>
            {addMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(addMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-4">
              <Button type="submit" variant="cta" disabled={busy}>
                {addMutation.isPending ? t('saving') : t('fleet.addVehicle')}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : null}

      {vehiclesQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {vehiclesQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(vehiclesQuery.error)}
        </Notice>
      ) : null}

      {!vehiclesQuery.isLoading && !vehiclesQuery.isError ? (
        items.length === 0 ? (
          <div className="mt-6">
            <EmptyBlock title={t('fleet.emptyTitle')} description={t('fleet.emptyHint')} />
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
                          {row.registration ?? t('dash')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-clox-faint">
                          {row.label ?? t('dash')} · {row.vehicleClass ?? t('dash')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {renderStatus(row)}
                        {renderRwc(row)}
                      </div>
                    </div>
                    {row.disabledReason ? (
                      <p className="mt-2 text-xs text-clox-mute">
                        {t('fleet.reasonLabel')}: {row.disabledReason}
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
                  t('fleet.colRego'),
                  t('fleet.colLabel'),
                  t('fleet.colClass'),
                  t('fleet.colGvm'),
                  t('fleet.colStatus'),
                  t('fleet.colRwc'),
                  t('fleet.colReason'),
                  t('fleet.colActions'),
                ]}
              >
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-clox-ink">
                      {row.registration ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 text-clox-mute">{row.label ?? t('dash')}</td>
                    <td className="px-4 py-3 text-clox-mute">{row.vehicleClass ?? t('dash')}</td>
                    <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                      {row.gvmKg ?? t('dash')}
                    </td>
                    <td className="px-4 py-3">{renderStatus(row)}</td>
                    <td className="px-4 py-3">{renderRwc(row)}</td>
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

      {reasonTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reasonMutation.isPending) {
              setReasonTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {reasonTarget.action === 'retire'
                ? t('fleet.retireTitle')
                : t('fleet.disableTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {reasonTarget.action === 'retire'
                ? t('fleet.retireBody', {
                    rego: reasonTarget.row.registration ?? reasonTarget.row.label ?? '',
                  })
                : t('fleet.disableBody', {
                    rego: reasonTarget.row.registration ?? reasonTarget.row.label ?? '',
                  })}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('fleet.reasonLabel')}
              </span>
              <textarea
                className="clox-field-control min-h-[4.5rem]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('fleet.reasonPlaceholder')}
                maxLength={500}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('fleet.noteLabel')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('fleet.notePlaceholder')}
                maxLength={2000}
              />
            </label>
            {reasonMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(reasonMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={reasonMutation.isPending}
                onClick={() => setReasonTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={reasonMutation.isPending || reason.trim().length < 3}
                onClick={() => reasonMutation.mutate()}
              >
                {reasonMutation.isPending
                  ? t('loading')
                  : reasonTarget.action === 'retire'
                    ? t('fleet.retireConfirm')
                    : t('fleet.disableConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
