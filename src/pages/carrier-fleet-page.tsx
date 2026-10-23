import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  confirmDocument,
  createUploadIntent,
  deleteCarrierVehicle,
  disableCarrierVehicle,
  getCarrierOnboarding,
  getErrorDetail,
  listCarrierVehicles,
  openDocumentContent,
  reactivateCarrierVehicle,
  retireCarrierVehicle,
  uploadDocumentContent,
  type CarrierVehicleListItem,
} from '@/lib/api';
import { resolveUploadMime } from '@/lib/upload-mime';
import {
  suggestedGvmKgForClass,
  suggestedTareKgForClass,
  VEHICLE_CLASSES,
} from '@/lib/validation';

type VehicleForm = {
  label: string;
  registration: string;
  vehicleClass: (typeof VEHICLE_CLASSES)[number];
  tareKg: number;
  gvmKg: number;
};

async function uploadVehicleRwc(companyId: string, vehicleId: string, file: File) {
  const mime = resolveUploadMime(file);
  const intent = await createUploadIntent({
    companyId,
    docType: 'RWC',
    originalFilename:
      file.name || `rwc.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
    mimeType: mime,
    sizeBytes: file.size,
    vehicleId,
  });
  const up = await uploadDocumentContent(intent.id, file);
  await confirmDocument(intent.id, up.contentHash);
}

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
  const [rwcFile, setRwcFile] = useState<File | null>(null);
  const [rwcFormError, setRwcFormError] = useState<string | null>(null);
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
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

  const companyQuery = useQuery({
    queryKey: ['carrier', 'onboarding'],
    queryFn: () => getCarrierOnboarding(),
    staleTime: 60_000,
  });
  const companyId = companyQuery.data?.company.id ?? null;

  const schema = z
    .object({
      label: z.string().trim().min(1, t('validation.vehicleLabelRequired')),
      registration: z.string().trim().min(1, t('validation.registrationRequired')),
      vehicleClass: z.enum(VEHICLE_CLASSES, {
        message: t('validation.vehicleClassRequired'),
      }),
      tareKg: z
        .number({ message: t('validation.tareKgRequired') })
        .int()
        .positive(t('validation.tareKgPositive'))
        .max(100_000),
      gvmKg: z
        .number({ message: t('validation.gvmKgRequired') })
        .int()
        .positive(t('validation.gvmKgPositive'))
        .max(200_000),
    })
    .superRefine((values, ctx) => {
      if (values.tareKg >= values.gvmKg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tareKg'],
          message: t('validation.tareLessThanGvm'),
        });
      }
    });

  const form = useForm<VehicleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: '',
      registration: '',
      vehicleClass: 'RIGID_1_2T',
      tareKg: suggestedTareKgForClass('RIGID_1_2T'),
      gvmKg: suggestedGvmKgForClass('RIGID_1_2T'),
    },
  });

  const watchedClass = form.watch('vehicleClass');
  const setValue = form.setValue;
  useEffect(() => {
    setValue('gvmKg', suggestedGvmKgForClass(watchedClass));
    setValue('tareKg', suggestedTareKgForClass(watchedClass));
  }, [watchedClass, setValue]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['carrier', 'vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['carrier', 'onboarding'] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!rwcFile) {
        throw new Error(t('fleet.rwcRequiredError'));
      }
      if (!companyId) {
        throw new Error(getErrorDetail(companyQuery.error) || t('loading'));
      }
      const onboarding = await addCarrierVehicle({
        label: values.label,
        registration: values.registration,
        vehicleClass: values.vehicleClass,
        tareKg: values.tareKg,
        gvmKg: values.gvmKg,
      });
      const rego = values.registration.trim().toUpperCase();
      const created =
        onboarding.vehicles.find(
          (v) => (v.registration ?? '').toUpperCase() === rego && !v.hasRwc,
        ) ??
        onboarding.vehicles.find((v) => (v.registration ?? '').toUpperCase() === rego);
      if (!created) {
        throw new Error(t('fleet.rwcRequiredError'));
      }
      await uploadVehicleRwc(companyId, created.id, rwcFile);
      return onboarding;
    },
    onSuccess: async () => {
      form.reset({
        label: '',
        registration: '',
        vehicleClass: 'RIGID_1_2T',
        tareKg: suggestedTareKgForClass('RIGID_1_2T'),
        gvmKg: suggestedGvmKgForClass('RIGID_1_2T'),
      });
      setRwcFile(null);
      setRwcFormError(null);
      setShowForm(false);
      toast.success(t('fleet.addSuccess'));
      await invalidate();
    },
    onError: (error) => setRwcFormError(getErrorDetail(error)),
  });

  const rwcUploadMutation = useMutation({
    mutationFn: async ({ vehicleId, file }: { vehicleId: string; file: File }) => {
      if (!companyId) {
        throw new Error(getErrorDetail(companyQuery.error) || t('loading'));
      }
      setUploadingVehicleId(vehicleId);
      await uploadVehicleRwc(companyId, vehicleId, file);
    },
    onSuccess: async () => {
      setUploadingVehicleId(null);
      toast.success(t('fleet.rwcUploadSuccess'));
      await invalidate();
    },
    onError: (error) => {
      setUploadingVehicleId(null);
      setActionError(getErrorDetail(error));
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
  const missingRwcCount = items.filter(
    (row) =>
      row.status === 'ACTIVE' &&
      (!row.compliance?.rwc ||
        row.compliance.rwc.state === 'MISSING' ||
        row.compliance.rwc.state === 'EXPIRED'),
  ).length;
  const busy =
    addMutation.isPending ||
    reasonMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending ||
    rwcUploadMutation.isPending;

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

  function activityLabel(activity: string) {
    return t(`drivers.activity.${activity}`, { defaultValue: activity });
  }

  function renderStatus(row: CarrierVehicleListItem) {
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
              {t('fleet.accountStatus', { status: statusLabel(row.status) })}
            </p>
          </>
        ) : (
          <StatusPill tone={vehicleStatusTone(row.status)} className="max-w-full">
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

  function renderRwc(row: CarrierVehicleListItem) {
    const rwc = row.compliance?.rwc;
    if (!rwc) {
      return <StatusPill tone="neutral">{t('fleet.rwc.UNKNOWN')}</StatusPill>;
    }
    const expiry =
      rwc.expiresAt != null
        ? new Date(rwc.expiresAt).toLocaleDateString()
        : null;
    const approved = rwc.documentStatus === 'APPROVED';
    let label: string;
    if (approved && (rwc.state === 'OK' || rwc.state === 'EXPIRING')) {
      label = expiry
        ? t('fleet.rwc.APPROVEDWithDate', { date: expiry })
        : t('fleet.rwc.APPROVED');
    } else if (
      expiry &&
      (rwc.state === 'OK' || rwc.state === 'EXPIRING' || rwc.state === 'EXPIRED')
    ) {
      label = t(`fleet.rwc.${rwc.state}WithDate`, {
        date: expiry,
        defaultValue: `${t(`fleet.rwc.${rwc.state}`)} · ${expiry}`,
      });
    } else {
      label = t(`fleet.rwc.${rwc.state}`, { defaultValue: rwc.state });
    }
    return <StatusPill tone={rwcTone(rwc.state)}>{label}</StatusPill>;
  }

  function needsRwcUpload(row: CarrierVehicleListItem) {
    const state = row.compliance?.rwc?.state;
    return (
      row.status === 'ACTIVE' &&
      (!state || state === 'MISSING' || state === 'EXPIRED' || state === 'PENDING')
    );
  }

  async function viewRwc(documentId: string) {
    setOpeningDocId(documentId);
    try {
      await openDocumentContent(documentId);
    } catch (error) {
      setActionError(getErrorDetail(error));
    } finally {
      setOpeningDocId(null);
    }
  }

  function renderRwcUpload(row: CarrierVehicleListItem) {
    if (!needsRwcUpload(row)) return null;
    const inputId = `rwc-upload-${row.id}`;
    return (
      <label
        htmlFor={inputId}
        className="clox-btn clox-btn-secondary inline-flex cursor-pointer items-center text-sm"
      >
        {uploadingVehicleId === row.id ? t('saving') : t('fleet.rwcUpload')}
        <input
          id={inputId}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          disabled={busy || !companyId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) rwcUploadMutation.mutate({ vehicleId: row.id, file });
          }}
        />
      </label>
    );
  }

  function renderRwcView(row: CarrierVehicleListItem) {
    const documentId = row.compliance?.rwc?.documentId;
    if (!documentId) return null;
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || openingDocId === documentId}
        onClick={() => void viewRwc(documentId)}
      >
        {openingDocId === documentId ? t('loading') : t('fleet.rwcView')}
      </Button>
    );
  }

  function renderActions(row: CarrierVehicleListItem) {
    const isParked = row.status === 'SUSPENDED' || row.status === 'RETIRED';
    return (
      <div className="inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
        {renderRwcView(row)}
        {renderRwcUpload(row)}
        {isParked ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('fleet.reactivate')}
          </Button>
        ) : (
          <>
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
          </>
        )}
        <Button
          type="button"
          variant={isParked ? 'destructive' : 'ghost'}
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

      {missingRwcCount > 0 ? (
        <Notice tone="warn" className="mt-4">
          {t('fleet.rwcMissingBanner')}
        </Notice>
      ) : null}

      {showForm ? (
        <form
          className="clox-card mt-6 p-4 sm:p-5"
          onSubmit={form.handleSubmit((values) => {
            if (busy) return;
            if (!rwcFile) {
              setRwcFormError(t('fleet.rwcRequiredError'));
              return;
            }
            setRwcFormError(null);
            addMutation.mutate(values);
          })}
          noValidate
        >
          <fieldset disabled={busy} className="min-w-0 border-0 p-0">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('fleet.addVehicleTitle')}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">{t('fleet.addVehicleHint')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Field
                type="number"
                label={t('fleet.gvmKgLabel')}
                hint={t('fleet.gvmKgHint')}
                error={form.formState.errors.gvmKg?.message}
                {...form.register('gvmKg', { valueAsNumber: true })}
              />
              <Field
                type="number"
                label={t('fleet.tareKgLabel')}
                hint={t('fleet.tareKgHint')}
                error={form.formState.errors.tareKg?.message}
                {...form.register('tareKg', { valueAsNumber: true })}
              />
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="mb-1.5 text-[12.5px] font-semibold text-clox-ink">
                  {t('fleet.rwcLabel')}
                </p>
                <p className="mb-2 text-xs text-clox-faint">{t('fleet.rwcHint')}</p>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp,image/*"
                  capture="environment"
                  onChange={(event) => {
                    setRwcFile(event.target.files?.[0] ?? null);
                    setRwcFormError(null);
                  }}
                />
                {rwcFile ? (
                  <p className="mt-1 text-xs text-clox-mute">{rwcFile.name}</p>
                ) : null}
              </div>
            </div>
            {rwcFormError || addMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {rwcFormError ?? getErrorDetail(addMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-4">
              <Button type="submit" variant="cta" disabled={busy || !companyId}>
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
                      <div className="shrink-0">{renderRwc(row)}</div>
                    </div>
                    <div className="mt-3">{renderStatus(row)}</div>
                    {row.disabledReason ? (
                      <p className="mt-2 text-xs text-clox-mute">
                        {t('fleet.reasonLabel')}: {row.disabledReason}
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
                  t('fleet.colRego'),
                  t('fleet.colLabel'),
                  t('fleet.colClass'),
                  t('fleet.colGvm'),
                  t('fleet.colStatus'),
                  t('fleet.colRwc'),
                  t('fleet.colReason'),
                  t('fleet.colActions'),
                ]}
                headerClassNames={[
                  undefined,
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
                    <td className="px-4 py-3 align-top font-mono text-sm text-clox-ink">
                      {row.registration ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 align-top text-clox-mute">
                      {row.label ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 align-top text-clox-mute">
                      {row.vehicleClass ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-clox-mute">
                      {row.gvmKg != null ? `${row.gvmKg}` : t('dash')}
                    </td>
                    <td className="px-4 py-3 align-top">{renderStatus(row)}</td>
                    <td className="px-4 py-3 align-top">{renderRwc(row)}</td>
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
