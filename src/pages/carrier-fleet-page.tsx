import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Ban,
  Eye,
  FileWarning,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  ActionGroup,
  Button,
  ChoiceCheck,
  DataCardList,
  DataTable,
  Field,
  FileInput,
  IconButton,
  IconFileButton,
  Notice,
  PaginationBar,
  ResponsiveDataView,
  Select,
  StatusPill,
  ViewModeToggle,
  dataCardClassName,
  useClientPagination,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import {
  addCarrierVehicle,
  deleteCarrierVehicle,
  disableCarrierVehicle,
  getCarrierOnboarding,
  getErrorDetail,
  listCarrierVehicles,
  openDocumentContent,
  reactivateCarrierVehicle,
  retireCarrierVehicle,
  updateCarrierCapabilities,
  updateCarrierVehicle,
  uploadAndConfirmDocument,
  getVehicleClassesMeta,
  type CarrierVehicleListItem,
} from '@/lib/api';
import { formatCalendarDate } from '@/lib/datetime';
import { cn } from '@/lib/cn';
import {
  optionalNumberFromInputSchema,
  suggestedGvmKgForClass,
  suggestedTareKgForClass,
  VEHICLE_CLASSES,
} from '@/lib/validation';

type VehicleForm = {
  label: string;
  registration: string;
  vehicleClass: string;
  tareKg: number;
  gvmKg: number;
  gcmKg?: number;
};

function toVehiclePayload(values: VehicleForm) {
  return {
    label: values.label,
    registration: values.registration,
    vehicleClass: values.vehicleClass,
    tareKg: values.tareKg,
    gvmKg: values.gvmKg,
    ...(values.gcmKg != null && !Number.isNaN(values.gcmKg) ? { gcmKg: values.gcmKg } : {}),
  };
}

function defaultVehicleFormValues(): VehicleForm {
  return {
    label: '',
    registration: '',
    vehicleClass: 'RIGID_1_2T',
    tareKg: suggestedTareKgForClass('RIGID_1_2T'),
    gvmKg: suggestedGvmKgForClass('RIGID_1_2T'),
    gcmKg: undefined,
  };
}

async function uploadVehicleRwc(companyId: string, vehicleId: string, file: File) {
  await uploadAndConfirmDocument({
    companyId,
    vehicleId,
    docType: 'RWC',
    file,
    filenameFallback: 'rwc',
  });
}

