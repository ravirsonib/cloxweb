import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Ban,
  ChevronDown,
  ChevronUp,
  Eye,
  FileWarning,
  IdCard,
  Loader2,
  Pencil,
  Rocket,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  DropdownMenu,
  type DropdownMenuItem,
  Field,
  FileInput,
  IconButton,
  IconFileButton,
  Notice,
  PaginationBar,
  ResponsiveDataView,
  Select,
  StatusFilterChips,
  StatusPill,
  ViewModeToggle,
  dataCardClassName,
  useClientPagination,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { countByBucket, filterAndSortByBucket } from '@/lib/status-list';
import {
  addCarrierVehicle,
  deleteCarrierVehicle,
  disableCarrierVehicle,
  getCarrierOnboarding,
  getErrorDetail,
  getFleetPlus,
  listCarrierVehicles,
  logVehicleService,
  openDocumentContent,
  reactivateCarrierVehicle,
  retireCarrierVehicle,
  startFleetPlusTrial,
  updateCarrierCapabilities,
  updateCarrierVehicle,
  updateVehicleCostProfile,
  uploadAndConfirmDocument,
  getVehicleClassesMeta,
  type CarrierVehicleListItem,
  type VehicleCostProfileInput,
} from '@/lib/api';
import { formatCalendarDate } from '@/lib/datetime';
import { cn } from '@/lib/cn';
import {
  optionalDecimalFromInputSchema,
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

/** Fleet+ cost & service profile — progressive disclosure accordion on the edit form. */
type CostProfileForm = {
  fuelType: string;
  serviceIntervalKm?: number;
  lastServiceOdometerKm?: number;
  maintenanceRatePerKm?: number;
  costProfileUnit: '' | 'PER_KM' | 'PER_HR';
  costProfileRate?: number;
  purchasePriceAud?: number;
  residualValueAud?: number;
  lifecycleMonths?: number;
};

function defaultCostProfileFormValues(row?: CarrierVehicleListItem | null): CostProfileForm {
  return {
    fuelType: row?.fuelType ?? '',
    serviceIntervalKm: row?.serviceIntervalKm ?? undefined,
    lastServiceOdometerKm: row?.lastServiceOdometerKm ?? undefined,
    maintenanceRatePerKm: row?.maintenanceRatePerKm ?? undefined,
    costProfileUnit: (row?.costProfileUnit as CostProfileForm['costProfileUnit']) ?? '',
    costProfileRate: row?.costProfileRate ?? undefined,
    purchasePriceAud: row?.purchasePriceAud ?? undefined,
    residualValueAud: row?.residualValueAud ?? undefined,
    lifecycleMonths: row?.lifecycleMonths ?? undefined,
  };
}

function toCostProfilePayload(values: CostProfileForm): VehicleCostProfileInput {
  return {
    fuelType: values.fuelType.trim() ? values.fuelType.trim() : null,
    serviceIntervalKm: values.serviceIntervalKm ?? null,
    lastServiceOdometerKm: values.lastServiceOdometerKm ?? null,
    maintenanceRatePerKm: values.maintenanceRatePerKm ?? null,
    costProfileUnit: values.costProfileUnit || null,
    costProfileRate: values.costProfileRate ?? null,
    purchasePriceAud: values.purchasePriceAud ?? null,
    residualValueAud: values.residualValueAud ?? null,
    lifecycleMonths: values.lifecycleMonths ?? null,
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

// TODO(backend): carrier.service.ts listVehicles() doesn't return a per-vehicle
// VEHICLE_REGO document id / compliance state yet (unlike RWC + DG_LICENCE), so
// there is no badge/"View" action for it below — only upload. Wire a
// `compliance.rego` field (Wave 2 fleet schema) to show status + enable "View".
async function uploadVehicleRego(companyId: string, vehicleId: string, file: File) {
  await uploadAndConfirmDocument({
    companyId,
    vehicleId,
    docType: 'VEHICLE_REGO',
    file,
    filenameFallback: 'vehicle-rego',
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

/** Summary strip buckets — tap-to-filter overview distinct from the raw status dropdown. */
type FleetSummaryBucket =
  | 'onTrip'
  | 'expiring'
  | 'pendingReview'
  | 'active'
  | 'parked'
  | 'other';
type FleetSummaryFilter = 'all' | FleetSummaryBucket;

const FLEET_SUMMARY_FILTERS = [
  'all',
  'active',
  'pendingReview',
  'expiring',
  'onTrip',
  'parked',
] as const satisfies readonly FleetSummaryFilter[];

const FLEET_SUMMARY_SORT: Record<FleetSummaryBucket, number> = {
  onTrip: 0,
  expiring: 1,
  pendingReview: 2,
  active: 3,
  parked: 4,
  other: 5,
};

function fleetRwcNeedsAttention(row: CarrierVehicleListItem): boolean {
  const state = row.compliance?.rwc?.state;
  return state === 'EXPIRING' || state === 'EXPIRED' || state === 'MISSING';
}

function fleetSummaryBucket(row: CarrierVehicleListItem): FleetSummaryBucket {
  if (row.currentTrip) return 'onTrip';
  if (row.status === 'RETIRED' || row.status === 'DRAFT') {
    return row.status === 'RETIRED' ? 'parked' : 'other';
  }
  if (fleetRwcNeedsAttention(row)) return 'expiring';
  if (row.status === 'PENDING_REVIEW') return 'pendingReview';
  if (row.status === 'SUSPENDED') return 'parked';
  if (row.status === 'ACTIVE') return 'active';
  return 'other';
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
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<FleetSummaryFilter>('all');
  const [reasonTarget, setReasonTarget] = useState<{
    row: CarrierVehicleListItem;
    action: ReasonAction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [costProfileOpen, setCostProfileOpen] = useState(false);
  const [serviceLogTarget, setServiceLogTarget] = useState<CarrierVehicleListItem | null>(null);
  const [serviceOdometerKm, setServiceOdometerKm] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [clearMaintenanceChecked, setClearMaintenanceChecked] = useState(true);
  const [serviceLogError, setServiceLogError] = useState<string | null>(null);
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

  const fleetPlusQuery = useQuery({
    queryKey: ['carrier', 'fleet-plus'],
    queryFn: () => getFleetPlus(),
    staleTime: 30_000,
  });
  const fleetPlusEntitled = fleetPlusQuery.data?.entitled ?? false;

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

  const costProfileSchema = z.object({
    fuelType: z.string().trim().max(40).optional().or(z.literal('')),
    serviceIntervalKm: optionalNumberFromInputSchema(500_000),
    lastServiceOdometerKm: optionalNumberFromInputSchema(10_000_000),
    maintenanceRatePerKm: optionalDecimalFromInputSchema(100),
    costProfileUnit: z.union([z.literal(''), z.literal('PER_KM'), z.literal('PER_HR')]),
    costProfileRate: optionalDecimalFromInputSchema(10_000),
    purchasePriceAud: optionalDecimalFromInputSchema(10_000_000),
    residualValueAud: optionalDecimalFromInputSchema(10_000_000),
    lifecycleMonths: optionalNumberFromInputSchema(600),
  });

  const costProfileForm = useForm<CostProfileForm>({
    resolver: zodResolver(costProfileSchema) as Resolver<CostProfileForm>,
    defaultValues: defaultCostProfileFormValues(null),
  });

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
    setCostProfileOpen(false);
    costProfileForm.reset(defaultCostProfileFormValues(null));
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
    setCostProfileOpen(false);
    costProfileForm.reset(defaultCostProfileFormValues(row));
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
      await uploadVehicleDgDoc(companyId, vehicleId, file);
    },
    onSuccess: async () => {
      toast.success(t('fleet.dgUploadSuccess'));
      await invalidate();
    },
    onError: (error) => {
      setActionError(getErrorDetail(error));
    },
  });

  const regoUploadMutation = useMutation({
    mutationFn: async ({ vehicleId, file }: { vehicleId: string; file: File }) => {
      if (!companyId) {
        throw new Error(getErrorDetail(companyQuery.error) || t('loading'));
      }
      await uploadVehicleRego(companyId, vehicleId, file);
    },
    onSuccess: async () => {
      toast.success(
        t('fleet.regoUploadSuccess', {
          defaultValue: 'Vehicle registration document uploaded.',
        }),
      );
      await invalidate();
    },
    onError: (error) => {
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

  const trialMutation = useMutation({
    mutationFn: () => startFleetPlusTrial(),
    onSuccess: async () => {
      toast.success(t('fleetPlus.startTrialSuccess', { defaultValue: 'Fleet+ trial started.' }));
      await queryClient.invalidateQueries({ queryKey: ['carrier', 'fleet-plus'] });
    },
    onError: (error) => toast.error(getErrorDetail(error)),
  });

  const costProfileMutation = useMutation({
    mutationFn: (values: CostProfileForm) => {
      if (!editingVehicle) throw new Error(t('loading'));
      return updateVehicleCostProfile(editingVehicle.id, toCostProfilePayload(values));
    },
    onSuccess: async () => {
      toast.success(
        t('fleetPlus.costProfileSaved', { defaultValue: 'Cost & service profile updated.' }),
      );
      await invalidate();
    },
    onError: (error) => toast.error(getErrorDetail(error)),
  });

  const serviceLogMutation = useMutation({
    mutationFn: (payload: { odometerKm: number; notes?: string; clearMaintenance: boolean }) => {
      if (!serviceLogTarget) throw new Error(t('loading'));
      return logVehicleService(serviceLogTarget.id, payload);
    },
    onSuccess: async () => {
      setServiceLogTarget(null);
      setServiceLogError(null);
      toast.success(t('fleetPlus.serviceLogged', { defaultValue: 'Service logged.' }));
      await invalidate();
    },
    onError: (error) => setServiceLogError(getErrorDetail(error)),
  });

  function openServiceLog(row: CarrierVehicleListItem) {
    setServiceLogTarget(row);
    setServiceOdometerKm(row.lastServiceOdometerKm != null ? String(row.lastServiceOdometerKm) : '');
    setServiceNotes('');
    setClearMaintenanceChecked(row.status === 'MAINTENANCE');
    setServiceLogError(null);
  }

  function submitServiceLog() {
    const odometerKm = Number(serviceOdometerKm);
    if (!serviceOdometerKm.trim() || !Number.isFinite(odometerKm) || odometerKm < 0) {
      setServiceLogError(t('fleetPlus.odometerKmRequired', { defaultValue: 'Enter a valid odometer reading (km).' }));
      return;
    }
    setServiceLogError(null);
    serviceLogMutation.mutate({
      odometerKm: Math.round(odometerKm),
      notes: serviceNotes.trim() || undefined,
      clearMaintenance: clearMaintenanceChecked,
    });
  }

  const items = vehiclesQuery.data?.items ?? [];
  const missingRwcCount = items.filter((row) => {
    if (row.status === 'RETIRED' || row.status === 'DRAFT') return false;
    const state = row.compliance?.rwc?.state;
    return !state || state === 'MISSING' || state === 'EXPIRED';
  }).length;

  const summaryCounts = useMemo(
    () => countByBucket(items, fleetSummaryBucket, FLEET_SUMMARY_FILTERS),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearchAndStatus = items.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [row.registration, row.label, row.vehicleClass]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
    return filterAndSortByBucket(
      bySearchAndStatus,
      fleetSummaryBucket,
      summaryFilter,
      FLEET_SUMMARY_SORT,
    );
  }, [items, search, statusFilter, summaryFilter]);

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== '' || summaryFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setSummaryFilter('all');
  }

  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedVehicles,
  } = useClientPagination(filteredItems, 10);
  const busy =
    addMutation.isPending ||
    updateMutation.isPending ||
    reasonMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending ||
    rwcUploadMutation.isPending ||
    dgUploadMutation.isPending ||
    regoUploadMutation.isPending;

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

  /**
   * Row actions: primary labeled buttons stay visible (edit, urgent RWC
   * upload, reactivate); everything else collapses into a single overflow
   * "Actions" menu so dense rows don't turn into a wall of icon buttons.
   */
  function renderActions(row: CarrierVehicleListItem, opts?: { layout?: 'row' | 'card' }) {
    const layout = opts?.layout ?? 'row';
    const canEdit = row.status !== 'RETIRED';
    const isParked = row.status === 'SUSPENDED' || row.status === 'RETIRED';
    const rwcDocId = row.compliance?.rwc?.documentId ?? null;
    const openingRwc = rwcDocId != null && openingDocId === rwcDocId;
    const openingDg = row.dgDocumentId != null && openingDocId === row.dgDocumentId;
    const urgentRwcUpload = needsRwcUpload(row);
    const dgInputId = `dg-upload-${row.id}`;
    const rwcOverflowInputId = `rwc-upload-overflow-${row.id}`;
    const regoInputId = `rego-upload-${row.id}`;

    const overflowItems: DropdownMenuItem[] = [
      {
        key: 'view-rwc',
        label: t('fleet.rwcView'),
        icon: openingRwc ? Loader2 : Eye,
        hidden: !rwcDocId,
        disabled: busy || openingRwc,
        onSelect: () => void viewRwc(rwcDocId!),
      },
      {
        key: 'upload-rwc',
        label: t('fleet.rwcUpdate', { defaultValue: 'Update RWC' }),
        icon: Upload,
        // Already covered by the urgent primary button below when required.
        hidden: urgentRwcUpload || isParked || !canEdit || !companyId,
        disabled: busy,
        onSelect: () => document.getElementById(rwcOverflowInputId)?.click(),
      },
      {
        key: 'view-dg',
        label: t('fleet.dgView'),
        icon: openingDg ? Loader2 : Eye,
        hidden: !row.dgDocumentId,
        disabled: busy || openingDg,
        onSelect: () => void viewRwc(row.dgDocumentId!),
      },
      {
        key: 'upload-dg',
        label: row.dgDocumentId ? t('fleet.dgUpdate') : t('fleet.dgUpload'),
        icon: FileWarning,
        hidden: isParked || !companyId,
        disabled: busy,
        onSelect: () => document.getElementById(dgInputId)?.click(),
      },
      {
        key: 'upload-rego',
        label: t('fleet.regoUpload', { defaultValue: 'Upload Rego' }),
        icon: IdCard,
        hidden: isParked || !companyId,
        disabled: busy,
        onSelect: () => document.getElementById(regoInputId)?.click(),
      },
      {
        key: 'disable',
        label: t('fleet.disable'),
        icon: Ban,
        tone: 'destructive',
        hidden: isParked,
        disabled: busy,
        onSelect: () => openReason(row, 'disable'),
      },
      {
        key: 'retire',
        label: t('fleet.retire'),
        icon: Archive,
        tone: 'destructive',
        hidden: isParked,
        disabled: busy,
        onSelect: () => openReason(row, 'retire'),
      },
      {
        key: 'delete',
        label: t('fleet.delete'),
        icon: Trash2,
        tone: 'destructive',
        disabled: busy,
        onSelect: () => void onDelete(row),
      },
    ];

    return (
      <ActionGroup wrap={layout === 'card'} align={layout === 'card' ? 'start' : 'end'}>
        {/* Hidden pickers for overflow-triggered uploads (non-urgent RWC replace, DG, Rego). */}
        <input
          id={rwcOverflowInputId}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) rwcUploadMutation.mutate({ vehicleId: row.id, file });
          }}
        />
        <input
          id={dgInputId}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) dgUploadMutation.mutate({ vehicleId: row.id, file });
          }}
        />
        <input
          id={regoInputId}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) regoUploadMutation.mutate({ vehicleId: row.id, file });
          }}
        />

        {canEdit ? (
          <IconButton
            icon={Pencil}
            label={t('fleet.edit')}
            showLabel
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => openEditForm(row)}
          />
        ) : null}
        {urgentRwcUpload ? (
          <IconFileButton
            icon={Upload}
            label={t('fleet.rwcUpload')}
            showLabel
            variant="destructive"
            size="sm"
            inputId={`rwc-upload-${row.id}`}
            accept=".pdf,image/jpeg,image/png,image/webp"
            disabled={busy || !companyId}
            loading={uploadingVehicleId === row.id}
            onFile={(file) => rwcUploadMutation.mutate({ vehicleId: row.id, file })}
          />
        ) : null}
        {isParked ? (
          <IconButton
            icon={RotateCcw}
            label={t('fleet.reactivate')}
            showLabel
            variant="success"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          />
        ) : null}
        <DropdownMenu
          items={overflowItems}
          label={t('fleet.moreActions', { defaultValue: 'More actions' })}
          showTriggerLabel={layout === 'card'}
          size={layout === 'card' ? 'md' : 'sm'}
          disabled={busy}
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
          {renderActions(row, { layout: 'card' })}
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

      {!fleetPlusQuery.isLoading && fleetPlusEntitled && fleetPlusQuery.data?.billingEnabled === false ? (
        <Notice tone="success" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t('fleetPlus.complimentaryBanner', {
                defaultValue: 'Fleet+ is included free on this platform (subscription billing is off).',
              })}
            </span>
            <Link
              to="/carrier/fleet/analytics"
              className="font-semibold text-clox-orange hover:underline shrink-0 text-xs"
            >
              {t('fleetPlus.viewAnalytics', { defaultValue: 'View analytics →' })}
            </Link>
          </div>
        </Notice>
      ) : null}

      {!fleetPlusQuery.isLoading &&
      fleetPlusQuery.data?.billingEnabled !== false &&
      !fleetPlusEntitled ? (
        <Notice tone="info" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {t('fleetPlus.bannerTitle', { defaultValue: 'Fleet+' })}
              </p>
              <p className="mt-0.5 text-xs">
                {t('fleetPlus.startTrialBody', {
                  defaultValue:
                    'Unlock profit analytics, cost tracking, and maintenance alerts for your fleet.',
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="gap-1.5"
              disabled={trialMutation.isPending}
              onClick={() => trialMutation.mutate()}
            >
              <Rocket className="h-3.5 w-3.5" aria-hidden />
              {trialMutation.isPending
                ? t('loading')
                : t('fleetPlus.startTrialCta', { defaultValue: 'Start 14-day free trial' })}
            </Button>
          </div>
        </Notice>
      ) : null}

      {fleetPlusEntitled &&
      fleetPlusQuery.data?.billingEnabled !== false &&
      fleetPlusQuery.data?.status === 'TRIALING' ? (
        <Notice tone="info" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t('fleetPlus.trialStatusBanner', {
                defaultValue: 'Fleet+ trial active.',
              })}
            </span>
            <Link
              to="/carrier/fleet/analytics"
              className="font-semibold text-clox-orange hover:underline shrink-0 text-xs"
            >
              {t('fleetPlus.viewAnalytics', { defaultValue: 'View analytics →' })}
            </Link>
          </div>
        </Notice>
      ) : null}

      {fleetPlusEntitled &&
      fleetPlusQuery.data?.billingEnabled !== false &&
      fleetPlusQuery.data?.status !== 'TRIALING' ? (
        <Notice tone="success" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t('fleetPlus.activeStatusBanner', { defaultValue: 'Fleet+ is active on this account.' })}
            </span>
            <Link
              to="/carrier/fleet/analytics"
              className="font-semibold text-clox-orange hover:underline shrink-0 text-xs"
            >
              {t('fleetPlus.viewAnalytics', { defaultValue: 'View analytics →' })}
            </Link>
          </div>
        </Notice>
      ) : null}

      <div className="mt-4 sm:hidden">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {items.length > 0 ? (
        <StatusFilterChips
          className="mt-4"
          options={FLEET_SUMMARY_FILTERS}
          value={summaryFilter}
          counts={summaryCounts}
          onChange={setSummaryFilter}
          getLabel={(key) => t(`fleet.summary.${key}`)}
          aria-label={t('fleet.summaryLabel', { defaultValue: 'Fleet overview filters' })}
        />
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="mb-0 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
              {t('search')}
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clox-faint"
                aria-hidden
              />
              <input
                className="clox-field-control pl-9"
                placeholder={t('fleet.toolbarSearchPlaceholder', {
                  defaultValue: 'Search by registration, label, or class…',
                })}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>
          <Select
            className="mb-0"
            label={t('fleet.colStatus')}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">
              {t('fleet.toolbarAllStatuses', { defaultValue: 'All statuses' })}
            </option>
            {(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const).map(
              (status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ),
            )}
          </Select>
        </div>
      ) : null}

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

      {items
        .filter((row) => row.status === 'MAINTENANCE')
        .map((row) => {
          const cause = row.maintenanceCause ?? 'MANUAL';
          const rwcDocId = row.compliance?.rwc?.documentId ?? null;
          const openingRwc = rwcDocId != null && openingDocId === rwcDocId;
          const maintenanceUploadInputId = `maintenance-rwc-upload-${row.id}`;
          return (
            <Notice key={row.id} tone="error" className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t('fleet.maintenance.bannerTitle', {
                      rego: row.registration ?? row.label ?? row.id,
                      defaultValue: `${row.registration ?? row.label ?? row.id} is in maintenance`,
                    })}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {t(`fleet.maintenance.cause.${cause}`, { defaultValue: cause })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {cause === 'RWC_EXPIRED' ? (
                    rwcDocId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={openingRwc}
                        onClick={() => void viewRwc(rwcDocId)}
                      >
                        {openingRwc ? t('loading') : t('fleet.rwcView')}
                      </Button>
                    ) : null
                  ) : null}
                  {cause === 'RWC_EXPIRED' ? (
                    <IconFileButton
                      icon={uploadingVehicleId === row.id ? Loader2 : Upload}
                      label={t('fleet.maintenance.uploadRwcCta', { defaultValue: 'Upload RWC' })}
                      showLabel
                      size="sm"
                      variant="destructive"
                      inputId={maintenanceUploadInputId}
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      disabled={!companyId}
                      loading={uploadingVehicleId === row.id}
                      onFile={(file) => rwcUploadMutation.mutate({ vehicleId: row.id, file })}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openServiceLog(row)}
                  >
                    <Wrench className="h-3.5 w-3.5" aria-hidden />
                    {t('fleet.maintenance.logServiceCta', { defaultValue: 'Log service' })}
                  </Button>
                </div>
              </div>
            </Notice>
          );
        })}

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
            <EmptyBlock
              title={t('fleet.emptyTitle')}
              description={t('fleet.emptyHint')}
              action={
                <Button type="button" variant="primary" onClick={() => openAddForm()}>
                  {t('fleet.addVehicle')}
                </Button>
              }
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6">
            <EmptyBlock
              title={t('fleet.emptyFilteredTitle', {
                defaultValue: 'No vehicles match your filters.',
              })}
              description={t('fleet.emptyFilteredHint', {
                defaultValue: 'Try clearing the search or filter to see your full fleet.',
              })}
              action={
                hasActiveFilters ? (
                  <Button type="button" variant="secondary" onClick={clearFilters}>
                    {t('fleet.clearFilters', { defaultValue: 'Clear filters' })}
                  </Button>
                ) : undefined
              }
            />
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

                {isEditing && fleetPlusEntitled ? (
                  <div className="mt-5 border-t border-clox-border-soft pt-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => setCostProfileOpen((prev) => !prev)}
                      aria-expanded={costProfileOpen}
                    >
                      <span className="text-sm font-semibold text-clox-ink">
                        {t('fleetPlus.costServiceTitle', {
                          defaultValue: 'Cost & Service Profile (Fleet+)',
                        })}
                      </span>
                      {costProfileOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-clox-faint" aria-hidden />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-clox-faint" aria-hidden />
                      )}
                    </button>
                    <p className="mt-1 text-xs text-clox-mute">
                      {t('fleetPlus.costServiceHint', {
                        defaultValue: 'Used to calculate profit per trip and maintenance alerts.',
                      })}
                    </p>
                    {costProfileOpen ? (
                      <>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field
                            label={t('fleetPlus.fuelTypeLabel', { defaultValue: 'Fuel type' })}
                            placeholder="Diesel"
                            {...costProfileForm.register('fuelType')}
                          />
                          <Field
                            type="number"
                            label={t('fleetPlus.serviceIntervalKmLabel', {
                              defaultValue: 'Service interval (km)',
                            })}
                            error={costProfileForm.formState.errors.serviceIntervalKm?.message}
                            {...costProfileForm.register('serviceIntervalKm', { valueAsNumber: true })}
                          />
                          <Field
                            type="number"
                            label={t('fleetPlus.lastServiceOdometerKmLabel', {
                              defaultValue: 'Last service odometer (km)',
                            })}
                            error={costProfileForm.formState.errors.lastServiceOdometerKm?.message}
                            {...costProfileForm.register('lastServiceOdometerKm', {
                              valueAsNumber: true,
                            })}
                          />
                          <Field
                            type="number"
                            step="0.01"
                            label={t('fleetPlus.maintenanceRatePerKmLabel', {
                              defaultValue: 'Maintenance rate ($/km)',
                            })}
                            error={costProfileForm.formState.errors.maintenanceRatePerKm?.message}
                            {...costProfileForm.register('maintenanceRatePerKm', {
                              valueAsNumber: true,
                            })}
                          />
                          <Select
                            label={t('fleetPlus.costProfileUnitLabel', {
                              defaultValue: 'Cost profile unit',
                            })}
                            value={costProfileForm.watch('costProfileUnit')}
                            {...costProfileForm.register('costProfileUnit')}
                          >
                            <option value="">{t('dash')}</option>
                            <option value="PER_KM">
                              {t('fleetPlus.unitPerKm', { defaultValue: 'Per km' })}
                            </option>
                            <option value="PER_HR">
                              {t('fleetPlus.unitPerHr', { defaultValue: 'Per hour' })}
                            </option>
                          </Select>
                          <Field
                            type="number"
                            step="0.01"
                            label={t('fleetPlus.costProfileRateLabel', {
                              defaultValue: 'Cost profile rate',
                            })}
                            hint={t('fleetPlus.costProfileRateHint', {
                              defaultValue: 'Used by smart allocation to rank "Most profitable".',
                            })}
                            error={costProfileForm.formState.errors.costProfileRate?.message}
                            {...costProfileForm.register('costProfileRate', { valueAsNumber: true })}
                          />
                          {fleetPlusQuery.data?.tier === 'ENTERPRISE' ? (
                            <>
                              <Field
                                type="number"
                                step="0.01"
                                label={t('fleetPlus.purchasePriceAudLabel', {
                                  defaultValue: 'Purchase price (AUD)',
                                })}
                                error={costProfileForm.formState.errors.purchasePriceAud?.message}
                                {...costProfileForm.register('purchasePriceAud', {
                                  valueAsNumber: true,
                                })}
                              />
                              <Field
                                type="number"
                                step="0.01"
                                label={t('fleetPlus.residualValueAudLabel', {
                                  defaultValue: 'Residual value (AUD)',
                                })}
                                error={costProfileForm.formState.errors.residualValueAud?.message}
                                {...costProfileForm.register('residualValueAud', {
                                  valueAsNumber: true,
                                })}
                              />
                              <Field
                                type="number"
                                label={t('fleetPlus.lifecycleMonthsLabel', {
                                  defaultValue: 'Lifecycle (months)',
                                })}
                                error={costProfileForm.formState.errors.lifecycleMonths?.message}
                                {...costProfileForm.register('lifecycleMonths', {
                                  valueAsNumber: true,
                                })}
                              />
                            </>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={costProfileMutation.isPending}
                            onClick={costProfileForm.handleSubmit((values) =>
                              costProfileMutation.mutate(values),
                            )}
                          >
                            {costProfileMutation.isPending
                              ? t('saving')
                              : t('fleetPlus.saveCostProfile', {
                                  defaultValue: 'Save cost profile',
                                })}
                          </Button>
                          {costProfileMutation.isError ? (
                            <span className="text-xs text-[var(--status-danger)]">
                              {getErrorDetail(costProfileMutation.error)}
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

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

      {serviceLogTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !serviceLogMutation.isPending) {
              setServiceLogTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('fleetPlus.logServiceTitle', { defaultValue: 'Log service' })}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('fleetPlus.logServiceHint', {
                rego: serviceLogTarget.registration ?? serviceLogTarget.label ?? '',
                defaultValue:
                  'Record an odometer reading for {{rego}}. If this vehicle is in maintenance for a service interval or safety check, you can clear it below.',
              })}
            </p>
            <Field
              type="number"
              className="mt-4"
              label={t('fleetPlus.odometerKmLabel', { defaultValue: 'Odometer (km)' })}
              required
              value={serviceOdometerKm}
              onChange={(event) => setServiceOdometerKm(event.target.value)}
            />
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('fleetPlus.notesLabel', { defaultValue: 'Notes (optional)' })}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={serviceNotes}
                onChange={(event) => setServiceNotes(event.target.value)}
                placeholder={t('fleetPlus.notesPlaceholder', {
                  defaultValue: 'e.g. Oil + filter change, brake inspection',
                })}
                maxLength={2000}
              />
            </label>
            <div className="mt-3">
              <ChoiceCheck
                checked={clearMaintenanceChecked}
                onChange={(e) => setClearMaintenanceChecked(e.target.checked)}
              >
                {t('fleetPlus.clearMaintenanceLabel', {
                  defaultValue: 'Clear MAINTENANCE status for this vehicle',
                })}
              </ChoiceCheck>
            </div>
            {serviceLogError || serviceLogMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {serviceLogError ?? getErrorDetail(serviceLogMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={serviceLogMutation.isPending}
                onClick={() => setServiceLogTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="cta"
                disabled={serviceLogMutation.isPending}
                onClick={submitServiceLog}
              >
                {serviceLogMutation.isPending
                  ? t('loading')
                  : t('fleetPlus.logService', { defaultValue: 'Log service' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