async function uploadVehicleDgDoc(companyId: string, vehicleId: string, file: File) {
  await uploadAndConfirmDocument({
    companyId,
    vehicleId,
    docType: 'DG_LICENCE',
    file,
    filenameFallback: 'dg-licence',
  });
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
  const [viewMode, setViewMode] = useDataViewMode('carrier-fleet', 'list');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<CarrierVehicleListItem | null>(null);
  const [rwcFile, setRwcFile] = useState<File | null>(null);
  const [hasDgForm, setHasDgForm] = useState(false);
  const [dgFile, setDgFile] = useState<File | null>(null);
  const [hasReefer, setHasReefer] = useState(false);
  const [hasOversize, setHasOversize] = useState(false);
  const [hasTailLift, setHasTailLift] = useState(false);
  const [hasCurtainsider, setHasCurtainsider] = useState(false);
  const [showManageCaps, setShowManageCaps] = useState(false);
  const [editingCaps, setEditingCaps] = useState<string[]>([]);
  const [rwcFormError, setRwcFormError] = useState<string | null>(null);
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null);
  const [uploadingDgVehicleId, setUploadingDgVehicleId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{
    row: CarrierVehicleListItem;
    action: ReasonAction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const lastSuggestedClass = useRef<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
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
      vehicleClass: z.string().min(1, t('validation.vehicleClassRequired')),
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
      gcmKg: optionalNumberFromInputSchema(300_000),
    })
    .superRefine((values, ctx) => {
      if (values.tareKg >= values.gvmKg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tareKg'],
          message: t('validation.tareLessThanGvm'),
        });
      }
      if (values.gcmKg != null && values.gcmKg < values.gvmKg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gcmKg'],
          message: t('fleet.gcmKgHint'),
        });
      }
    });

  const vehicleClassesQuery = useQuery({
    queryKey: ['jobs', 'meta', 'vehicle-classes'],
    queryFn: () => getVehicleClassesMeta(),
  });

  const form = useForm<VehicleForm>({
    resolver: zodResolver(schema) as Resolver<VehicleForm>,
    defaultValues: defaultVehicleFormValues(),
  });

  const watchedClass = form.watch('vehicleClass');
  const setValue = form.setValue;
  useEffect(() => {
    if (!watchedClass) return;
    if (lastSuggestedClass.current === watchedClass) return;
    lastSuggestedClass.current = watchedClass;
    const gvm =
      vehicleClassesQuery.data?.suggestedGvmKg?.[watchedClass] ??
      suggestedGvmKgForClass(watchedClass);
    const tare =
      vehicleClassesQuery.data?.suggestedTareKg?.[watchedClass] ??
      suggestedTareKgForClass(watchedClass);
    setValue('gvmKg', gvm);
    setValue('tareKg', tare);
  }, [watchedClass, setValue, vehicleClassesQuery.data]);

  const capacityLocked = Boolean(editingVehicle?.currentTrip);
  const isEditing = editingVehicle != null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['carrier', 'vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['carrier', 'onboarding'] }),
    ]);
  };

  function resetVehicleFormPanel() {
    lastSuggestedClass.current = 'RIGID_1_2T';
    form.reset(defaultVehicleFormValues());
    setEditingVehicle(null);
    setRwcFile(null);
    setHasDgForm(false);
    setDgFile(null);
    setHasReefer(false);
    setHasOversize(false);
    setHasTailLift(false);
    setHasCurtainsider(false);
    setRwcFormError(null);
    setShowForm(false);
  }

  function openAddForm() {
    lastSuggestedClass.current = null;
    setEditingVehicle(null);
    form.reset(defaultVehicleFormValues());
    setRwcFile(null);
    setHasDgForm(false);
    setDgFile(null);
    setHasReefer(false);
    setHasOversize(false);
    setHasTailLift(false);
    setHasCurtainsider(false);
    setRwcFormError(null);
    setShowForm(true);
  }

  function openEditForm(row: CarrierVehicleListItem) {
    if (row.status === 'RETIRED') return;
    lastSuggestedClass.current = row.vehicleClass ?? 'RIGID_1_2T';
    setEditingVehicle(row);
    form.reset({
      label: row.label ?? '',
      registration: row.registration ?? '',
      vehicleClass: row.vehicleClass ?? 'RIGID_1_2T',
      tareKg: row.tareKg ?? suggestedTareKgForClass(row.vehicleClass ?? 'RIGID_1_2T'),
      gvmKg: row.gvmKg ?? suggestedGvmKgForClass(row.vehicleClass ?? 'RIGID_1_2T'),
      gcmKg: row.gcmKg ?? undefined,
    });
    setRwcFile(null);
    setHasDgForm(false);
    setDgFile(null);
    setRwcFormError(null);
    setShowForm(true);
  }

  const addMutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!rwcFile) {
        throw new Error(t('fleet.rwcRequiredError'));
      }
      if (hasDgForm && !dgFile) {
        throw new Error(
          t('fleet.dgDocRequiredError', {
            defaultValue: 'Please upload the Dangerous Goods (DG) document for this vehicle.',
          }),
        );
      }
      if (!companyId) {
        throw new Error(getErrorDetail(companyQuery.error) || t('loading'));
      }
      const onboarding = await addCarrierVehicle(toVehiclePayload(values));
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
      if (hasDgForm && dgFile) {
        await uploadVehicleDgDoc(companyId, created.id, dgFile);
      }
      // Merge checked flags into company capabilities (not stored per vehicle).
      const newCaps: string[] = [];
      if (hasDgForm) newCaps.push('DG');
      if (hasReefer) newCaps.push('REEFER');
      if (hasOversize) newCaps.push('OVERSIZE');
      if (hasTailLift) newCaps.push('TAIL_LIFT');
      if (hasCurtainsider) newCaps.push('CURTAINSIDER');
      const existingCaps = companyQuery.data?.company.capabilities ?? [];
      const mergedCaps = Array.from(new Set([...existingCaps, ...newCaps]));
      if (mergedCaps.length > existingCaps.length) {
        try {
          await updateCarrierCapabilities({
            capabilities: mergedCaps,
            serviceRegionCodes: companyQuery.data?.company.serviceRegionCodes?.length
              ? companyQuery.data.company.serviceRegionCodes
              : [companyQuery.data?.company.homeRegionCode || 'VIC'],
          });
        } catch {
          // Non-blocking best-effort sync
        }
      }
      return onboarding;
    },
    onSuccess: async () => {
      resetVehicleFormPanel();
      toast.success(t('fleet.addSuccess'));
      await invalidate();
    },
    onError: (error) => setRwcFormError(getErrorDetail(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!editingVehicle) {
        throw new Error(t('loading'));
      }
      return updateCarrierVehicle(editingVehicle.id, toVehiclePayload(values));
    },
    onSuccess: async () => {
      resetVehicleFormPanel();
      toast.success(t('fleet.editSuccess'));
      await invalidate();
    },
    onError: (error) => setRwcFormError(getErrorDetail(error)),
  });

  const capsMutation = useMutation({
    mutationFn: async (capabilities: string[]) => {
      const serviceRegionCodes = companyQuery.data?.company.serviceRegionCodes?.length
        ? companyQuery.data.company.serviceRegionCodes
        : [companyQuery.data?.company.homeRegionCode || 'VIC'];
      return updateCarrierCapabilities({ capabilities, serviceRegionCodes });
    },
    onSuccess: async () => {
      setShowManageCaps(false);
      toast.success(t('fleet.capabilitiesSaved', { defaultValue: 'Fleet capabilities updated successfully.' }));
      await invalidate();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
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

  const dgUploadMutation = useMutation({
    mutationFn: async ({ vehicleId, file }: { vehicleId: string; file: File }) => {
      if (!companyId) {
        throw new Error(getErrorDetail(companyQuery.error) || t('loading'));
      }
      setUploadingDgVehicleId(vehicleId);
      await uploadVehicleDgDoc(companyId, vehicleId, file);
    },
    onSuccess: async () => {
      setUploadingDgVehicleId(null);
        toast.success(t('fleet.dgUploadSuccess'));
      await invalidate();
    },
    onError: (error) => {
      setUploadingDgVehicleId(null);
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
  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedVehicles,
  } = useClientPagination(items, 10);
  const missingRwcCount = items.filter((row) => {
    if (row.status === 'RETIRED' || row.status === 'DRAFT') return false;
    const state = row.compliance?.rwc?.state;
    return !state || state === 'MISSING' || state === 'EXPIRED';
  }).length;
  const busy =
    addMutation.isPending ||
    updateMutation.isPending ||
    reasonMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending ||
    rwcUploadMutation.isPending ||
    dgUploadMutation.isPending;

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
      <div className="flex w-full min-w-0 max-w-[14rem] flex-col items-start gap-1">
        {activity ? (
          <>
            <StatusPill tone={activityStatusTone(activity)} className="max-w-full min-w-0">
              <span className="min-w-0 truncate">{activityLabel(activity)}</span>
            </StatusPill>
            <p className="w-full truncate text-[11px] leading-tight text-clox-mute">
              {t('fleet.accountStatus', { status: statusLabel(row.status) })}
            </p>
          </>
        ) : (
          <StatusPill tone={vehicleStatusTone(row.status)} className="max-w-full min-w-0">
            <span className="min-w-0 truncate">{statusLabel(row.status)}</span>
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
        ? formatCalendarDate(rwc.expiresAt)
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
    return (
      <StatusPill
        tone={rwcTone(rwc.state)}
        className="max-w-full min-w-0"
        title={label}
      >
        <span className="min-w-0 truncate">{label}</span>
      </StatusPill>
    );
  }

  function needsRwcUpload(row: CarrierVehicleListItem) {
    // ACTIVE: restore bidding; PENDING_REVIEW: docs plan allows upload; SUSPENDED: needed before reactivate.
    if (
      row.status !== 'ACTIVE' &&
      row.status !== 'PENDING_REVIEW' &&
      row.status !== 'SUSPENDED'
    ) {
      return false;
    }
    const state = row.compliance?.rwc?.state;
    return !state || state === 'MISSING' || state === 'EXPIRED' || state === 'PENDING';
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

  function formatMassCell(row: CarrierVehicleListItem) {
    if (row.gvmKg == null && row.gcmKg == null) return t('dash');
    if (row.gcmKg != null) {
      return `${row.gvmKg ?? t('dash')} / ${row.gcmKg}`;
    }
    return `${row.gvmKg}`;
  }

  function renderActions(row: CarrierVehicleListItem, opts?: { showLabel?: boolean }) {
    const showLabel = opts?.showLabel ?? false;
    const canEdit = row.status !== 'RETIRED';
    const isParked = row.status === 'SUSPENDED' || row.status === 'RETIRED';
    const rwcDocId = row.compliance?.rwc?.documentId ?? null;
    const openingRwc = rwcDocId != null && openingDocId === rwcDocId;
    const openingDg = row.dgDocumentId != null && openingDocId === row.dgDocumentId;

    return (
      <ActionGroup wrap={showLabel}>
        {canEdit ? (
          <IconButton
            icon={Pencil}
            label={t('fleet.edit')}
            tooltip={t('fleet.edit')}
            showLabel={showLabel}
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => openEditForm(row)}
          />
        ) : null}
        {rwcDocId ? (
          <IconButton
            icon={openingRwc ? Loader2 : Eye}
            label={t('fleet.rwcView')}
            tooltip={t('fleet.rwcView')}
            showLabel={showLabel}
            variant="secondary"
            size="sm"
            disabled={busy || openingRwc}
            className={openingRwc ? '[&_svg]:animate-spin' : undefined}
            onClick={() => void viewRwc(rwcDocId)}
          />
        ) : null}
        {needsRwcUpload(row) ? (
          <IconFileButton
            icon={Upload}
            label={t('fleet.rwcUpload')}
            tooltip={t('fleet.rwcUpload')}
            showLabel={showLabel}
            variant="secondary"
            size="sm"
            inputId={`rwc-upload-${row.id}`}
            accept=".pdf,image/jpeg,image/png,image/webp"
            disabled={busy || !companyId}
            loading={uploadingVehicleId === row.id}
            onFile={(file) => rwcUploadMutation.mutate({ vehicleId: row.id, file })}
          />
        ) : null}
        {row.dgDocumentId ? (
          <IconButton
            icon={openingDg ? Loader2 : Eye}
            label={t('fleet.dgView')}
            tooltip={t('fleet.dgView')}
            showLabel={showLabel}
            variant="secondary"
            size="sm"
            disabled={busy || openingDg}
            className={openingDg ? '[&_svg]:animate-spin' : undefined}
            onClick={() => void viewRwc(row.dgDocumentId!)}
          />
        ) : null}
        {!isParked ? (
          <IconFileButton
            icon={FileWarning}
            label={row.dgDocumentId ? t('fleet.dgUpdate') : t('fleet.dgUpload')}
            tooltip={row.dgDocumentId ? t('fleet.dgUpdate') : t('fleet.dgUpload')}
            showLabel={showLabel}
            variant="secondary"
            size="sm"
            inputId={`dg-upload-${row.id}`}
            accept=".pdf,image/jpeg,image/png,image/webp"
            disabled={busy || !companyId}
            loading={uploadingDgVehicleId === row.id}
            onFile={(file) => dgUploadMutation.mutate({ vehicleId: row.id, file })}
          />
        ) : null}
        {isParked ? (
          <IconButton
            icon={RotateCcw}
            label={t('fleet.reactivate')}
            tooltip={t('fleet.reactivate')}
            showLabel={showLabel}
            variant="success"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          />
        ) : (
          <>
            <IconButton
              icon={Ban}
              label={t('fleet.disable')}
              tooltip={t('fleet.disable')}
              showLabel={showLabel}
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => openReason(row, 'disable')}
            />
            <IconButton
              icon={Archive}
              label={t('fleet.retire')}
              tooltip={t('fleet.retire')}
              showLabel={showLabel}
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => openReason(row, 'retire')}
            />
          </>
        )}
        <IconButton
          icon={Trash2}
          label={t('fleet.delete')}
          tooltip={t('fleet.delete')}
          showLabel={showLabel}
          variant={isParked ? 'destructive' : 'ghost'}
          size="sm"
          disabled={busy}
          onClick={() => void onDelete(row)}
        />
      </ActionGroup>
    );
  }

  function renderVehicleCard(row: CarrierVehicleListItem) {
    return (
      <div className={cn(dataCardClassName, 'flex h-full flex-col')}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-clox-ink">
                {row.registration ?? t('dash')}
              </p>
              {row.hasDg ? <StatusPill tone="warn">DG</StatusPill> : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-clox-mute">
              {row.label ?? t('dash')}
            </p>
          </div>
          <div className="shrink-0">{renderStatus(row)}</div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div className="min-w-0">
            <dt className="text-clox-faint">{t('fleet.colClass')}</dt>
            <dd className="truncate font-medium text-clox-ink">
              {row.vehicleClass ?? t('dash')}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-clox-faint">{t('fleet.colGvm')}</dt>
            <dd className="truncate font-mono text-clox-ink">{formatMassCell(row)}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-clox-faint">{t('fleet.colRwc')}</dt>
            <dd className="mt-1">{renderRwc(row)}</dd>
          </div>
          {row.disabledReason ? (
            <div className="col-span-2 min-w-0">
              <dt className="text-clox-faint">{t('fleet.reasonLabel')}</dt>
              <dd className="mt-0.5 line-clamp-2 text-clox-mute">{row.disabledReason}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto border-t border-clox-border-soft pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-clox-faint">
            {t('fleet.colActions')}
          </p>
          {renderActions(row, { showLabel: true })}
        </div>
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
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-clox-mute">
            <span>
              {t('fleet.subtitle')} · {t('totalCount', { count: items.length })}
            </span>
            {typeof companyQuery.data?.company?.reliabilityScore === 'number' ? (
              <StatusPill tone="info">
                {t('companies.reliabilityScore', {
                  score: companyQuery.data.company.reliabilityScore,
                })}
              </StatusPill>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            className="hidden sm:inline-flex"
          />
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
            onClick={() => openAddForm()}
          >
            {t('fleet.addVehicle')}
          </Button>
        </div>
      </div>

      <div className="mt-4 sm:hidden">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {actionError ? (
        <Notice tone="error" className="mt-4">
          {actionError}
        </Notice>
      ) : null}

      {items.some((v) => v.status === 'PENDING_REVIEW') ? (
        <Notice tone="info" className="mt-4">
          {t('fleet.pendingReviewHint')}
        </Notice>
      ) : null}

      {missingRwcCount > 0 ? (
        <Notice tone="warn" className="mt-4">
          {t('fleet.rwcMissingBanner')}
        </Notice>
      ) : null}

      {/* Fleet Capabilities & Load Types Card */}
      <div className="clox-card mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-clox-ink sm:text-base">
              {t('fleet.capabilitiesTitle', { defaultValue: 'Fleet Capabilities & Load Types' })}
            </h2>
            <p className="mt-0.5 text-xs text-clox-mute">
              {t('fleet.capabilitiesSubtitle', {
                defaultValue: 'Specialized equipment and certifications supported across your fleet.',
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setEditingCaps(companyQuery.data?.company.capabilities ?? []);
              setShowManageCaps((prev) => !prev);
            }}
          >
            {showManageCaps ? t('confirm.cancel') : t('fleet.manageCapabilities')}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill tone="info">{t('fleet.capGeneral')}</StatusPill>
          {(companyQuery.data?.company.capabilities ?? []).includes('DG') ? (
            <StatusPill tone="warn">{t('fleet.capDg')}</StatusPill>
          ) : null}
          {(companyQuery.data?.company.capabilities ?? []).includes('REEFER') ? (
            <StatusPill tone="info">{t('fleet.capReefer')}</StatusPill>
          ) : null}
          {(companyQuery.data?.company.capabilities ?? []).includes('OVERSIZE') ? (
            <StatusPill tone="warn">{t('fleet.capOversize')}</StatusPill>
          ) : null}
          {(companyQuery.data?.company.capabilities ?? []).includes('TAIL_LIFT') ? (
            <StatusPill tone="neutral">{t('fleet.capTailLift')}</StatusPill>
          ) : null}
          {(companyQuery.data?.company.capabilities ?? []).includes('CURTAINSIDER') ? (
            <StatusPill tone="neutral">{t('fleet.capCurtainsider')}</StatusPill>
          ) : null}
          {(companyQuery.data?.company.capabilities ?? []).length === 0 ? (
            <span className="text-xs text-clox-mute">{t('fleet.noSpecialCaps')}</span>
          ) : null}
        </div>

        {showManageCaps ? (
          <div className="mt-4 border-t border-clox-border-soft pt-4">
            <p className="text-xs font-semibold text-clox-ink">{t('fleet.toggleCapsHint')}</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {[
                { code: 'DG', labelKey: 'fleet.capDg', hintKey: 'fleet.capDgHint' },
                { code: 'REEFER', labelKey: 'fleet.capReefer', hintKey: 'fleet.capReeferHint' },
                { code: 'OVERSIZE', labelKey: 'fleet.capOversize', hintKey: 'fleet.capOversizeHint' },
                { code: 'TAIL_LIFT', labelKey: 'fleet.capTailLift', hintKey: 'fleet.capTailLiftHint' },
                {
                  code: 'CURTAINSIDER',
                  labelKey: 'fleet.capCurtainsider',
                  hintKey: 'fleet.capCurtainsiderHint',
                },
              ].map((cap) => {
                const checked = editingCaps.includes(cap.code);
                return (
                  <label
                    key={cap.code}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-clox-sm border p-2.5 transition-colors',
                      checked
                        ? 'border-[#f26e22] bg-[#f26e22]/5 dark:bg-[#f26e22]/10'
                        : 'border-clox-border bg-clox-surface',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded text-[#f26e22] focus:ring-[#f26e22]"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditingCaps((prev) => [...prev, cap.code]);
                        } else {
                          setEditingCaps((prev) => prev.filter((c) => c !== cap.code));
                        }
                      }}
                    />
                    <div>
                      <span className="block font-semibold text-clox-ink">{t(cap.labelKey)}</span>
                      <span className="text-[11px] text-clox-mute">{t(cap.hintKey)}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={capsMutation.isPending}
                onClick={() => capsMutation.mutate(editingCaps)}
              >
                {capsMutation.isPending ? t('saving') : t('fleet.saveCapabilities')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowManageCaps(false)}>
                {t('confirm.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

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
        ) : viewMode === 'grid' ? (
          <>
            <DataCardList
              className="mt-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              items={pagedVehicles}
              getKey={(row) => row.id}
              mode="grid"
              renderItem={renderVehicleCard}
            />
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <>
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={pagedVehicles}
                  getKey={(row) => row.id}
                  mode="list"
                  renderItem={renderVehicleCard}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[64rem]"
                  headers={[
                    t('fleet.colRego'),
                    t('fleet.colLabel'),
                    t('fleet.colClass'),
                    t('fleet.colGvm'),
                    t('fleet.colStatus'),
                    t('fleet.colRwc'),
                    t('fleet.colActions'),
                  ]}
                  headerClassNames={[
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    'text-left',
                  ]}
                >
                  {pagedVehicles.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-3 py-3 align-middle font-mono text-sm text-clox-ink sm:px-4">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="truncate">{row.registration ?? t('dash')}</span>
                          {row.hasDg ? <StatusPill tone="warn">DG</StatusPill> : null}
                        </div>
                      </td>
                      <td className="max-w-[10rem] px-3 py-3 align-middle text-clox-mute sm:px-4">
                        <span className="line-clamp-2">{row.label ?? t('dash')}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle text-clox-mute sm:px-4">
                        {row.vehicleClass ?? t('dash')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle font-mono text-xs text-clox-mute sm:px-4">
                        {formatMassCell(row)}
                      </td>
                      <td className="px-3 py-3 align-middle sm:px-4">{renderStatus(row)}</td>
                      <td className="px-3 py-3 align-middle sm:px-4">
                        <div className="max-w-[11rem]">{renderRwc(row)}</div>
                      </td>
                      <td className="px-3 py-3 align-middle sm:px-4">
                        <div className="min-w-[10.5rem] max-w-[16rem]">
                          {renderActions(row)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              }
            />
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )
      ) : null}

      {showForm ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !addMutation.isPending &&
              !updateMutation.isPending
            ) {
              resetVehicleFormPanel();
            }
          }}
        >
          <div
            className="clox-dialog max-h-[min(92dvh,48rem)] max-w-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fleet-vehicle-form-title"
          >
            <form
              onSubmit={form.handleSubmit((values) => {
                if (busy) return;
                if (isEditing) {
                  setRwcFormError(null);
                  updateMutation.mutate(values);
                  return;
                }
                if (!rwcFile) {
                  setRwcFormError(t('fleet.rwcRequiredError'));
                  return;
                }
                if (hasDgForm && !dgFile) {
                  setRwcFormError(t('fleet.dgDocRequiredError'));
                  return;
                }
                setRwcFormError(null);
                addMutation.mutate(values);
              })}
              noValidate
            >
              <fieldset disabled={busy} className="min-w-0 border-0 p-0">
                <h2
                  id="fleet-vehicle-form-title"
                  className="font-display text-lg font-semibold text-clox-ink"
                >
                  {isEditing ? t('fleet.editVehicleTitle') : t('fleet.addVehicleTitle')}
                </h2>
                <p className="mt-1 text-sm text-clox-mute">
                  {isEditing ? t('fleet.editVehicleHint') : t('fleet.addVehicleHint')}
                </p>
                {isEditing && capacityLocked ? (
                  <Notice tone="warn" className="mt-3 text-xs">
                    {t('fleet.editCapacityLocked')}
                  </Notice>
                ) : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                    disabled={capacityLocked}
                    {...form.register('vehicleClass')}
                  >
                    {(
                      vehicleClassesQuery.data?.classes ??
                      VEHICLE_CLASSES.map((c) => ({ code: c, name: c }))
                    ).map((cls) => (
                      <option key={cls.code} value={cls.code}>
                        {cls.name || cls.code}
                      </option>
                    ))}
                  </Select>
                  <Field
                    type="number"
                    label={t('fleet.gvmKgLabel')}
                    hint={t('fleet.gvmKgHint')}
                    error={form.formState.errors.gvmKg?.message}
                    disabled={capacityLocked}
                    {...form.register('gvmKg', { valueAsNumber: true })}
                  />
                  <Field
                    type="number"
                    label={t('fleet.tareKgLabel')}
                    hint={t('fleet.tareKgHint')}
                    error={form.formState.errors.tareKg?.message}
                    disabled={capacityLocked}
                    {...form.register('tareKg', { valueAsNumber: true })}
                  />
                  <Field
                    type="number"
                    label={t('fleet.gcmKgLabel')}
                    hint={t('fleet.gcmKgHint')}
                    error={form.formState.errors.gcmKg?.message}
                    disabled={capacityLocked}
                    {...form.register('gcmKg', { valueAsNumber: true })}
                  />
                  {!isEditing ? (
                    <>
                      <FileInput
                        className="mb-0 sm:col-span-2"
                        label={t('fleet.rwcLabel')}
                        hint={t('fleet.rwcHint')}
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        fileName={rwcFile?.name ?? null}
                        onChange={(event) => {
                          setRwcFile(event.target.files?.[0] ?? null);
                          setRwcFormError(null);
                        }}
                      />
                      <div className="sm:col-span-2">
                        <ChoiceCheck
                          checked={hasDgForm}
                          onChange={(e) => {
                            setHasDgForm(e.target.checked);
                            if (!e.target.checked) setDgFile(null);
                            setRwcFormError(null);
                          }}
                        >
                          {t('fleet.vehicleHasDg')}
                        </ChoiceCheck>
                        {hasDgForm ? (
                          <FileInput
                            className="mt-2 mb-0"
                            label={t('fleet.dgDocLabel')}
                            hint={t('fleet.dgDocHint')}
                            accept=".pdf,image/jpeg,image/png,image/webp"
                            fileName={dgFile?.name ?? null}
                            onChange={(event) => {
                              setDgFile(event.target.files?.[0] ?? null);
                              setRwcFormError(null);
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="border-t border-clox-border-soft pt-3 sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-clox-ink">
                          {t('fleet.vehicleCapabilities')}
                        </span>
                        <p className="mb-2 text-[11px] text-clox-mute">
                          {t('fleet.vehicleCapabilitiesHint')}
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                          <ChoiceCheck
                            checked={hasReefer}
                            onChange={(e) => setHasReefer(e.target.checked)}
                          >
                            {t('fleet.capReefer')}
                          </ChoiceCheck>
                          <ChoiceCheck
                            checked={hasOversize}
                            onChange={(e) => setHasOversize(e.target.checked)}
                          >
                            {t('fleet.capOversize')}
                          </ChoiceCheck>
                          <ChoiceCheck
                            checked={hasTailLift}
                            onChange={(e) => setHasTailLift(e.target.checked)}
                          >
                            {t('fleet.capTailLift')}
                          </ChoiceCheck>
                          <ChoiceCheck
                            checked={hasCurtainsider}
                            onChange={(e) => setHasCurtainsider(e.target.checked)}
                          >
                            {t('fleet.capCurtainsider')}
                          </ChoiceCheck>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
                {rwcFormError || addMutation.isError || updateMutation.isError ? (
                  <Notice tone="error" className="mt-4">
                    {rwcFormError ??
                      getErrorDetail(updateMutation.error) ??
                      getErrorDetail(addMutation.error)}
                  </Notice>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => resetVehicleFormPanel()}
                  >
                    {t('confirm.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="cta"
                    disabled={busy || (!isEditing && !companyId)}
                  >
                    {addMutation.isPending || updateMutation.isPending
                      ? t('saving')
                      : isEditing
                        ? t('fleet.saveVehicle')
                        : t('fleet.addVehicle')}
                  </Button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
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
