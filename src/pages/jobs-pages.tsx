import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { z } from 'zod';
import {
  acceptProposal,
  approveTripExceptionReplacement,
  cancelJob,
  confirmDocument,
  createJob,
  createUploadIntent,
  getErrorDetail,
  getSenderJob,
  getSenderOnboarding,
  getRegionsMeta,
  getVehicleClassesMeta,
  listSenderJobs,
  openDocumentContent,
  previewJobRoute,
  publishJob,
  recommendVehicle,
  rejectTripExceptionReplacement,
  syncJobPayment,
  updateJob,
  updateJobReceiver,
  uploadDocumentContent,
  type AcceptProposalResult,
  type JobRouteEstimate,
  type JobSummary,
} from '@/lib/api';
import { ScaPaymentConfirm } from '@/components/stripe/ScaPaymentConfirm';
import {
  Button,
  ChoiceCheck,
  DataCardList,
  DataTable,
  Field,
  FileInput,
  Notice,
  PaginationBar,
  RadioCardGroup,
  ResponsiveDataView,
  Select,
  StatusFilterChips,
  StatusPill,
  StepChips,
  ViewModeToggle,
  useClientPagination,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import { formatDollars } from '@/lib/currency';
import { resolveUploadMime } from '@/lib/upload-mime';
import {
  countByBucket,
  filterAndSortByBucket,
  statusAccentClass,
  type ListStatusTone,
} from '@/lib/status-list';
import { jobStatusTone } from '@/lib/status-tone';
import {
  AU_STATE_OPTIONS,
  CLOX_LOAD_TYPES,
  CLOX_VEHICLE_SPECS,
  MAX_JOB_CHARGEABLE_WEIGHT_KG,
  MAX_JOB_DEAD_WEIGHT_KG,
  MAX_JOB_HEIGHT_CM,
  MAX_JOB_LENGTH_CM,
  MAX_JOB_WIDTH_CM,
  STATE_STOP_DEFAULTS,
  VEHICLE_CLASS_RANK,
  auPostcodeErrorForState,
  chargeableWeightKg,
  getStateStopDefaults,
  isChargeableOverLimit,
  isValidAuPostcodeForState,
  optionalPhoneSchema,
  requiredPhoneSchema,
} from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type SenderJobBucket =
  | 'draft'
  | 'bidding'
  | 'assigned'
  | 'in_transit'
  | 'completed'
  | 'closed';
type SenderJobFilter = 'all' | SenderJobBucket;

const SENDER_JOB_FILTERS = [
  'all',
  'draft',
  'bidding',
  'assigned',
  'in_transit',
  'completed',
  'closed',
] as const satisfies readonly SenderJobFilter[];

const SENDER_JOB_SORT: Record<SenderJobBucket, number> = {
  bidding: 0,
  assigned: 1,
  in_transit: 2,
  draft: 3,
  completed: 4,
  closed: 5,
};

const SENDER_JOB_TONE: Record<SenderJobBucket, ListStatusTone> = {
  draft: 'neutral',
  bidding: 'warn',
  assigned: 'info',
  in_transit: 'info',
  completed: 'ok',
  closed: 'danger',
};

function senderJobBucket(job: JobSummary): SenderJobBucket {
  switch (job.status) {
    case 'DRAFT':
      return 'draft';
    case 'PUBLISHED':
    case 'BIDDING':
      return 'bidding';
    case 'ASSIGNED':
      return 'assigned';
    case 'IN_TRANSIT':
      return 'in_transit';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
    case 'EXPIRED':
    default:
      return 'closed';
  }
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function JobsListPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const [viewMode, setViewMode] = useDataViewMode('jobs', 'list');
  const [statusFilter, setStatusFilter] = useState<SenderJobFilter>('all');
  const jobs = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: () => listSenderJobs(),
    enabled: role === AppRole.SENDER,
  });

  const items = jobs.data ?? [];
  const filterCounts = useMemo(
    () => countByBucket(items, senderJobBucket, SENDER_JOB_FILTERS),
    [items],
  );
  const filteredItems = useMemo(() => {
    const sorted = filterAndSortByBucket(
      items,
      senderJobBucket,
      statusFilter,
      SENDER_JOB_SORT,
    );
    // Within the same status bucket, jobs with open bids float first.
    return [...sorted].sort((a, b) => {
      const bucketDiff =
        SENDER_JOB_SORT[senderJobBucket(a)] - SENDER_JOB_SORT[senderJobBucket(b)];
      if (bucketDiff !== 0) return bucketDiff;
      const aBids = a.openProposalCount ?? 0;
      const bBids = b.openProposalCount ?? 0;
      if (aBids > 0 !== bBids > 0) return aBids > 0 ? -1 : 1;
      return bBids - aBids;
    });
  }, [items, statusFilter]);

  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedFilteredItems,
  } = useClientPagination(filteredItems, 10);

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (jobs.isLoading) return <LoadingBlock label={t('jobs.loadingList')} />;

  const jobCard = (j: JobSummary) => {
    const bucket = senderJobBucket(j);
    const created = formatWhen(j.createdAt);
    const completed = formatWhen(j.completedAt);
    const openBids = j.openProposalCount ?? 0;
    const hasOpenBids = openBids > 0;
    return (
      <Link
        to={`/jobs/${j.id}`}
        className={cn(
          'block h-full rounded-clox-md border p-4 shadow-clox-1 transition hover:border-clox-orange',
          statusAccentClass(SENDER_JOB_TONE[bucket]),
          hasOpenBids && 'ring-1 ring-[var(--status-warn)]/50',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-clox-ink">
              {j.title ?? j.id.slice(0, 8)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-clox-faint">
              {j.id.slice(0, 8)} · {j.pricingModel}
              {j.minVehicleClass ? ` · min ${j.minVehicleClass}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <StatusPill tone={jobStatusTone(j.status)}>
              {t(`jobStatuses.${j.status}`, { defaultValue: j.status })}
            </StatusPill>
            {hasOpenBids ? (
              <StatusPill tone="warn">
                {t('jobs.bidsWaiting', { count: openBids })}
              </StatusPill>
            ) : bucket === 'bidding' ? (
              <StatusPill tone="neutral">{t('jobs.noBidsYetShort')}</StatusPill>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-sm text-clox-mute">
          {j.estimate.incGstCents != null
            ? formatDollars(j.estimate.incGstCents)
            : t('dash')}
        </p>
        <div className="mt-2 space-y-0.5 text-[11px] text-clox-faint">
          {created ? (
            <p>{t('jobs.createdAt', { when: created })}</p>
          ) : null}
          {completed ? (
            <p>{t('jobs.completedAt', { when: completed })}</p>
          ) : null}
        </div>
      </Link>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">{t('jobs.listTitle')}</h1>
          <p className="mt-1 text-sm text-clox-mute">{t('jobs.listSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} className="hidden sm:inline-flex" />
          <Link to="/jobs/new" className="clox-btn clox-btn-cta">
            {t('jobs.newJob')}
          </Link>
        </div>
      </div>
      {jobs.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(jobs.error)}
        </Notice>
      ) : null}

      <div className="mt-4 sm:hidden">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {items.length > 0 ? (
        <StatusFilterChips
          className="mt-4"
          options={SENDER_JOB_FILTERS}
          value={statusFilter}
          counts={filterCounts}
          onChange={setStatusFilter}
          getLabel={(key) => t(`jobs.filter.${key}`)}
          aria-label={t('jobs.filterLabel')}
        />
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock title={t('jobs.emptyTitle')} description={t('jobs.emptyHint')} />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="mt-6 text-sm text-clox-faint">{t('jobs.emptyFilter')}</p>
      ) : viewMode === 'grid' ? (
        <>
          <DataCardList
            className="mt-6"
            items={pagedFilteredItems}
            getKey={(j) => j.id}
            mode="grid"
            renderItem={jobCard}
          />
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <>
          <ResponsiveDataView
            className="mt-6"
            cards={
              <DataCardList
                items={pagedFilteredItems}
                getKey={(j) => j.id}
                mode="list"
                renderItem={jobCard}
              />
            }
            table={
              <DataTable
                minWidthClassName="min-w-[56rem]"
                headers={[
                  t('jobs.colTitle'),
                  t('jobs.colStatus'),
                  t('jobs.colPricing'),
                  t('jobs.colClass'),
                  t('jobs.colEstimate'),
                  t('jobs.colBids'),
                  t('jobs.colCreated'),
                  t('jobs.colCompleted'),
                ]}
              >
                {pagedFilteredItems.map((j) => {
                  const openBids = j.openProposalCount ?? 0;
                  const hasOpenBids = openBids > 0;
                  const bucket = senderJobBucket(j);
                  return (
                    <tr
                      key={j.id}
                      className={cn(
                        'border-t border-clox-border-soft hover:bg-clox-surface-alt/60',
                        statusAccentClass(SENDER_JOB_TONE[bucket]),
                        hasOpenBids &&
                          'bg-[color-mix(in_srgb,var(--status-warn-bg)_35%,transparent)]',
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/jobs/${j.id}`}
                          className="font-medium text-clox-ink hover:text-clox-orange"
                        >
                          {j.title ?? j.id.slice(0, 8)}
                        </Link>
                        <p className="font-mono text-[11px] text-clox-faint">
                          {j.id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={jobStatusTone(j.status)}>
                          {t(`jobStatuses.${j.status}`, { defaultValue: j.status })}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-clox-mute">{j.pricingModel}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {j.minVehicleClass ?? t('dash')}
                      </td>
                      <td className="px-4 py-3 text-clox-mute">
                        {j.estimate.incGstCents != null
                          ? formatDollars(j.estimate.incGstCents)
                          : t('dash')}
                      </td>
                      <td className="px-4 py-3">
                        {hasOpenBids ? (
                          <StatusPill tone="warn">
                            {t('jobs.bidsWaiting', { count: openBids })}
                          </StatusPill>
                        ) : bucket === 'bidding' ? (
                          <span className="text-xs text-clox-faint">
                            {t('jobs.noBidsYetShort')}
                          </span>
                        ) : (
                          <span className="text-xs text-clox-faint">{t('dash')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-clox-mute">
                        {formatWhen(j.createdAt) ?? t('dash')}
                      </td>
                      <td className="px-4 py-3 text-xs text-clox-mute">
                        {formatWhen(j.completedAt) ?? t('dash')}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            }
          />
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function formatAbn(val?: string | null) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length !== 11) return val;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

const STATE_ANCHOR_COORDS: Record<string, { lat: number; lng: number }> = {
  VIC: { lat: -37.8136, lng: 144.9631 },
  NSW: { lat: -33.8688, lng: 151.2093 },
  QLD: { lat: -27.4705, lng: 153.026 },
  WA: { lat: -31.9523, lng: 115.8613 },
  SA: { lat: -34.9285, lng: 138.6007 },
  TAS: { lat: -42.8821, lng: 147.3272 },
  ACT: { lat: -35.2809, lng: 149.13 },
  NT: { lat: -12.4634, lng: 130.8456 },
};

function computeStopCoords(state: string, postcode: string, suburb: string, isDropoff: boolean) {
  const base = STATE_ANCHOR_COORDS[state.toUpperCase()] ?? STATE_ANCHOR_COORDS.VIC!;
  const pcNum = parseInt(postcode.replace(/\D/g, ''), 10);
  const offsetSeed = Number.isFinite(pcNum)
    ? ((pcNum % 100) - 30) * 0.0035
    : (suburb.trim().length % 20) * 0.005;
  const dir = isDropoff ? 1 : -1;
  return {
    lat: Number((base.lat + dir * (0.06 + offsetSeed)).toFixed(5)),
    lng: Number((base.lng - dir * (0.05 + offsetSeed * 0.8)).toFixed(5)),
  };
}

type ExtraPickupStopForm = {
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
};

type ExtraDropoffStopForm = {
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
  receiverName?: string;
  receiverEmail?: string;
};

type JobCreateForm = {
  pricingModel: 'PER_KM' | 'HOURLY';
  distanceKm?: number;
  pickupAddressLine: string;
  pickupSuburb: string;
  pickupState: string;
  pickupPostcode: string;
  extraPickups: ExtraPickupStopForm[];
  dropoffAddressLine: string;
  dropoffSuburb: string;
  dropoffState: string;
  dropoffPostcode: string;
  extraDropoffs: ExtraDropoffStopForm[];
  deadWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  loadDg: boolean;
  loadTypes: string[];
  minVehicleClass?: string;
  dgDocumentId?: string | null;
  receiverName: string;
  receiverEmail: string;
  receiverPhone: string;
  receiverAltEmail?: string;
  receiverAltPhone?: string;
  siteManeuverability: 'TIGHT_STREET' | 'STANDARD_INDUSTRIAL' | 'WIDE_YARD';
  siteFacility: 'RAISED_DOCK' | 'GROUND_LEVEL' | 'FORKLIFT_REQUIRED';
  siteDisclaimerAccepted: boolean;
};

export function normalizeManeuverability(
  val?: string | null,
): 'TIGHT_STREET' | 'STANDARD_INDUSTRIAL' | 'WIDE_YARD' {
  if (!val) return 'STANDARD_INDUSTRIAL';
  if (val === 'TIGHT' || val === 'TIGHT_STREET') return 'TIGHT_STREET';
  if (val === 'WIDE' || val === 'WIDE_YARD' || val === 'EASY') return 'WIDE_YARD';
  return 'STANDARD_INDUSTRIAL';
}

export function normalizeFacility(
  val?: string | null,
): 'RAISED_DOCK' | 'GROUND_LEVEL' | 'FORKLIFT_REQUIRED' {
  if (!val) return 'GROUND_LEVEL';
  if (val === 'DOCK' || val === 'RAISED_DOCK') return 'RAISED_DOCK';
  if (val === 'FORKLIFT' || val === 'FORKLIFT_REQUIRED') return 'FORKLIFT_REQUIRED';
  return 'GROUND_LEVEL';
}

export function formatManeuverabilityLabel(val?: string | null): string {
  if (!val) return '—';
  if (val === 'TIGHT_STREET' || val === 'TIGHT') return 'Tight Street';
  if (val === 'STANDARD_INDUSTRIAL' || val === 'MODERATE') return 'Standard Industrial';
  if (val === 'WIDE_YARD' || val === 'WIDE' || val === 'EASY') return 'Wide Yard';
  return val;
}

export function formatFacilityLabel(val?: string | null): string {
  if (!val) return '—';
  if (val === 'RAISED_DOCK' || val === 'DOCK') return 'Raised Loading Dock (48-52 inches)';
  if (val === 'GROUND_LEVEL' || val === 'GROUND') return 'Ground Level';
  if (val === 'FORKLIFT_REQUIRED' || val === 'FORKLIFT') return 'Forklift Required';
  return val;
}

function buildStopsFromForm(
  values: Pick<
    JobCreateForm,
    | 'pricingModel'
    | 'pickupAddressLine'
    | 'pickupSuburb'
    | 'pickupState'
    | 'pickupPostcode'
    | 'extraPickups'
    | 'dropoffAddressLine'
    | 'dropoffSuburb'
    | 'dropoffState'
    | 'dropoffPostcode'
    | 'extraDropoffs'
    | 'receiverName'
    | 'receiverEmail'
  >,
) {
  const pickupState = values.pickupState?.trim() || 'VIC';
  const pickupDefaults = getStateStopDefaults(pickupState);
  const pickupPostcode = values.pickupPostcode?.trim() || pickupDefaults.pickupPostcode;
  const pickupSuburb = values.pickupSuburb?.trim() || pickupDefaults.pickupSuburb;
  const pickupCoords = computeStopCoords(pickupState, pickupPostcode, pickupSuburb, false);

  const dropoffState = values.dropoffState?.trim() || pickupState;
  const dropoffDefaults = getStateStopDefaults(dropoffState);
  const dropoffPostcode = values.dropoffPostcode?.trim() || dropoffDefaults.dropoffPostcode;
  const dropoffSuburb = values.dropoffSuburb?.trim() || dropoffDefaults.dropoffSuburb;
  const dropoffCoords = computeStopCoords(dropoffState, dropoffPostcode, dropoffSuburb, true);

  const rawStops: Array<{
    stopType: 'PICKUP' | 'DROPOFF';
    addressLine: string;
    suburb: string;
    state: string;
    postcode: string;
    lat: number;
    lng: number;
    receiverName?: string;
    receiverEmail?: string;
  }> = [
    {
      stopType: 'PICKUP',
      addressLine: values.pickupAddressLine?.trim() || pickupDefaults.pickupAddressLine,
      suburb: pickupSuburb,
      state: pickupState,
      postcode: pickupPostcode,
      lat: pickupCoords.lat,
      lng: pickupCoords.lng,
    },
  ];

  if (values.pricingModel === 'HOURLY' && Array.isArray(values.extraPickups)) {
    values.extraPickups.forEach((p, idx) => {
      if (!p.addressLine?.trim() && !p.suburb?.trim()) return;
      const pState = p.state?.trim() || pickupState;
      const pDefaults = getStateStopDefaults(pState);
      const pPostcode = p.postcode?.trim() || pDefaults.pickupPostcode;
      const pSuburb = p.suburb?.trim() || pDefaults.pickupSuburb;
      const pCoords = computeStopCoords(pState, pPostcode, pSuburb, false);
      const jitter = (idx + 1) * 0.02;
      rawStops.push({
        stopType: 'PICKUP',
        addressLine: p.addressLine?.trim() || `${idx + 2} Pickup St`,
        suburb: pSuburb,
        state: pState,
        postcode: pPostcode,
        lat: Number((pCoords.lat - jitter).toFixed(5)),
        lng: Number((pCoords.lng - jitter).toFixed(5)),
      });
    });
  }

  rawStops.push({
    stopType: 'DROPOFF',
    addressLine: values.dropoffAddressLine?.trim() || dropoffDefaults.dropoffAddressLine,
    suburb: dropoffSuburb,
    state: dropoffState,
    postcode: dropoffPostcode,
    lat: dropoffCoords.lat,
    lng: dropoffCoords.lng,
    receiverName: values.receiverName?.trim() || undefined,
    receiverEmail: values.receiverEmail?.trim() || undefined,
  });

  if (values.pricingModel === 'HOURLY' && Array.isArray(values.extraDropoffs)) {
    values.extraDropoffs.forEach((d, idx) => {
      if (!d.addressLine?.trim() && !d.suburb?.trim()) return;
      const dState = d.state?.trim() || dropoffState;
      const dDefaults = getStateStopDefaults(dState);
      const dPostcode = d.postcode?.trim() || dDefaults.dropoffPostcode;
      const dSuburb = d.suburb?.trim() || dDefaults.dropoffSuburb;
      const dCoords = computeStopCoords(dState, dPostcode, dSuburb, true);
      const jitter = (idx + 1) * 0.025;
      rawStops.push({
        stopType: 'DROPOFF',
        addressLine: d.addressLine?.trim() || `${idx + 2} Dropoff St`,
        suburb: dSuburb,
        state: dState,
        postcode: dPostcode,
        lat: Number((dCoords.lat + jitter).toFixed(5)),
        lng: Number((dCoords.lng + jitter).toFixed(5)),
        receiverName:
          d.receiverName?.trim() || values.receiverName?.trim() || undefined,
        receiverEmail:
          d.receiverEmail?.trim() || values.receiverEmail?.trim() || undefined,
      });
    });
  }

  return rawStops.map((s, idx) => ({
    sequence: idx,
    ...s,
  }));
}

function buildJobTitle(
  values: JobCreateForm,
  stops: ReturnType<typeof buildStopsFromForm>,
): string {
  const pickups = stops
    .filter((s) => s.stopType === 'PICKUP')
    .map((s) => s.suburb?.trim())
    .filter((s): s is string => Boolean(s));
  const origin =
    pickups.length === 0
      ? 'Pickup'
      : pickups.length === 1
        ? pickups[0]!
        : pickups.join(' / ');
  const dropoffs = stops
    .filter((s) => s.stopType === 'DROPOFF')
    .map((s) => s.suburb?.trim())
    .filter((s): s is string => Boolean(s));
  const destination =
    dropoffs.length === 0
      ? 'Dropoff'
      : dropoffs.length === 1
        ? dropoffs[0]!
        : dropoffs.join(' / ');
  return `${origin} → ${destination} · ${values.pricingModel} · ${values.deadWeightKg}kg`;
}

function buildJobPayload(values: JobCreateForm) {
  const loadTypes =
    Array.isArray(values.loadTypes) && values.loadTypes.length > 0
      ? values.loadTypes
      : values.loadDg
        ? ['GENERAL', 'DG']
        : ['GENERAL'];
  const requiresDg = loadTypes.includes('DG');
  const stops = buildStopsFromForm(values);
  const pickupCount = stops.filter((s) => s.stopType === 'PICKUP').length;
  return {
    title: buildJobTitle(values, stops),
    pricingModel: values.pricingModel,
    hourlyPattern:
      values.pricingModel === 'HOURLY'
        ? pickupCount > 1
          ? ('B' as const)
          : ('A' as const)
        : undefined,
    pickupAt: new Date(Date.now() + 86_400_000).toISOString(),
    receiverName: values.receiverName.trim(),
    receiverEmail: values.receiverEmail.trim(),
    receiverPhone: values.receiverPhone.trim(),
    receiverAltEmail: values.receiverAltEmail?.trim() || null,
    receiverAltPhone: values.receiverAltPhone?.trim() || null,
    dgDocumentId: requiresDg ? (values.dgDocumentId ?? null) : null,
    minVehicleClass: values.minVehicleClass || undefined,
    deadWeightKg: values.deadWeightKg,
    lengthCm: values.lengthCm,
    widthCm: values.widthCm,
    heightCm: values.heightCm,
    ...(values.pricingModel === 'PER_KM' && Number.isFinite(values.distanceKm)
      ? { distanceKm: values.distanceKm }
      : {}),
    loadTypes,
    siteManeuverability: values.siteManeuverability,
    siteFacility: values.siteFacility,
    siteDisclaimerAccepted: true as const,
    stops,
  };
}

export function JobCreatePage() {
  return <JobDraftForm mode="create" />;
}

export function JobEditPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const toast = useToast();

  const existing = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => getSenderJob(id),
    enabled: role === AppRole.SENDER && Boolean(id),
  });

  useEffect(() => {
    if (!existing.data?.editability) return;
    if (existing.data.editability.mode === 'NONE') {
      toast.warn(existing.data.editability.reason || t('jobs.editNotAllowed'));
      navigate(`/jobs/${id}`, { replace: true });
    }
  }, [existing.data, id, navigate, t, toast]);

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (existing.isLoading) return <LoadingBlock label={t('jobs.loadingDetail')} />;
  if (existing.isError || !existing.data) {
    return <Notice tone="error">{getErrorDetail(existing.error)}</Notice>;
  }

  const mode = existing.data.editability?.mode ?? 'NONE';
  if (mode === 'RECEIVER') {
    return <JobReceiverForm jobId={id} job={existing.data} />;
  }
  if (mode === 'FULL') {
    return <JobDraftForm mode="edit" jobId={id} />;
  }
  return <LoadingBlock label={t('jobs.loadingDetail')} />;
}

type ReceiverWizardStep = 'primary' | 'dropoffs';

function JobReceiverForm({ jobId, job }: { jobId: string; job: JobSummary }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const dropoffs = (job.stops ?? []).filter((s) => s.stopType === 'DROPOFF' && s.id);
  const hasMultiDropoffs = dropoffs.length > 1;
  const [step, setStep] = useState<ReceiverWizardStep>('primary');

  const schema = z.object({
    receiverName: z.string().trim().min(1, t('validation.receiverNameRequired')),
    receiverEmail: z
      .string()
      .trim()
      .min(1, t('validation.receiverEmailRequired'))
      .email(t('validation.receiverEmailInvalid')),
    receiverPhone: requiredPhoneSchema(
      t('validation.receiverPhoneRequired', { defaultValue: 'Enter receiver phone number' }),
      t('validation.receiverPhoneInvalid', {
        defaultValue: 'Enter a valid Australian phone number (e.g. 04xx xxx xxx or +61...)',
      }),
    ),
    receiverAltEmail: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: t('validation.receiverEmailInvalid'),
      }),
    receiverAltPhone: optionalPhoneSchema(
      t('validation.receiverPhoneInvalid', {
        defaultValue: 'Enter a valid Australian phone number (e.g. 04xx xxx xxx or +61...)',
      }),
    ),
  });

  type ReceiverForm = z.infer<typeof schema>;

  const form = useForm<ReceiverForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      receiverName: job.receiverName || '',
      receiverEmail: job.receiverEmail || '',
      receiverPhone: job.receiverPhone || '',
      receiverAltEmail: job.receiverAltEmail || '',
      receiverAltPhone: job.receiverAltPhone || '',
    },
  });

  const [stopReceivers, setStopReceivers] = useState<
    Record<string, { receiverName: string; receiverEmail: string }>
  >(() => {
    const initial: Record<string, { receiverName: string; receiverEmail: string }> = {};
    for (const s of dropoffs) {
      if (!s.id) continue;
      initial[s.id] = {
        receiverName: s.receiverName || job.receiverName || '',
        receiverEmail: s.receiverEmail || job.receiverEmail || '',
      };
    }
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (values: ReceiverForm) =>
      updateJobReceiver(jobId, {
        receiverName: values.receiverName.trim(),
        receiverEmail: values.receiverEmail.trim(),
        receiverPhone: values.receiverPhone.trim(),
        receiverAltEmail: values.receiverAltEmail?.trim() || null,
        receiverAltPhone: values.receiverAltPhone?.trim() || null,
        stops: dropoffs
          .filter((s): s is typeof s & { id: string } => Boolean(s.id))
          .map((s) => ({
            id: s.id,
            receiverName: stopReceivers[s.id]?.receiverName?.trim() || null,
            receiverEmail: stopReceivers[s.id]?.receiverEmail?.trim() || null,
          })),
      }),
    onSuccess: async () => {
      toast.success(t('jobs.receiverUpdated'));
      await qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      navigate(`/jobs/${jobId}`, { replace: true });
    },
  });

  const goNextFromPrimary = async () => {
    const ok = await form.trigger([
      'receiverName',
      'receiverEmail',
      'receiverPhone',
      'receiverAltEmail',
      'receiverAltPhone',
    ]);
    if (!ok) return;
    if (hasMultiDropoffs) {
      setStep('dropoffs');
      return;
    }
    await form.handleSubmit((values) => mutation.mutate(values))();
  };

  const selectReceiverStep = async (next: ReceiverWizardStep) => {
    if (next === step) return;
    if (next === 'dropoffs' && step === 'primary') {
      const ok = await form.trigger([
        'receiverName',
        'receiverEmail',
        'receiverPhone',
        'receiverAltEmail',
        'receiverAltPhone',
      ]);
      if (!ok) return;
    }
    setStep(next);
  };

  const primaryFields = (
    <>
      <Field
        label={t('jobs.receiverName')}
        required
        error={form.formState.errors.receiverName?.message}
        {...form.register('receiverName')}
      />
      <Field
        label={t('jobs.receiverEmail')}
        required
        type="email"
        error={form.formState.errors.receiverEmail?.message}
        {...form.register('receiverEmail')}
      />
      <Field
        label={t('jobs.receiverPhone')}
        required
        type="tel"
        placeholder={t('jobs.placeholderReceiverPhone', { defaultValue: '+61 400 000 000' })}
        error={form.formState.errors.receiverPhone?.message}
        {...form.register('receiverPhone')}
      />
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-2">
        <Field
          label={t('jobs.receiverAltEmail', { defaultValue: 'Alternate Email (optional)' })}
          type="email"
          placeholder={t('jobs.placeholderReceiverAltEmail', {
            defaultValue: 'secondary@example.com',
          })}
          error={form.formState.errors.receiverAltEmail?.message}
          {...form.register('receiverAltEmail')}
        />
        <Field
          label={t('jobs.receiverAltPhone', { defaultValue: 'Alternate Phone (optional)' })}
          type="tel"
          placeholder={t('jobs.placeholderReceiverAltPhone', {
            defaultValue: '+61 3 9000 0000',
          })}
          error={form.formState.errors.receiverAltPhone?.message}
          {...form.register('receiverAltPhone')}
        />
      </div>
    </>
  );

  const dropoffFields = dropoffs.map((s) =>
    s.id ? (
      <div
        key={s.id}
        className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4"
      >
        <p className="mb-3 text-sm font-semibold text-clox-ink">
          {t('jobs.dropoffReceiver', {
            suburb: s.suburb ?? s.sequence,
          })}
        </p>
        <Field
          label={t('jobs.receiverName')}
          value={stopReceivers[s.id]?.receiverName ?? ''}
          onChange={(e) =>
            setStopReceivers((prev) => ({
              ...prev,
              [s.id!]: {
                receiverName: e.target.value,
                receiverEmail: prev[s.id!]?.receiverEmail ?? '',
              },
            }))
          }
        />
        <Field
          label={t('jobs.receiverEmail')}
          type="email"
          value={stopReceivers[s.id]?.receiverEmail ?? ''}
          onChange={(e) =>
            setStopReceivers((prev) => ({
              ...prev,
              [s.id!]: {
                receiverName: prev[s.id!]?.receiverName ?? '',
                receiverEmail: e.target.value,
              },
            }))
          }
        />
      </div>
    ) : null,
  );

  return (
    <div className="max-w-2xl">
      <Link to={`/jobs/${jobId}`} className="text-sm text-clox-orange hover:underline">
        ← {t('jobs.backToJob')}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {t('jobs.editReceiverTitle')}
          </h1>
          <p className="mt-1 text-sm text-clox-mute">{t('jobs.editReceiverHint')}</p>
        </div>
        <StatusPill tone={jobStatusTone(job.status)}>
          {t(`jobStatuses.${job.status}`, { defaultValue: job.status })}
        </StatusPill>
      </div>

      {hasMultiDropoffs ? (
        <StepChips
          className="mt-4"
          current={step}
          steps={[
            { id: 'primary', label: t('jobs.wizard.stepPrimary') },
            { id: 'dropoffs', label: t('jobs.wizard.stepDropoffs') },
          ]}
          onStepSelect={(id) => void selectReceiverStep(id as ReceiverWizardStep)}
          canSelectStep={() => true}
        />
      ) : null}

      <form
        className="mt-6"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {(!hasMultiDropoffs || step === 'primary') && primaryFields}
        {hasMultiDropoffs && step === 'dropoffs' ? (
          <div className="space-y-4">{dropoffFields}</div>
        ) : null}

        {mutation.isError ? (
          <Notice tone="error" className="mt-4">
            {getErrorDetail(mutation.error)}
          </Notice>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {hasMultiDropoffs && step === 'dropoffs' ? (
            <Button type="button" variant="secondary" onClick={() => setStep('primary')}>
              {t('jobs.wizard.back')}
            </Button>
          ) : null}
          <Link to={`/jobs/${jobId}`} className="clox-btn clox-btn-ghost">
            {t('jobs.wizard.cancel')}
          </Link>
          {hasMultiDropoffs && step === 'primary' ? (
            <Button type="button" variant="cta" onClick={() => void goNextFromPrimary()}>
              {t('jobs.wizard.next')}
            </Button>
          ) : (
            <Button type="submit" variant="cta" disabled={mutation.isPending}>
              {mutation.isPending ? t('submitting') : t('jobs.saveReceiver')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

const DRAFT_WIZARD_STEPS = ['pricing', 'cargo', 'receiver', 'confirm'] as const;
type DraftWizardStep = (typeof DRAFT_WIZARD_STEPS)[number];

const DRAFT_STEP_FIELDS: Record<DraftWizardStep, (keyof JobCreateForm)[]> = {
  pricing: [
    'pricingModel',
    'pickupAddressLine',
    'pickupSuburb',
    'pickupState',
    'pickupPostcode',
    'extraPickups',
    'dropoffAddressLine',
    'dropoffSuburb',
    'dropoffState',
    'dropoffPostcode',
    'extraDropoffs',
    'distanceKm',
  ],
  cargo: [
    'deadWeightKg',
    'lengthCm',
    'widthCm',
    'heightCm',
    'loadDg',
    'loadTypes',
    'minVehicleClass',
    'dgDocumentId',
  ],
  receiver: [
    'receiverName',
    'receiverEmail',
    'receiverPhone',
    'receiverAltEmail',
    'receiverAltPhone',
  ],
  confirm: ['siteManeuverability', 'siteFacility', 'siteDisclaimerAccepted'],
};

function JobDraftForm({
  mode,
  jobId = '',
}: {
  mode: 'create' | 'edit';
  jobId?: string;
}) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = mode === 'edit';
  const [step, setStep] = useState<DraftWizardStep>('pricing');
  const cancelTo = isEdit && jobId ? `/jobs/${jobId}` : '/jobs';

  const [showAddressDetails, setShowAddressDetails] = useState(false);

  const senderOnboarding = useQuery({
    queryKey: ['sender', 'onboarding'],
    queryFn: getSenderOnboarding,
    enabled: role === AppRole.SENDER,
  });
  const regionsMeta = useQuery({
    queryKey: ['jobs', 'meta', 'regions'],
    queryFn: getRegionsMeta,
    enabled: role === AppRole.SENDER,
    staleTime: 60_000,
  });
  const senderCompanyId = senderOnboarding.data?.company.id;
  const company = senderOnboarding.data?.company;
  const enabledStateCodes = useMemo(() => {
    const codes = regionsMeta.data?.enabledCodes;
    return codes && codes.length > 0 ? new Set(codes) : null;
  }, [regionsMeta.data?.enabledCodes]);
  const senderDefaultState = useMemo(() => {
    const candidate = (company?.homeRegionCode || company?.invoiceState || '').trim().toUpperCase();
    if (candidate && (!enabledStateCodes || enabledStateCodes.has(candidate))) {
      return candidate;
    }
    return regionsMeta.data?.enabledCodes?.[0] || candidate || 'VIC';
  }, [company?.homeRegionCode, company?.invoiceState, enabledStateCodes, regionsMeta.data?.enabledCodes]);
  const hasAbn = Boolean(company?.abn);
  const formattedCompanyAbn = useMemo(() => formatAbn(company?.abn), [company?.abn]);

  const [dgDocFilename, setDgDocFilename] = useState<string | null>(null);
  const [dgUploading, setDgUploading] = useState(false);

  const schema = z
    .object({
      pricingModel: z.enum(['PER_KM', 'HOURLY']),
      distanceKm: z
        .number()
        .optional()
        .transform((v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v)),
      pickupAddressLine: z
        .string()
        .trim()
        .min(2, t('validation.pickupAddressRequired', { defaultValue: 'Enter pickup street address' })),
      pickupSuburb: z
        .string()
        .trim()
        .min(2, t('validation.pickupSuburbRequired', { defaultValue: 'Enter pickup suburb' })),
      pickupState: z.string().trim().min(2),
      pickupPostcode: z
        .string()
        .trim()
        .regex(/^\d{4}$/, t('validation.postcodeInvalid', { defaultValue: 'Enter a 4-digit postcode' })),
      extraPickups: z.array(
        z.object({
          addressLine: z.string().trim(),
          suburb: z.string().trim(),
          state: z.string().trim(),
          postcode: z.string().trim(),
        }),
      ),
      dropoffAddressLine: z
        .string()
        .trim()
        .min(2, t('validation.dropoffAddressRequired', { defaultValue: 'Enter dropoff street address' })),
      dropoffSuburb: z
        .string()
        .trim()
        .min(2, t('validation.dropoffSuburbRequired', { defaultValue: 'Enter dropoff suburb' })),
      dropoffState: z.string().trim().min(2),
      dropoffPostcode: z
        .string()
        .trim()
        .regex(/^\d{4}$/, t('validation.postcodeInvalid', { defaultValue: 'Enter a 4-digit postcode' })),
      extraDropoffs: z.array(
        z.object({
          addressLine: z.string().trim(),
          suburb: z.string().trim(),
          state: z.string().trim(),
          postcode: z.string().trim(),
          receiverName: z.string().trim().optional(),
          receiverEmail: z.string().trim().optional(),
        }),
      ),
      deadWeightKg: z
        .number({ message: t('validation.weightPositive') })
        .positive(t('validation.weightPositive'))
        .max(
          MAX_JOB_DEAD_WEIGHT_KG,
          t('validation.weightMax', { max: MAX_JOB_DEAD_WEIGHT_KG }),
        ),
      lengthCm: z
        .number({ message: t('validation.dimensionPositive') })
        .positive(t('validation.dimensionPositive'))
        .max(MAX_JOB_LENGTH_CM, t('validation.lengthMax', { max: MAX_JOB_LENGTH_CM })),
      widthCm: z
        .number({ message: t('validation.dimensionPositive') })
        .positive(t('validation.dimensionPositive'))
        .max(MAX_JOB_WIDTH_CM, t('validation.widthMax', { max: MAX_JOB_WIDTH_CM })),
      heightCm: z
        .number({ message: t('validation.dimensionPositive') })
        .positive(t('validation.dimensionPositive'))
        .max(MAX_JOB_HEIGHT_CM, t('validation.heightMax', { max: MAX_JOB_HEIGHT_CM })),
      loadDg: z.boolean(),
      loadTypes: z.array(z.string()).default(['GENERAL']),
      minVehicleClass: z.string().optional(),
      dgDocumentId: z.string().uuid().nullable().optional(),
      receiverName: z.string().trim().min(1, t('validation.receiverNameRequired')),
      receiverEmail: z
        .string()
        .trim()
        .min(1, t('validation.receiverEmailRequired'))
        .email(t('validation.receiverEmailInvalid')),
      receiverPhone: requiredPhoneSchema(
        t('validation.receiverPhoneRequired', { defaultValue: 'Enter receiver phone number' }),
        t('validation.receiverPhoneInvalid', {
          defaultValue: 'Enter a valid Australian phone number (e.g. 04xx xxx xxx or +61...)',
        }),
      ),
      receiverAltEmail: z
        .string()
        .trim()
        .optional()
        .refine((v) => !v || z.string().email().safeParse(v).success, {
          message: t('validation.receiverEmailInvalid'),
        }),
      receiverAltPhone: optionalPhoneSchema(
        t('validation.receiverPhoneInvalid', {
          defaultValue: 'Enter a valid Australian phone number (e.g. 04xx xxx xxx or +61...)',
        }),
      ),
      siteManeuverability: z.enum(['TIGHT_STREET', 'STANDARD_INDUSTRIAL', 'WIDE_YARD']),
      siteFacility: z.enum(['RAISED_DOCK', 'GROUND_LEVEL', 'FORKLIFT_REQUIRED']),
      siteDisclaimerAccepted: z.boolean().refine((value) => value === true, {
        message: t('validation.siteDisclaimerRequired'),
      }),
    })
    .superRefine((values, ctx) => {
      if (
        values.pricingModel === 'PER_KM' &&
        (values.distanceKm == null || !Number.isFinite(values.distanceKm) || values.distanceKm <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['distanceKm'],
          message: t('validation.distancePositive'),
        });
      }
      if (!isValidAuPostcodeForState(values.pickupPostcode, values.pickupState)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pickupPostcode'],
          message: auPostcodeErrorForState(values.pickupState),
        });
      }
      if (!isValidAuPostcodeForState(values.dropoffPostcode, values.dropoffState)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dropoffPostcode'],
          message: auPostcodeErrorForState(values.dropoffState),
        });
      }
      const chargeable = chargeableWeightKg({
        deadWeightKg: values.deadWeightKg,
        lengthCm: values.lengthCm,
        widthCm: values.widthCm,
        heightCm: values.heightCm,
      });
      if (isChargeableOverLimit(chargeable)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadWeightKg'],
          message: t('validation.chargeableOverLimit', {
            kg: chargeable.toFixed(1),
            max: MAX_JOB_CHARGEABLE_WEIGHT_KG,
          }),
        });
      }
      if ((values.loadDg || values.loadTypes?.includes('DG')) && !values.dgDocumentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dgDocumentId'],
          message: t('validation.dgDocumentRequired', {
            defaultValue: 'Please upload the Dangerous Goods (DG) document for this load',
          }),
        });
      }
      if (values.pricingModel === 'HOURLY') {
        values.extraPickups.forEach((p, idx) => {
          if (!p.addressLine || p.addressLine.length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraPickups', idx, 'addressLine'],
              message: t('validation.pickupAddressRequired', {
                defaultValue: `Enter pickup #${idx + 2} street address`,
              }),
            });
          }
          if (!p.suburb || p.suburb.length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraPickups', idx, 'suburb'],
              message: t('validation.pickupSuburbRequired', {
                defaultValue: `Enter pickup #${idx + 2} suburb`,
              }),
            });
          }
          const pState = p.state?.trim() || values.pickupState?.trim() || senderDefaultState;
          if (!isValidAuPostcodeForState(p.postcode, pState)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraPickups', idx, 'postcode'],
              message: auPostcodeErrorForState(pState),
            });
          }
        });

        values.extraDropoffs.forEach((d, idx) => {
          if (!d.addressLine || d.addressLine.length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraDropoffs', idx, 'addressLine'],
              message: t('validation.dropoffAddressRequired', {
                defaultValue: `Enter dropoff #${idx + 2} street address`,
              }),
            });
          }
          if (!d.suburb || d.suburb.length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraDropoffs', idx, 'suburb'],
              message: t('validation.dropoffSuburbRequired', {
                defaultValue: `Enter dropoff #${idx + 2} suburb`,
              }),
            });
          }
          const dState = d.state?.trim() || values.dropoffState?.trim() || senderDefaultState;
          if (!isValidAuPostcodeForState(d.postcode, dState)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraDropoffs', idx, 'postcode'],
              message: auPostcodeErrorForState(dState),
            });
          }
          if (
            d.receiverEmail &&
            !z.string().email().safeParse(d.receiverEmail).success
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['extraDropoffs', idx, 'receiverEmail'],
              message: t('validation.receiverEmailInvalid'),
            });
          }
        });
      }
    });

  const initialStopDefaults = getStateStopDefaults(senderDefaultState);
  const form = useForm<JobCreateForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      pricingModel: 'PER_KM',
      distanceKm: undefined,
      pickupAddressLine: initialStopDefaults.pickupAddressLine,
      pickupSuburb: initialStopDefaults.pickupSuburb,
      pickupState: senderDefaultState,
      pickupPostcode: initialStopDefaults.pickupPostcode,
      extraPickups: [],
      dropoffAddressLine: initialStopDefaults.dropoffAddressLine,
      dropoffSuburb: initialStopDefaults.dropoffSuburb,
      dropoffState: senderDefaultState,
      dropoffPostcode: initialStopDefaults.dropoffPostcode,
      extraDropoffs: [],
      deadWeightKg: 800,
      lengthCm: 120,
      widthCm: 80,
      heightCm: 80,
      loadDg: false,
      loadTypes: ['GENERAL'],
      minVehicleClass: undefined,
      dgDocumentId: null,
      receiverName: '',
      receiverEmail: '',
      receiverPhone: '',
      receiverAltEmail: '',
      receiverAltPhone: '',
      siteManeuverability: 'STANDARD_INDUSTRIAL',
      siteFacility: 'GROUND_LEVEL',
      siteDisclaimerAccepted: false,
    },
  });

  const extraPickupsArray = useFieldArray({
    control: form.control,
    name: 'extraPickups',
  });

  const extraDropoffsArray = useFieldArray({
    control: form.control,
    name: 'extraDropoffs',
  });

  const existing = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getSenderJob(jobId),
    enabled: isEdit && role === AppRole.SENDER && Boolean(jobId),
  });

  const lastSuggestedKm = useRef<number | null>(null);
  const [suggestedKm, setSuggestedKm] = useState<number | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<JobRouteEstimate | null>(null);
  const hydratedEdit = useRef(false);

  useEffect(() => {
    if (!existing.data) return;
    if (existing.data.editability?.mode === 'NONE') {
      toast.warn(existing.data.editability.reason || t('jobs.editNotAllowed'));
      navigate(`/jobs/${jobId}`, { replace: true });
      return;
    }
    if (existing.data.editability?.mode === 'RECEIVER') {
      navigate(`/jobs/${jobId}/edit`, { replace: true });
      return;
    }
    const savedKm = Number(existing.data.route.distanceKm);
    const pickupStops = (existing.data.stops ?? []).filter((s) => s.stopType === 'PICKUP');
    const pickupStop = pickupStops[0];
    const resolvedPickupState = pickupStop?.state || senderDefaultState;
    const pickupDefaults = getStateStopDefaults(resolvedPickupState);
    const remainingPickups = pickupStops.slice(1).map((s) => ({
      addressLine: s.addressLine || '',
      suburb: s.suburb || '',
      state: s.state || resolvedPickupState,
      postcode: s.postcode || '',
    }));
    const dropoffStops = (existing.data.stops ?? []).filter((s) => s.stopType === 'DROPOFF');
    const drop1 = dropoffStops[0];
    const resolvedDropoffState = drop1?.state || resolvedPickupState;
    const dropoffDefaults = getStateStopDefaults(resolvedDropoffState);
    const remainingDropoffs = dropoffStops.slice(1).map((s) => ({
      addressLine: s.addressLine || '',
      suburb: s.suburb || '',
      state: s.state || resolvedDropoffState,
      postcode: s.postcode || '',
      receiverName: s.receiverName || '',
      receiverEmail: s.receiverEmail || '',
    }));

    if (existing.data.dgDocumentFilename) {
      setDgDocFilename(existing.data.dgDocumentFilename);
    }

    form.reset({
      pricingModel: existing.data.pricingModel === 'HOURLY' ? 'HOURLY' : 'PER_KM',
      distanceKm: Number.isFinite(savedKm) && savedKm > 0 ? savedKm : undefined,
      pickupAddressLine: pickupStop?.addressLine || pickupDefaults.pickupAddressLine,
      pickupSuburb: pickupStop?.suburb || pickupDefaults.pickupSuburb,
      pickupState: resolvedPickupState,
      pickupPostcode: pickupStop?.postcode || pickupDefaults.pickupPostcode,
      extraPickups: remainingPickups,
      dropoffAddressLine: drop1?.addressLine || dropoffDefaults.dropoffAddressLine,
      dropoffSuburb: drop1?.suburb || dropoffDefaults.dropoffSuburb,
      dropoffState: resolvedDropoffState,
      dropoffPostcode: drop1?.postcode || dropoffDefaults.dropoffPostcode,
      extraDropoffs: remainingDropoffs,
      deadWeightKg: Number(existing.data.deadWeightKg) || 800,
      lengthCm: Number(existing.data.lengthCm) || 120,
      widthCm: Number(existing.data.widthCm) || 80,
      heightCm: Number(existing.data.heightCm) || 80,
      loadDg: Boolean(existing.data.requiresDg),
      loadTypes:
        Array.isArray(existing.data.loadTypes) && existing.data.loadTypes.length > 0
          ? existing.data.loadTypes
          : ['GENERAL'],
      minVehicleClass: existing.data.minVehicleClass || undefined,
      dgDocumentId: existing.data.dgDocumentId ?? null,
      receiverName: existing.data.receiverName || '',
      receiverEmail: existing.data.receiverEmail || '',
      receiverPhone: existing.data.receiverPhone || '',
      receiverAltEmail: existing.data.receiverAltEmail || '',
      receiverAltPhone: existing.data.receiverAltPhone || '',
      siteManeuverability: normalizeManeuverability(existing.data.siteManeuverability),
      siteFacility: normalizeFacility(existing.data.siteFacility),
      siteDisclaimerAccepted: true,
    });
    if (Number.isFinite(savedKm) && savedKm > 0) {
      lastSuggestedKm.current = savedKm;
      setSuggestedKm(savedKm);
    }
    hydratedEdit.current = true;
    // Prefill once when draft job loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot hydrate
  }, [existing.data]);

  const pricingModel = form.watch('pricingModel');
  const pickupAddressLine = form.watch('pickupAddressLine');
  const pickupSuburb = form.watch('pickupSuburb');
  const pickupState = form.watch('pickupState');
  const pickupPostcode = form.watch('pickupPostcode');
  const extraPickups = form.watch('extraPickups');
  const dropoffAddressLine = form.watch('dropoffAddressLine');
  const dropoffSuburb = form.watch('dropoffSuburb');
  const dropoffState = form.watch('dropoffState');
  const dropoffPostcode = form.watch('dropoffPostcode');
  const extraDropoffs = form.watch('extraDropoffs');
  const receiverName = form.watch('receiverName');
  const receiverEmail = form.watch('receiverEmail');
  const receiverPhone = form.watch('receiverPhone');
  const receiverAltEmail = form.watch('receiverAltEmail');
  const receiverAltPhone = form.watch('receiverAltPhone');
  const deadWeightKg = form.watch('deadWeightKg');
  const lengthCm = form.watch('lengthCm');
  const widthCm = form.watch('widthCm');
  const heightCm = form.watch('heightCm');
  const distanceKm = form.watch('distanceKm');
  const loadTypes = form.watch('loadTypes') ?? ['GENERAL'];
  const minVehicleClass = form.watch('minVehicleClass');
  const dgDocumentId = form.watch('dgDocumentId');

  const extraStopsSignature = JSON.stringify({
    extraPickups: (extraPickups ?? []).map((p) => [p.state, p.postcode, p.suburb, p.addressLine]),
    extraDropoffs: (extraDropoffs ?? []).map((d) => [d.state, d.postcode, d.suburb, d.addressLine]),
  });

  useEffect(() => {
    if (isEdit) return;
    const isPresetPickup = Object.values(STATE_STOP_DEFAULTS).some(
      (d) =>
        d.pickupAddressLine === form.getValues('pickupAddressLine') &&
        d.pickupSuburb === form.getValues('pickupSuburb') &&
        d.pickupPostcode === form.getValues('pickupPostcode'),
    );
    if (!form.formState.dirtyFields.pickupState && isPresetPickup) {
      const def = getStateStopDefaults(senderDefaultState);
      form.setValue('pickupState', senderDefaultState);
      form.setValue('pickupAddressLine', def.pickupAddressLine);
      form.setValue('pickupSuburb', def.pickupSuburb);
      form.setValue('pickupPostcode', def.pickupPostcode);
    }
    const isPresetDropoff = Object.values(STATE_STOP_DEFAULTS).some(
      (d) =>
        d.dropoffAddressLine === form.getValues('dropoffAddressLine') &&
        d.dropoffSuburb === form.getValues('dropoffSuburb') &&
        d.dropoffPostcode === form.getValues('dropoffPostcode'),
    );
    if (!form.formState.dirtyFields.dropoffState && isPresetDropoff) {
      const def = getStateStopDefaults(senderDefaultState);
      form.setValue('dropoffState', senderDefaultState);
      form.setValue('dropoffAddressLine', def.dropoffAddressLine);
      form.setValue('dropoffSuburb', def.dropoffSuburb);
      form.setValue('dropoffPostcode', def.dropoffPostcode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync initial default state when sender profile or regions load
  }, [senderDefaultState, isEdit]);

  useEffect(() => {
    if (isEdit || !pickupState) return;
    const isPresetPickup = Object.values(STATE_STOP_DEFAULTS).some(
      (d) =>
        d.pickupAddressLine === form.getValues('pickupAddressLine') &&
        d.pickupSuburb === form.getValues('pickupSuburb') &&
        d.pickupPostcode === form.getValues('pickupPostcode'),
    );
    if (isPresetPickup) {
      const def = getStateStopDefaults(pickupState);
      form.setValue('pickupAddressLine', def.pickupAddressLine, { shouldValidate: true });
      form.setValue('pickupSuburb', def.pickupSuburb, { shouldValidate: true });
      form.setValue('pickupPostcode', def.pickupPostcode, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update untouched default pickup fields when state changes
  }, [pickupState, isEdit]);

  useEffect(() => {
    if (isEdit || !dropoffState) return;
    const isPresetDropoff = Object.values(STATE_STOP_DEFAULTS).some(
      (d) =>
        d.dropoffAddressLine === form.getValues('dropoffAddressLine') &&
        d.dropoffSuburb === form.getValues('dropoffSuburb') &&
        d.dropoffPostcode === form.getValues('dropoffPostcode'),
    );
    if (isPresetDropoff) {
      const def = getStateStopDefaults(dropoffState);
      form.setValue('dropoffAddressLine', def.dropoffAddressLine, { shouldValidate: true });
      form.setValue('dropoffSuburb', def.dropoffSuburb, { shouldValidate: true });
      form.setValue('dropoffPostcode', def.dropoffPostcode, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update untouched default dropoff fields when state changes
  }, [dropoffState, isEdit]);

  useEffect(() => {
    if (role !== AppRole.SENDER) return;
    if (isEdit && !hydratedEdit.current) return;
    let cancelled = false;
    const stops = buildStopsFromForm({
      pricingModel,
      pickupAddressLine,
      pickupSuburb,
      pickupState,
      pickupPostcode,
      extraPickups: extraPickups ?? [],
      dropoffAddressLine,
      dropoffSuburb,
      dropoffState,
      dropoffPostcode,
      extraDropoffs: extraDropoffs ?? [],
      receiverName: receiverName.trim() || 'Receiver',
      receiverEmail: receiverEmail.trim() || 'receiver@example.com',
    });
    void previewJobRoute({ pricingModel, stops })
      .then((route) => {
        if (cancelled) return;
        setRouteEstimate(route);
        setSuggestedKm(route.distanceKm);
        const current = form.getValues('distanceKm');
        const last = lastSuggestedKm.current;
        const isEmpty = current == null || !Number.isFinite(current) || current <= 0;
        const matchesLastSuggestion = last != null && current === last;
        if (isEmpty || matchesLastSuggestion) {
          form.setValue('distanceKm', route.distanceKm, { shouldValidate: true });
        }
        lastSuggestedKm.current = route.distanceKm;
      })
      .catch(() => {
        /* keep manual entry if suggest fails */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suggest from pricing + stop addresses
  }, [
    pricingModel,
    pickupState,
    pickupPostcode,
    pickupSuburb,
    dropoffState,
    dropoffPostcode,
    dropoffSuburb,
    extraStopsSignature,
    isEdit,
    role,
  ]);

  const handleDgUpload = async (file: File) => {
    if (!senderCompanyId) {
      toast.error(t('jobs.senderCompanyMissing', { defaultValue: 'Sender profile not loaded yet.' }));
      return;
    }
    setDgUploading(true);
    try {
      const mime = resolveUploadMime(file);
      const intent = await createUploadIntent({
        companyId: senderCompanyId,
        docType: 'DG_LICENCE',
        originalFilename:
          file.name ||
          `dg-declaration.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
        mimeType: mime,
        sizeBytes: file.size,
      });
      const up = await uploadDocumentContent(intent.id, file);
      await confirmDocument(intent.id, up.contentHash);
      form.setValue('dgDocumentId', intent.id, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setDgDocFilename(file.name);
      toast.success(
        t('jobs.dgDocUploaded', {
          defaultValue: 'Dangerous Goods document uploaded.',
        }),
      );
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setDgUploading(false);
    }
  };

  const cargoForRecommend = {
    deadWeightKg: Number(deadWeightKg) || 0,
    lengthCm: Number(lengthCm) || 0,
    widthCm: Number(widthCm) || 0,
    heightCm: Number(heightCm) || 0,
  };
  const localChargeable =
    cargoForRecommend.deadWeightKg > 0 &&
    cargoForRecommend.lengthCm > 0 &&
    cargoForRecommend.widthCm > 0 &&
    cargoForRecommend.heightCm > 0
      ? chargeableWeightKg(cargoForRecommend)
      : null;
  const cargoOverLimit =
    localChargeable != null && isChargeableOverLimit(localChargeable);

  const recommend = useQuery({
    queryKey: ['jobs', 'recommend', deadWeightKg, lengthCm, widthCm, heightCm],
    queryFn: () => recommendVehicle(cargoForRecommend),
    enabled:
      cargoForRecommend.deadWeightKg > 0 &&
      cargoForRecommend.lengthCm > 0 &&
      cargoForRecommend.widthCm > 0 &&
      cargoForRecommend.heightCm > 0 &&
      cargoForRecommend.deadWeightKg <= MAX_JOB_DEAD_WEIGHT_KG &&
      cargoForRecommend.lengthCm <= MAX_JOB_LENGTH_CM &&
      cargoForRecommend.widthCm <= MAX_JOB_WIDTH_CM &&
      cargoForRecommend.heightCm <= MAX_JOB_HEIGHT_CM &&
      !cargoOverLimit,
    retry: false,
  });

  const vehicleClassesMeta = useQuery({
    queryKey: ['jobs', 'meta', 'vehicle-classes'],
    queryFn: () => getVehicleClassesMeta(),
    enabled: role === AppRole.SENDER,
    staleTime: 60_000,
  });

  const vehicleSpecs = useMemo(() => {
    const classes = vehicleClassesMeta.data?.classes;
    if (!classes || classes.length === 0) return CLOX_VEHICLE_SPECS;
    const defaultByCode = new Map<string, (typeof CLOX_VEHICLE_SPECS)[number]>(
      CLOX_VEHICLE_SPECS.map((s) => [s.code, s]),
    );
    return [...classes]
      .sort((a, b) => a.rank - b.rank)
      .map((c) => {
        const def = defaultByCode.get(c.code);
        return {
          code: c.code,
          name: c.name || def?.name || c.code.replace(/_/g, ' '),
          subTitle:
            def?.subTitle ||
            `Up to ${(c.maxChargeableWeightKg / 1000).toFixed(1)}t`,
          rank: c.rank,
          maxChargeableWeightKg: c.maxChargeableWeightKg,
          maxLengthCm: c.maxLengthCm,
          maxWidthCm: c.maxWidthCm,
          maxHeightCm: c.maxHeightCm,
          minLicence: c.minLicenceClass || def?.minLicence || 'C',
        };
      });
  }, [vehicleClassesMeta.data?.classes]);

  const vehicleRankMap = useMemo(
    () => ({ ...VEHICLE_CLASS_RANK, ...(vehicleClassesMeta.data?.ranks ?? {}) }),
    [vehicleClassesMeta.data?.ranks],
  );

  useEffect(() => {
    if (!recommend.data?.recommendedVehicleClass) return;
    const current = form.getValues('minVehicleClass');
    const recRank = vehicleRankMap[recommend.data.recommendedVehicleClass] ?? 1;
    const currentRank = current ? (vehicleRankMap[current] ?? 0) : 0;
    if (!current || currentRank < recRank) {
      form.setValue('minVehicleClass', recommend.data.recommendedVehicleClass);
    }
  }, [recommend.data?.recommendedVehicleClass, form, vehicleRankMap]);

  const [vehicleFilter, setVehicleFilter] = useState<'suitable' | 'all'>('suitable');
  const suitableVehicleCount = useMemo(() => {
    const recCode = recommend.data?.recommendedVehicleClass;
    const recRank = recCode ? (vehicleRankMap[recCode] ?? 1) : 1;
    const w = localChargeable ?? cargoForRecommend.deadWeightKg;
    return vehicleSpecs.filter(
      (v) =>
        (w > 0 ? v.maxChargeableWeightKg >= w : true) &&
        (cargoForRecommend.lengthCm > 0 ? v.maxLengthCm >= cargoForRecommend.lengthCm : true) &&
        (cargoForRecommend.widthCm > 0 ? v.maxWidthCm >= cargoForRecommend.widthCm : true) &&
        (cargoForRecommend.heightCm > 0 ? v.maxHeightCm >= cargoForRecommend.heightCm : true) &&
        (recCode ? v.rank >= recRank : true),
    ).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargoForRecommend is derived from the watched fields below
  }, [
    recommend.data?.recommendedVehicleClass,
    localChargeable,
    deadWeightKg,
    lengthCm,
    widthCm,
    heightCm,
    vehicleSpecs,
    vehicleRankMap,
  ]);

  const transitMinutes = useMemo(() => {
    if (routeEstimate?.durationMinutes && routeEstimate.durationMinutes > 0) {
      return Math.round(routeEstimate.durationMinutes);
    }
    const km = Number(distanceKm) || 25;
    return Math.max(12, Math.round(km * 1.5));
  }, [routeEstimate?.durationMinutes, distanceKm]);

  const vehicleTitle = useMemo(() => {
    if (recommend.data?.recommendedVehicleClass) {
      return recommend.data.recommendedVehicleClass.replace(/_/g, ' ');
    }
    if (pricingModel === 'HOURLY') return 'Commercial Hourly Freight';
    return 'Commercial Freight Vehicle';
  }, [recommend.data?.recommendedVehicleClass, pricingModel]);

  const save = useMutation({
    mutationFn: (values: JobCreateForm) => {
      const payload = buildJobPayload(values);
      return isEdit ? updateJob(jobId, payload) : createJob(payload);
    },
    onSuccess: (job) => {
      toast.success(isEdit ? t('jobs.draftUpdated') : t('saved'));
      navigate(`/jobs/${job.id}`, { replace: true });
    },
  });

  const stepIndex = DRAFT_WIZARD_STEPS.indexOf(step);

  const goToStep = async (next: DraftWizardStep) => {
    const targetIdx = DRAFT_WIZARD_STEPS.indexOf(next);
    if (targetIdx < 0 || targetIdx === stepIndex) return;
    if (targetIdx > stepIndex) {
      for (let i = stepIndex; i < targetIdx; i++) {
        const stepId = DRAFT_WIZARD_STEPS[i]!;
        const ok = await form.trigger(DRAFT_STEP_FIELDS[stepId]);
        if (!ok) {
          setStep(stepId);
          return;
        }
      }
    }
    setStep(next);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    void goToStep(DRAFT_WIZARD_STEPS[stepIndex - 1]!);
  };

  const goNext = async () => {
    if (step === 'confirm') return;
    await goToStep(DRAFT_WIZARD_STEPS[stepIndex + 1]!);
  };

  const stepHint =
    step === 'pricing'
      ? t('jobs.wizard.pricingHint')
      : step === 'cargo'
        ? t('jobs.wizard.cargoHint')
        : step === 'receiver'
          ? t('jobs.wizard.receiverHint')
          : t('jobs.wizard.confirmHint');

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (isEdit && existing.isLoading) return <LoadingBlock label={t('jobs.loadingDetail')} />;
  if (isEdit && (existing.isError || !existing.data)) {
    return <Notice tone="error">{getErrorDetail(existing.error)}</Notice>;
  }

  return (
    <div className={step === 'cargo' ? 'max-w-5xl' : 'max-w-2xl'}>
      <Link to={cancelTo} className="text-sm text-clox-orange hover:underline">
        ← {isEdit ? t('jobs.backToJob') : t('jobs.backToJobs')}
      </Link>
      <div className={`mt-2 flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {isEdit ? t('jobs.editTitle') : t('jobs.createTitle')}
          </h1>
          <p className="mt-1 text-sm text-clox-mute">
            {isEdit ? t('jobs.editHint') : t('jobs.createHint')}
          </p>
        </div>
        {isEdit && existing.data ? (
          <StatusPill tone={jobStatusTone(existing.data.status)}>
            {t(`jobStatuses.${existing.data.status}`, {
              defaultValue: existing.data.status,
            })}
          </StatusPill>
        ) : null}
      </div>

      <StepChips
        className="mt-4"
        current={step}
        steps={[
          { id: 'pricing', label: t('jobs.wizard.stepPricing') },
          { id: 'cargo', label: t('jobs.wizard.stepCargo') },
          { id: 'receiver', label: t('jobs.wizard.stepReceiver') },
          { id: 'confirm', label: t('jobs.wizard.stepConfirm') },
        ]}
        onStepSelect={(id) => void goToStep(id as DraftWizardStep)}
        canSelectStep={() => true}
      />
      <p className="mt-2 text-xs text-clox-mute">{stepHint}</p>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (step !== 'confirm') {
            void goNext();
            return;
          }
          void form.handleSubmit((values) => save.mutate(values as JobCreateForm))();
        }}
        noValidate
      >
        {step === 'pricing' ? (
          <>
            <RadioCardGroup
              name="pricingModel"
              label={t('validation.pricingModelLabel')}
              required
              error={form.formState.errors.pricingModel?.message}
              value={pricingModel}
              onChange={(next) =>
                form.setValue('pricingModel', next, { shouldValidate: true, shouldDirty: true })
              }
              options={[
                {
                  value: 'PER_KM',
                  title: t('jobs.pricingPerKm'),
                  description: t('jobs.pricingPerKmHint'),
                },
                {
                  value: 'HOURLY',
                  title: t('jobs.pricingHourly'),
                  description: t('jobs.pricingHourlyHint'),
                },
              ]}
            />

            {pricingModel === 'HOURLY' ? (
              <Notice
                tone="info"
                className="mb-4"
                title={t('jobs.hourlyMinimumTitle', {
                  defaultValue: 'Hourly Basis Pricing & Minimum Charge',
                })}
              >
                <p>
                  {t('jobs.hourlyMinimumBody', {
                    defaultValue: `Minimum hourly base charge: $${(
                      (routeEstimate?.minChargeIncGstCents ??
                        Math.max(
                          routeEstimate?.minBaseCents ?? 20_000,
                          (routeEstimate?.minBillableHours ?? 4) *
                            (routeEstimate?.hourlyRateCents ?? 8_000),
                        )) / 100
                    ).toFixed(2)} inc GST (${routeEstimate?.minBillableHours ?? 4}-hour minimum @ $${(
                      (routeEstimate?.hourlyRateCents ?? 8_000) / 100
                    ).toFixed(2)}/hr inc GST; platform base floor $${(
                      (routeEstimate?.minBaseCents ?? 20_000) / 100
                    ).toFixed(2)} inc GST). After ${routeEstimate?.minBillableHours ?? 4} hours, time is billed in 15-minute increments.`,
                  })}
                </p>
                <p className="mt-1.5 text-xs">
                  {t('jobs.hourlyNoManualDistanceNote', {
                    defaultValue:
                      'No manual distance entry is required for hourly jobs — route distance, duration, and billable hours are automatically calculated from your pickup and dropoff stops.',
                  })}
                  {routeEstimate?.billableHours != null ? (
                    <span className="mt-1 block font-semibold">
                      {t('jobs.hourlyLiveEstimate', {
                        defaultValue: `Estimated from stops: ${routeEstimate.billableHours} billable hrs (~${routeEstimate.distanceKm} km, ${routeEstimate.durationMinutes} min) · Est. ${formatDollars(routeEstimate.estimateIncGstCents ?? Math.max(routeEstimate.minBaseCents ?? 20_000, routeEstimate.billableHours * (routeEstimate.hourlyRateCents ?? 8_000)))} inc GST`,
                        hours: routeEstimate.billableHours,
                        km: routeEstimate.distanceKm,
                        mins: routeEstimate.durationMinutes,
                        amount: (
                          (routeEstimate.estimateIncGstCents ??
                            Math.max(
                              routeEstimate.minBaseCents ?? 20_000,
                              routeEstimate.billableHours * (routeEstimate.hourlyRateCents ?? 8_000),
                            )) / 100
                        ).toFixed(2),
                      })}
                    </span>
                  ) : null}
                </p>
              </Notice>
            ) : null}

            <div className="mb-4 rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <p className="mb-3 font-display text-sm font-semibold text-clox-ink">
                {t('jobs.pickupLocationTitle', { defaultValue: 'Pickup Location' })}
              </p>
              <Field
                label={t('jobs.addressLineLabel', { defaultValue: 'Street Address' })}
                required
                placeholder={getStateStopDefaults(pickupState || senderDefaultState).pickupAddressLine}
                error={form.formState.errors.pickupAddressLine?.message}
                {...form.register('pickupAddressLine')}
              />
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
                <Field
                  label={t('jobs.suburbLabel', { defaultValue: 'Suburb' })}
                  required
                  placeholder={getStateStopDefaults(pickupState || senderDefaultState).pickupSuburb}
                  error={form.formState.errors.pickupSuburb?.message}
                  {...form.register('pickupSuburb')}
                />
                <Select
                  label={t('jobs.stateLabel', { defaultValue: 'State' })}
                  required
                  error={form.formState.errors.pickupState?.message}
                  value={pickupState}
                  {...form.register('pickupState')}
                >
                  {AU_STATE_OPTIONS.map((st) => {
                    const isDisabled =
                      enabledStateCodes != null &&
                      !enabledStateCodes.has(st.code) &&
                      pickupState !== st.code;
                    return (
                      <option key={st.code} value={st.code} disabled={isDisabled}>
                        {st.label}
                        {isDisabled ? ' (Not active)' : ''}
                      </option>
                    );
                  })}
                </Select>
                <Field
                  label={t('jobs.postcodeLabel', { defaultValue: 'Postcode' })}
                  required
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={getStateStopDefaults(pickupState || senderDefaultState).pickupPostcode}
                  error={form.formState.errors.pickupPostcode?.message}
                  {...form.register('pickupPostcode')}
                />
              </div>
            </div>

            {pricingModel === 'HOURLY' ? (
              <div className="mb-4 space-y-3">
                {extraPickupsArray.fields.map((field, index) => {
                  const extraState = extraPickups?.[index]?.state || pickupState || senderDefaultState;
                  const extraDefaults = getStateStopDefaults(extraState);
                  return (
                    <div
                      key={field.id}
                      className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-display text-sm font-semibold text-clox-ink">
                          {t('jobs.additionalPickupTitle', {
                            defaultValue: `Pickup Location #${index + 2}`,
                            num: index + 2,
                          })}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-[var(--status-danger)]"
                          onClick={() => extraPickupsArray.remove(index)}
                        >
                          {t('jobs.removeStop', { defaultValue: 'Remove Pickup' })}
                        </Button>
                      </div>
                      <Field
                        label={t('jobs.addressLineLabel', { defaultValue: 'Street Address' })}
                        required
                        placeholder={extraDefaults.pickupAddressLine}
                        error={form.formState.errors.extraPickups?.[index]?.addressLine?.message}
                        {...form.register(`extraPickups.${index}.addressLine` as const)}
                      />
                      <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
                        <Field
                          label={t('jobs.suburbLabel', { defaultValue: 'Suburb' })}
                          required
                          placeholder={extraDefaults.pickupSuburb}
                          error={form.formState.errors.extraPickups?.[index]?.suburb?.message}
                          {...form.register(`extraPickups.${index}.suburb` as const)}
                        />
                        <Select
                          label={t('jobs.stateLabel', { defaultValue: 'State' })}
                          value={extraState}
                          error={form.formState.errors.extraPickups?.[index]?.state?.message}
                          {...form.register(`extraPickups.${index}.state` as const)}
                        >
                          {AU_STATE_OPTIONS.map((st) => {
                            const isDisabled =
                              enabledStateCodes != null &&
                              !enabledStateCodes.has(st.code) &&
                              extraState !== st.code;
                            return (
                              <option key={st.code} value={st.code} disabled={isDisabled}>
                                {st.label}
                                {isDisabled ? ' (Not active)' : ''}
                              </option>
                            );
                          })}
                        </Select>
                        <Field
                          label={t('jobs.postcodeLabel', { defaultValue: 'Postcode' })}
                          required
                          inputMode="numeric"
                          maxLength={4}
                          placeholder={extraDefaults.pickupPostcode}
                          error={form.formState.errors.extraPickups?.[index]?.postcode?.message}
                          {...form.register(`extraPickups.${index}.postcode` as const)}
                        />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      extraPickupsArray.append({
                        addressLine: '',
                        suburb: '',
                        state: pickupState || senderDefaultState,
                        postcode: '',
                      })
                    }
                  >
                    +{' '}
                    {t('jobs.addPickupStopButton', {
                      defaultValue: 'Add Another Pickup Stop',
                    })}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mb-4 rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <p className="mb-3 font-display text-sm font-semibold text-clox-ink">
                {t('jobs.dropoffLocationTitle', { defaultValue: 'Dropoff Location' })}
              </p>
              <Field
                label={t('jobs.addressLineLabel', { defaultValue: 'Street Address' })}
                required
                placeholder={getStateStopDefaults(dropoffState || senderDefaultState).dropoffAddressLine}
                error={form.formState.errors.dropoffAddressLine?.message}
                {...form.register('dropoffAddressLine')}
              />
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
                <Field
                  label={t('jobs.suburbLabel', { defaultValue: 'Suburb' })}
                  required
                  placeholder={getStateStopDefaults(dropoffState || senderDefaultState).dropoffSuburb}
                  error={form.formState.errors.dropoffSuburb?.message}
                  {...form.register('dropoffSuburb')}
                />
                <Select
                  label={t('jobs.stateLabel', { defaultValue: 'State' })}
                  required
                  error={form.formState.errors.dropoffState?.message}
                  value={dropoffState}
                  {...form.register('dropoffState')}
                >
                  {AU_STATE_OPTIONS.map((st) => {
                    const isDisabled =
                      enabledStateCodes != null &&
                      !enabledStateCodes.has(st.code) &&
                      dropoffState !== st.code;
                    return (
                      <option key={st.code} value={st.code} disabled={isDisabled}>
                        {st.label}
                        {isDisabled ? ' (Not active)' : ''}
                      </option>
                    );
                  })}
                </Select>
                <Field
                  label={t('jobs.postcodeLabel', { defaultValue: 'Postcode' })}
                  required
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={getStateStopDefaults(dropoffState || senderDefaultState).dropoffPostcode}
                  error={form.formState.errors.dropoffPostcode?.message}
                  {...form.register('dropoffPostcode')}
                />
              </div>
            </div>

            {pricingModel === 'HOURLY' ? (
              <div className="mb-4 space-y-3">
                {extraDropoffsArray.fields.map((field, index) => {
                  const extraDropState = extraDropoffs?.[index]?.state || dropoffState || senderDefaultState;
                  const extraDropDefaults = getStateStopDefaults(extraDropState);
                  return (
                    <div
                      key={field.id}
                      className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-display text-sm font-semibold text-clox-ink">
                          {t('jobs.additionalDropoffTitle', {
                            defaultValue: `Dropoff Location #${index + 2}`,
                            num: index + 2,
                          })}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-[var(--status-danger)]"
                          onClick={() => extraDropoffsArray.remove(index)}
                        >
                          {t('jobs.removeDropoffStop', { defaultValue: 'Remove Dropoff' })}
                        </Button>
                      </div>
                      <Field
                        label={t('jobs.addressLineLabel', { defaultValue: 'Street Address' })}
                        required
                        placeholder={extraDropDefaults.dropoffAddressLine}
                        error={form.formState.errors.extraDropoffs?.[index]?.addressLine?.message}
                        {...form.register(`extraDropoffs.${index}.addressLine` as const)}
                      />
                      <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
                        <Field
                          label={t('jobs.suburbLabel', { defaultValue: 'Suburb' })}
                          required
                          placeholder={extraDropDefaults.dropoffSuburb}
                          error={form.formState.errors.extraDropoffs?.[index]?.suburb?.message}
                          {...form.register(`extraDropoffs.${index}.suburb` as const)}
                        />
                        <Select
                          label={t('jobs.stateLabel', { defaultValue: 'State' })}
                          value={extraDropState}
                          error={form.formState.errors.extraDropoffs?.[index]?.state?.message}
                          {...form.register(`extraDropoffs.${index}.state` as const)}
                        >
                          {AU_STATE_OPTIONS.map((st) => {
                            const isDisabled =
                              enabledStateCodes != null &&
                              !enabledStateCodes.has(st.code) &&
                              extraDropState !== st.code;
                            return (
                              <option key={st.code} value={st.code} disabled={isDisabled}>
                                {st.label}
                                {isDisabled ? ' (Not active)' : ''}
                              </option>
                            );
                          })}
                        </Select>
                        <Field
                          label={t('jobs.postcodeLabel', { defaultValue: 'Postcode' })}
                          required
                          inputMode="numeric"
                          maxLength={4}
                          placeholder={extraDropDefaults.dropoffPostcode}
                          error={form.formState.errors.extraDropoffs?.[index]?.postcode?.message}
                          {...form.register(`extraDropoffs.${index}.postcode` as const)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-2">
                        <Field
                          label={t('jobs.dropoff2ReceiverNameLabel', {
                            defaultValue: 'Stop Receiver Name (optional — defaults to primary)',
                          })}
                          placeholder={t('jobs.placeholderReceiverName')}
                          error={form.formState.errors.extraDropoffs?.[index]?.receiverName?.message}
                          {...form.register(`extraDropoffs.${index}.receiverName` as const)}
                        />
                        <Field
                          type="email"
                          label={t('jobs.dropoff2ReceiverEmailLabel', {
                            defaultValue: 'Stop Receiver Email (optional — defaults to primary)',
                          })}
                          placeholder={t('jobs.placeholderReceiverEmail')}
                          error={form.formState.errors.extraDropoffs?.[index]?.receiverEmail?.message}
                          {...form.register(`extraDropoffs.${index}.receiverEmail` as const)}
                        />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      extraDropoffsArray.append({
                        addressLine: '',
                        suburb: '',
                        state: dropoffState || senderDefaultState,
                        postcode: '',
                        receiverName: '',
                        receiverEmail: '',
                      })
                    }
                  >
                    +{' '}
                    {t('jobs.addDropoffStopButton', {
                      defaultValue: 'Add Another Dropoff Stop',
                    })}
                  </Button>
                </div>
              </div>
            ) : null}

            {pricingModel === 'PER_KM' ? (
              <Field
                type="number"
                step="0.1"
                min={0.1}
                label={t('jobs.distanceKmLabel')}
                required
                hint={
                  suggestedKm != null
                    ? t('jobs.distanceKmSuggested', { km: suggestedKm })
                    : t('jobs.distanceKmHint')
                }
                error={form.formState.errors.distanceKm?.message}
                {...form.register('distanceKm', { valueAsNumber: true })}
              />
            ) : null}
          </>
        ) : null}

        {step === 'cargo' ? (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-clox-ink">
                {t('jobs.cargoDimensionsTitle', { defaultValue: 'Cargo Dimensions & Weight' })}
              </h3>
              <p className="mt-0.5 text-xs text-clox-mute">
                {t('jobs.cargoDimensionsSubtitle', {
                  defaultValue:
                    'Enter dead weight and bounding dimensions to compute chargeable weight and suitable vehicles.',
                })}
              </p>
            </div>

            <Field
              type="number"
              label={t('validation.deadWeightLabel')}
              required
              hint={t('jobs.deadWeightMaxHint', { max: MAX_JOB_DEAD_WEIGHT_KG })}
              error={form.formState.errors.deadWeightKg?.message}
              {...form.register('deadWeightKg', { valueAsNumber: true })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                type="number"
                label={t('validation.lengthLabel')}
                required
                error={form.formState.errors.lengthCm?.message}
                {...form.register('lengthCm', { valueAsNumber: true })}
              />
              <Field
                type="number"
                label={t('validation.widthLabel')}
                required
                error={form.formState.errors.widthCm?.message}
                {...form.register('widthCm', { valueAsNumber: true })}
              />
              <Field
                type="number"
                label={t('validation.heightLabel')}
                required
                error={form.formState.errors.heightCm?.message}
                {...form.register('heightCm', { valueAsNumber: true })}
              />
            </div>
            {cargoOverLimit && localChargeable != null ? (
              <Notice tone="error" className="mb-4">
                {t('validation.chargeableOverLimit', {
                  kg: localChargeable.toFixed(1),
                  max: MAX_JOB_CHARGEABLE_WEIGHT_KG,
                })}
              </Notice>
            ) : null}
            {!cargoOverLimit && recommend.isError ? (
              <Notice tone="error" className="mb-4">
                {getErrorDetail(recommend.error)}
              </Notice>
            ) : null}

            {/* 12 CLOX Load Types Selection */}
            <div className="mt-6 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-clox-ink">
                    {t('loadTypes.title', { defaultValue: 'Type of Load' })}
                  </h3>
                  <p className="mt-0.5 text-xs text-clox-mute">
                    {t('loadTypes.subtitle', {
                      defaultValue: 'Select all categories that apply to your freight.',
                    })}
                  </p>
                </div>
                <span className="text-[11px] font-medium text-clox-mute">
                  {loadTypes.length} {t('selected', { defaultValue: 'selected' })}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3">
                {CLOX_LOAD_TYPES.map((lt) => {
                  const isChecked = loadTypes.includes(lt.code);
                  return (
                    <button
                      key={lt.code}
                      type="button"
                      onClick={() => {
                        let next: string[];
                        if (isChecked) {
                          next = loadTypes.filter((c) => c !== lt.code);
                          if (next.length === 0) next = ['GENERAL'];
                        } else {
                          next = [...loadTypes, lt.code];
                        }
                        form.setValue('loadTypes', next);
                        form.setValue('loadDg', next.includes('DG'));
                      }}
                      className={cn(
                        'group flex flex-col items-start rounded-clox-md border p-3 text-left transition-all duration-150',
                        isChecked
                          ? 'border-[#f26e22] bg-[#f26e22]/5 dark:bg-[#f26e22]/10 shadow-sm ring-1 ring-[#f26e22]'
                          : 'border-clox-border bg-clox-surface hover:border-slate-300 dark:hover:border-slate-600',
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            isChecked ? 'text-[#f26e22] dark:text-[#ff8f4d]' : 'text-clox-ink',
                          )}
                        >
                          {t(lt.nameKey, { defaultValue: lt.defaultName })}
                        </span>
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            isChecked
                              ? 'border-[#f26e22] bg-[#f26e22] text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800',
                          )}
                        >
                          {isChecked ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                        </div>
                      </div>
                      <p className="mt-1 hidden text-[11px] leading-snug text-clox-mute sm:block">
                        {t(lt.descKey, { defaultValue: lt.defaultDesc })}
                      </p>
                    </button>
                  );
                })}
              </div>

              {loadTypes.includes('OVERSIZE') ? (
                <Notice tone="warn" className="mt-3 text-xs">
                  <strong>Oversize Alert:</strong> Flatbed trailer or extendable vehicle required. Permits or pilot escort may apply.
                </Notice>
              ) : null}
              {loadTypes.includes('STEEL') ? (
                <Notice tone="info" className="mt-3 text-xs">
                  <strong>Steel Restraint:</strong> Heavy transport chains and NHVR-compliant load restraints required.
                </Notice>
              ) : null}
              {loadTypes.includes('REEFER') ? (
                <Notice tone="info" className="mt-3 text-xs">
                  <strong>Refrigeration:</strong> Carrier must provide continuous temperature-controlled vehicle.
                </Notice>
              ) : null}
              {loadTypes.includes('LIQUID') ? (
                <Notice tone="warn" className="mt-3 text-xs">
                  <strong>Liquid Freight:</strong> Spill containment and certified bunding equipment required.
                </Notice>
              ) : null}
              {loadTypes.includes('CONTAINERS') ? (
                <Notice tone="info" className="mt-3 text-xs">
                  <strong>Wharf Access:</strong> Port terminal access and 1-Stop vehicle booking slot required.
                </Notice>
              ) : null}
            </div>

            {/* Dangerous Goods Document Upload */}
            {loadTypes.includes('DG') ? (
              <div className="mb-6 rounded-clox-md border border-amber-300/60 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4">
                <FileInput
                  className="mb-0"
                  label={t('jobs.dgDocUploadLabel', {
                    defaultValue: 'Dangerous Goods (DG) Declaration / SDS Document',
                  })}
                  hint={t('jobs.dgDocUploadHint', {
                    defaultValue:
                      'Upload the DG transport declaration or Safety Data Sheet (PDF or image). Only DG-licensed carriers will be eligible to bid.',
                  })}
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  fileName={dgDocFilename}
                  disabled={dgUploading}
                  error={form.formState.errors.dgDocumentId?.message}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleDgUpload(file);
                  }}
                />
                {dgUploading ? (
                  <p className="mt-1 text-xs text-clox-mute">{t('uploading', { defaultValue: 'Uploading…' })}</p>
                ) : null}
                {dgDocumentId ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-clox-sm border border-clox-border bg-clox-surface p-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 shrink-0 text-clox-orange" />
                      <p className="truncate font-medium text-[var(--status-ok)]" title={dgDocFilename || undefined}>
                        ✓ {dgDocFilename || t('jobs.dgDocAttached', { defaultValue: 'DG document attached' })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 px-2 py-1 text-xs"
                      onClick={() =>
                        void openDocumentContent(dgDocumentId).catch((err) =>
                          toast.error(getErrorDetail(err)),
                        )
                      }
                    >
                      {t('jobs.viewDgDoc', { defaultValue: 'View Document' })}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Vehicle Recommendation & Selection Grid */}
            <div className="mt-6 mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-clox-ink">
                    {t('jobs.vehicleSelectionTitle', { defaultValue: 'Vehicle Recommendation & Selection' })}
                  </h3>
                  <p className="mt-0.5 text-xs text-clox-mute">
                    {t('jobs.vehicleSelectionSubtitle', {
                      defaultValue:
                        'Available fleet vehicle classes. Smaller classes are disabled when your cargo exceeds their limits.',
                    })}
                  </p>
                </div>
                {localChargeable != null && localChargeable > 0 ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Chargeable: {localChargeable.toFixed(1)} kg
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['suitable', `Suitable (${suitableVehicleCount})`],
                    ['all', `All (${vehicleSpecs.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVehicleFilter(key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      vehicleFilter === key
                        ? 'border-clox-orange bg-clox-orange text-white'
                        : 'border-clox-border bg-clox-surface text-clox-mute hover:text-clox-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vehicleSpecs.map((v) => {
                  const recommendedCode = recommend.data?.recommendedVehicleClass;
                  const recRank = recommendedCode ? (vehicleRankMap[recommendedCode] ?? 1) : 1;
                  const isRecommended = recommendedCode === v.code;

                  const weight = localChargeable ?? cargoForRecommend.deadWeightKg;
                  const weightOk = weight > 0 ? v.maxChargeableWeightKg >= weight : true;
                  const lengthOk = cargoForRecommend.lengthCm > 0 ? v.maxLengthCm >= cargoForRecommend.lengthCm : true;
                  const widthOk = cargoForRecommend.widthCm > 0 ? v.maxWidthCm >= cargoForRecommend.widthCm : true;
                  const heightOk = cargoForRecommend.heightCm > 0 ? v.maxHeightCm >= cargoForRecommend.heightCm : true;
                  const dimsOk = lengthOk && widthOk && heightOk;
                  const rankOk = recommendedCode ? v.rank >= recRank : true;

                  const isApplicable = weightOk && dimsOk && rankOk;
                  const isSelected = (minVehicleClass || recommendedCode) === v.code;

                  if (vehicleFilter === 'suitable' && !isApplicable) return null;

                  let reason = '';
                  if (!weightOk) {
                    reason = `Exceeds max payload (${v.maxChargeableWeightKg.toLocaleString()} kg max vs ${Math.round(weight).toLocaleString()} kg cargo)`;
                  } else if (!dimsOk) {
                    const parts: string[] = [];
                    if (!lengthOk) parts.push(`Length > ${v.maxLengthCm}cm`);
                    if (!widthOk) parts.push(`Width > ${v.maxWidthCm}cm`);
                    if (!heightOk) parts.push(`Height > ${v.maxHeightCm}cm`);
                    reason = `Cargo bay exceeded (${parts.join(', ')})`;
                  } else if (!rankOk) {
                    reason = `Smaller capacity class than recommended (${v.name} vs required ${recommendedCode || 'minimum'})`;
                  }

                  return (
                    <div
                      key={v.code}
                      onClick={() => {
                        if (isApplicable) {
                          form.setValue('minVehicleClass', v.code);
                        }
                      }}
                      className={cn(
                        'relative flex flex-col justify-between rounded-clox-md border p-3.5 transition-all duration-150',
                        !isApplicable &&
                          'border-slate-300/80 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-900/60 cursor-not-allowed shadow-none',
                        isApplicable &&
                          !isSelected &&
                          !isRecommended &&
                          'border-clox-border bg-clox-surface hover:border-clox-orange/60 hover:shadow-clox-1 cursor-pointer',
                        isApplicable &&
                          isRecommended &&
                          !isSelected &&
                          'border-2 border-emerald-500/90 bg-emerald-50/30 dark:border-emerald-500/70 dark:bg-emerald-950/20 shadow-xs cursor-pointer hover:border-emerald-600',
                        isApplicable &&
                          isSelected &&
                          'border-2 border-clox-orange ring-2 ring-clox-orange/20 bg-clox-orange/5 dark:bg-clox-orange/10 shadow-sm cursor-pointer',
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span
                                className={cn(
                                  'text-sm font-bold',
                                  !isApplicable ? 'text-slate-700 dark:text-slate-300' : 'text-clox-ink',
                                )}
                              >
                                {v.name}
                              </span>
                              <span className="text-xs font-normal text-clox-mute">
                                ({v.subTitle})
                              </span>
                            </div>
                            <span className="text-[11px] text-clox-mute block mt-0.5">
                              Licence: {v.minLicence}
                            </span>
                          </div>

                          {!isApplicable ? (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              ✕ {t('jobs.notApplicableBadge', { defaultValue: 'Not Suitable' })}
                            </span>
                          ) : isRecommended ? (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs">
                              ★ {t('jobs.recommendedBadge', { defaultValue: 'Recommended' })}
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              ✓ {t('jobs.applicableBadge', { defaultValue: 'Suitable' })}
                            </span>
                          )}
                        </div>

                        {/* Weight & Bay Dimensions Specs Section */}
                        {isApplicable ? (
                          <div className="mt-2.5 rounded-md border border-clox-border/80 bg-clox-surface-alt/80 p-2.5">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-clox-mute">
                                  Max Payload
                                </span>
                                <span className="block text-sm font-bold text-clox-ink mt-0.5">
                                  {v.maxChargeableWeightKg.toLocaleString()} kg
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-clox-mute">
                                  Cargo Bay
                                </span>
                                <span className="block text-xs font-semibold text-clox-ink mt-0.5 leading-tight">
                                  {v.maxLengthCm} × {v.maxWidthCm} × {v.maxHeightCm} cm
                                </span>
                              </div>
                            </div>

                            {weight > 0 ? (
                              <div className="mt-2 pt-2 border-t border-clox-border/60">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-clox-mute font-medium text-[11px]">Your Cargo:</span>
                                  <span className="font-bold text-clox-ink text-xs">
                                    {weight.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                                    <span className="ml-1 text-[10px] font-normal text-clox-mute">
                                      ({Math.min(100, Math.round((weight / v.maxChargeableWeightKg) * 100))}% payload)
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-300',
                                      isSelected
                                        ? 'bg-clox-orange'
                                        : isRecommended
                                          ? 'bg-emerald-500'
                                          : 'bg-slate-500 dark:bg-slate-400',
                                    )}
                                    style={{
                                      width: `${Math.min(100, Math.max(5, (weight / v.maxChargeableWeightKg) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <div className="mt-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-2.5">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Max Payload
                                  </span>
                                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                    {v.maxChargeableWeightKg.toLocaleString()} kg
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Cargo Bay
                                  </span>
                                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 leading-tight">
                                    {v.maxLengthCm} × {v.maxWidthCm} × {v.maxHeightCm} cm
                                  </span>
                                </div>
                              </div>
                            </div>

                            {reason ? (
                              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                                <span className="font-medium leading-tight">{reason}</span>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>

                      {isApplicable ? (
                        <div className="mt-3 flex items-center justify-between border-t border-clox-border/60 pt-2 text-xs">
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              isSelected ? 'text-clox-orange dark:text-orange-400' : 'text-clox-mute',
                            )}
                          >
                            {isSelected
                              ? t('jobs.selectedVehicleClass', { defaultValue: '✓ Selected Vehicle Class' })
                              : t('jobs.clickToSelectVehicle', { defaultValue: 'Click to select this class' })}
                          </span>
                          <div
                            className={cn(
                              'h-4 w-4 rounded-full border flex items-center justify-center transition-colors',
                              isSelected
                                ? 'border-clox-orange bg-clox-orange text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800',
                            )}
                          >
                            {isSelected ? <div className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-[11px] font-medium">
                            {t('jobs.vehicleNotAvailable', { defaultValue: 'Not suitable for this cargo' })}
                          </span>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
                            Ineligible
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        {step === 'receiver' ? (
          <>
            <Field
              label={t('jobs.receiverNameLabel')}
              placeholder={t('jobs.placeholderReceiverName')}
              required
              autoComplete="name"
              error={form.formState.errors.receiverName?.message}
              {...form.register('receiverName')}
            />
            <Field
              type="email"
              label={t('jobs.receiverEmailLabel')}
              placeholder={t('jobs.placeholderReceiverEmail')}
              required
              autoComplete="email"
              error={form.formState.errors.receiverEmail?.message}
              {...form.register('receiverEmail')}
            />
            <Field
              type="tel"
              label={t('jobs.receiverPhone', { defaultValue: 'Receiver Phone' })}
              placeholder={t('jobs.placeholderReceiverPhone', { defaultValue: '+61 400 000 000' })}
              required
              autoComplete="tel"
              error={form.formState.errors.receiverPhone?.message}
              {...form.register('receiverPhone')}
            />
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-2">
              <Field
                type="email"
                label={t('jobs.receiverAltEmail', {
                  defaultValue: 'Alternate Email (optional)',
                })}
                placeholder={t('jobs.placeholderReceiverAltEmail', {
                  defaultValue: 'secondary@example.com',
                })}
                error={form.formState.errors.receiverAltEmail?.message}
                {...form.register('receiverAltEmail')}
              />
              <Field
                type="tel"
                label={t('jobs.receiverAltPhone', {
                  defaultValue: 'Alternate Phone (optional)',
                })}
                placeholder={t('jobs.placeholderReceiverAltPhone', {
                  defaultValue: '+61 3 9000 0000',
                })}
                error={form.formState.errors.receiverAltPhone?.message}
                {...form.register('receiverAltPhone')}
              />
            </div>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            {/* Top Card: Vehicle Class + Transit Time + Free Loading Time Included */}
            <div className="clox-card mb-4 overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-clox-surface-alt border border-clox-border text-clox-orange">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-clox-ink sm:text-lg">
                      {vehicleTitle}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddressDetails((prev) => !prev)}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-clox-orange hover:underline"
                    >
                      <span>
                        {showAddressDetails
                          ? t('jobs.hideAddressDetails', { defaultValue: 'Hide Address Details' })
                          : t('jobs.viewAddressDetails', { defaultValue: 'View Address Details' })}
                      </span>
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          showAddressDetails && 'rotate-90',
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-clox-border bg-clox-surface-alt px-3 py-1.5 text-center sm:px-4 sm:py-2">
                  <span className="font-display text-lg font-bold text-clox-ink sm:text-xl leading-none">
                    {transitMinutes}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold text-clox-mute uppercase tracking-wider">
                    mins
                  </span>
                </div>
              </div>

              {/* Collapsible Stop Address Details */}
              {showAddressDetails ? (
                <div className="border-t border-clox-border-soft bg-clox-surface-alt/60 p-4 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-16 font-semibold text-clox-mute">
                      {t('jobs.pickupLabel', { defaultValue: 'Pickup' })}:
                    </span>
                    <span className="text-clox-ink font-medium">
                      {pickupAddressLine}, {pickupSuburb} {pickupState} {pickupPostcode}
                    </span>
                  </div>
                  {pricingModel === 'HOURLY' &&
                    (extraPickups ?? []).map((p, idx) =>
                      p.suburb ? (
                        <div key={`extra-p-${idx}`} className="flex items-start gap-2 pl-4">
                          <span className="inline-block w-16 font-semibold text-clox-faint">
                            Stop #{idx + 2}:
                          </span>
                          <span className="text-clox-ink">
                            {p.addressLine}, {p.suburb} {p.state} {p.postcode}
                          </span>
                        </div>
                      ) : null,
                    )}
                  <div className="flex items-start gap-2">
                    <span className="inline-block w-16 font-semibold text-clox-mute">
                      {t('jobs.dropoffLabel', { defaultValue: 'Dropoff' })}:
                    </span>
                    <span className="text-clox-ink font-medium">
                      {dropoffAddressLine}, {dropoffSuburb} {dropoffState} {dropoffPostcode}
                    </span>
                  </div>
                  {pricingModel === 'HOURLY' &&
                    (extraDropoffs ?? []).map((d, idx) =>
                      d.suburb ? (
                        <div key={`extra-d-${idx}`} className="flex items-start gap-2 pl-4">
                          <span className="inline-block w-16 font-semibold text-clox-faint">
                            Drop #{idx + 2}:
                          </span>
                          <span className="text-clox-ink">
                            {d.addressLine}, {d.suburb} {d.state} {d.postcode}
                          </span>
                        </div>
                      ) : null,
                    )}
                </div>
              ) : null}

              {/* Free Loading/Unloading Time Banner */}
              <div className="flex items-center gap-2 border-t border-clox-border-soft bg-clox-surface-alt px-4 py-2.5 text-xs text-clox-ink">
                <Clock className="h-4 w-4 shrink-0 text-clox-orange" />
                <span className="font-medium text-clox-ink">
                  {t('jobs.freeLoadingPrefix', { defaultValue: 'Free' })}{' '}
                  <strong className="font-bold text-clox-ink">60 mins</strong>{' '}
                  {t('jobs.freeLoadingSuffix', {
                    defaultValue: 'of loading-unloading time included.',
                  })}
                </span>
              </div>
            </div>

            {/* Middle Card: Tax Invoice / ABN Status Card */}
            <div className="clox-card mb-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                      hasAbn
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-clox-border bg-clox-surface-alt text-clox-mute'
                    }`}
                  >
                    {hasAbn ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-clox-ink truncate sm:text-lg">
                      {hasAbn
                        ? `${t('jobs.taxInvoicePrefix', { defaultValue: 'Tax Invoice' })}: ${
                            company?.invoiceLegalName || company?.legalName
                          }`
                        : t('jobs.noAbnRegistered', { defaultValue: 'No ABN Registered' })}
                    </h3>
                    <p className="mt-0.5 text-xs text-clox-mute truncate">
                      {hasAbn
                        ? `ABN: ${formattedCompanyAbn}`
                        : t('jobs.noAbnNotice', {
                            defaultValue:
                              'Invoices will be issued without an ABN. Add your ABN to claim 10% GST credits.',
                          })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <Link
                    to="/account"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-clox-border bg-clox-surface px-3 py-1.5 text-xs font-semibold text-clox-ink shadow-sm transition hover:bg-clox-surface-alt hover:text-clox-orange focus:outline-none focus:ring-2 focus:ring-clox-orange"
                  >
                    <span>
                      {hasAbn
                        ? t('jobs.manageAbnInAccount', { defaultValue: 'Manage in Account' })
                        : t('jobs.addAbnInAccount', { defaultValue: 'Add ABN' })}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-clox-mute" />
                  </Link>
                </div>
              </div>

              {/* Bottom subtext banner */}
              <div className="border-t border-clox-border-soft bg-clox-surface-alt px-4 py-2.5 text-xs">
                {hasAbn ? (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {t('jobs.abnVerifiedTaxInvoiceNotice', {
                      defaultValue:
                        'Compliant 10% GST Tax Invoice will be issued to claim Input Tax Credit',
                    })}
                  </span>
                ) : (
                  <span className="text-clox-mute">
                    {t('jobs.getInvoicesWithAbnNoticePrefix', {
                      defaultValue: 'Update your ABN in Account settings to claim',
                    })}{' '}
                    <strong className="font-bold text-clox-ink">
                      {t('jobs.getInvoicesWithAbnNoticeBold', {
                        defaultValue: '10% GST Input Tax Credit',
                      })}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4 rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <p className="font-display text-sm font-semibold text-clox-ink">
                {t('jobs.wizard.summaryTitle')}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.wizard.summaryPricing')}</dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {pricingModel === 'HOURLY'
                      ? `${t('jobs.pricingHourly')} · ${
                          routeEstimate?.billableHours != null
                            ? `${routeEstimate.billableHours} billable hrs (~${routeEstimate.distanceKm} km)`
                            : 'Min 4 billable hrs'
                        }`
                      : `${t('jobs.pricingPerKm')} · ${t('jobs.wizard.summaryDistance', {
                          km: Number.isFinite(distanceKm) ? distanceKm : '—',
                        })}`}
                    {pricingModel === 'HOURLY' ? (
                      <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                        {t('jobs.hourlyMinSummaryLine', {
                          defaultValue: `Minimum hourly base charge: $${(
                            (routeEstimate?.minChargeIncGstCents ??
                              Math.max(
                                routeEstimate?.minBaseCents ?? 20_000,
                                (routeEstimate?.minBillableHours ?? 4) *
                                  (routeEstimate?.hourlyRateCents ?? 8_000),
                              )) / 100
                          ).toFixed(2)} inc GST (${routeEstimate?.minBillableHours ?? 4} hrs @ $${(
                            (routeEstimate?.hourlyRateCents ?? 8_000) / 100
                          ).toFixed(2)}/hr)${
                            routeEstimate?.estimateIncGstCents != null
                              ? ` · Est. ${formatDollars(routeEstimate.estimateIncGstCents)} inc GST`
                              : ''
                          }`,
                        })}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">
                    {t('jobs.view.sectionStops', { defaultValue: 'Route Stops' })}
                  </dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {pickupAddressLine}, {pickupSuburb} {pickupState} {pickupPostcode}
                    {pricingModel === 'HOURLY' &&
                      (extraPickups ?? []).map((p, idx) =>
                        p.suburb ? (
                          <span
                            key={`sum-p-${idx}`}
                            className="mt-0.5 block text-xs font-normal text-clox-faint"
                          >
                            + Pickup #{idx + 2}: {p.addressLine}, {p.suburb} {p.state} {p.postcode}
                          </span>
                        ) : null,
                      )}
                    <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                      → {dropoffAddressLine}, {dropoffSuburb} {dropoffState} {dropoffPostcode}
                    </span>
                    {pricingModel === 'HOURLY' &&
                      (extraDropoffs ?? []).map((d, idx) =>
                        d.suburb ? (
                          <span
                            key={`sum-d-${idx}`}
                            className="mt-0.5 block text-xs font-normal text-clox-faint"
                          >
                            → Dropoff #{idx + 2}: {d.addressLine}, {d.suburb} {d.state} {d.postcode}
                          </span>
                        ) : null,
                      )}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.wizard.summaryCargo')}</dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {deadWeightKg} kg ·{' '}
                    {t('jobs.wizard.summaryDims', {
                      l: lengthCm,
                      w: widthCm,
                      h: heightCm,
                    })}
                    <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                      {loadTypes.join(', ')}
                      {minVehicleClass || recommend.data?.recommendedVehicleClass
                        ? ` · Class: ${minVehicleClass || recommend.data?.recommendedVehicleClass}`
                        : ''}
                      {recommend.data
                        ? ` · Chargeable: ${recommend.data.chargeableWeightKg.toFixed(1)} kg`
                        : ''}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.wizard.summaryReceiver')}</dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {receiverName || '—'}
                    <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                      {[receiverEmail, receiverPhone].filter(Boolean).join(' · ') || '—'}
                    </span>
                    {receiverAltEmail || receiverAltPhone ? (
                      <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                        Alt: {[receiverAltEmail, receiverAltPhone].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.siteAccess.badge')}</dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {formatManeuverabilityLabel(form.watch('siteManeuverability'))} ·{' '}
                    {formatFacilityLabel(form.watch('siteFacility'))}
                  </dd>
                </div>
              </dl>
            </div>

            {/* 3.5 Site Access & Maneuverability Assessment */}
            <div className="mb-6 rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1">
              <div className="mb-4 border-b border-clox-border/60 pb-3">
                <h3 className="font-display text-sm font-semibold text-clox-ink">
                  {t('jobs.siteAccess.sectionTitle')}
                </h3>
                <p className="mt-1 text-xs text-clox-mute">
                  {t('jobs.siteAccess.sectionDesc')}
                </p>
              </div>

              <div className="space-y-4">
                <RadioCardGroup
                  name="siteManeuverability"
                  label={t('jobs.siteAccess.maneuverabilityLabel')}
                  required
                  error={form.formState.errors.siteManeuverability?.message}
                  value={form.watch('siteManeuverability')}
                  onChange={(next) =>
                    form.setValue(
                      'siteManeuverability',
                      next as 'TIGHT_STREET' | 'STANDARD_INDUSTRIAL' | 'WIDE_YARD',
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      },
                    )
                  }
                  options={[
                    {
                      value: 'TIGHT_STREET',
                      title: t('jobs.siteAccess.tightStreet'),
                      description: t('jobs.siteAccess.tightStreetDesc'),
                    },
                    {
                      value: 'STANDARD_INDUSTRIAL',
                      title: t('jobs.siteAccess.standardIndustrial'),
                      description: t('jobs.siteAccess.standardIndustrialDesc'),
                    },
                    {
                      value: 'WIDE_YARD',
                      title: t('jobs.siteAccess.wideYard'),
                      description: t('jobs.siteAccess.wideYardDesc'),
                    },
                  ]}
                />

                <RadioCardGroup
                  name="siteFacility"
                  label={t('jobs.siteAccess.facilityLabel')}
                  required
                  error={form.formState.errors.siteFacility?.message}
                  value={form.watch('siteFacility')}
                  onChange={(next) =>
                    form.setValue(
                      'siteFacility',
                      next as 'RAISED_DOCK' | 'GROUND_LEVEL' | 'FORKLIFT_REQUIRED',
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      },
                    )
                  }
                  options={[
                    {
                      value: 'RAISED_DOCK',
                      title: t('jobs.siteAccess.raisedDock'),
                      description: t('jobs.siteAccess.raisedDockDesc'),
                    },
                    {
                      value: 'GROUND_LEVEL',
                      title: t('jobs.siteAccess.groundLevel'),
                      description: t('jobs.siteAccess.groundLevelDesc'),
                    },
                    {
                      value: 'FORKLIFT_REQUIRED',
                      title: t('jobs.siteAccess.forkliftRequired'),
                      description: t('jobs.siteAccess.forkliftRequiredDesc'),
                    },
                  ]}
                />

                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3.5">
                  <ChoiceCheck
                    error={form.formState.errors.siteDisclaimerAccepted?.message}
                    {...form.register('siteDisclaimerAccepted')}
                  >
                    <span className="text-xs font-medium text-clox-ink">
                      {t('jobs.siteDisclaimer')}
                    </span>
                  </ChoiceCheck>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {save.isError ? (
          <Notice tone="error" className="mb-4">
            {getErrorDetail(save.error)}
          </Notice>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="secondary" onClick={goBack}>
              {t('jobs.wizard.back')}
            </Button>
          ) : null}
          <Link to={cancelTo} className="clox-btn clox-btn-ghost">
            {t('jobs.wizard.cancel')}
          </Link>
          {step !== 'confirm' ? (
            <Button type="button" variant="cta" onClick={() => void goNext()}>
              {t('jobs.wizard.next')}
            </Button>
          ) : (
            <Button type="submit" variant="cta" disabled={save.isPending || dgUploading}>
              {save.isPending
                ? t('saving')
                : isEdit
                  ? t('jobs.saveDraft')
                  : t('jobs.createDraft')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export function JobDetailPage() {
  const { t } = useTranslation('common');
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const job = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => getSenderJob(id),
    enabled: role === AppRole.SENDER && Boolean(id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null);
  const [scaChallenge, setScaChallenge] = useState<{
    clientSecret: string;
    publishableKey: string;
    stripeStatus?: string;
    amountIncGstCents?: number;
  } | null>(null);

  const publish = useMutation({
    mutationFn: () => publishJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', id] }),
  });

  const applyAcceptResult = async (res: AcceptProposalResult) => {
    if (res.paidAndConfirmed) {
      setScaChallenge(null);
      setAcceptMsg(
        `${res.mock ? t('jobs.paidAndLockedMock') : t('jobs.paidAndLocked')}${res.idempotentReplay ? ` · ${t('jobs.idempotentReplay')}` : ''}`,
      );
    } else if (
      (res.stripeStatus === 'requires_action' ||
        res.stripeStatus === 'requires_payment_method' ||
        res.stripeStatus === 'requires_confirmation' ||
        res.paymentStatus === 'PENDING' ||
        res.paymentStatus === 'REQUIRES_ACTION') &&
      res.clientSecret &&
      res.publishableKey
    ) {
      setAcceptMsg(
        res.stripeStatus === 'requires_action'
          ? t('jobs.scaRequired')
          : t('jobs.paymentMethodRequired', {
              defaultValue: 'Complete card payment to lock this assignment.',
            }),
      );
      setScaChallenge({
        clientSecret: res.clientSecret,
        publishableKey: res.publishableKey,
        stripeStatus: res.stripeStatus,
        amountIncGstCents: res.amountIncGstCents,
      });
    } else if (res.clientSecret && !res.publishableKey) {
      setScaChallenge(null);
      setAcceptMsg(t('jobs.scaMissingPublishable'));
    } else {
      setScaChallenge(null);
      setAcceptMsg(
        `${res.message ?? res.paymentStatus}${res.stripeStatus ? ` · ${res.stripeStatus}` : ''}`,
      );
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['jobs', id] }),
      qc.invalidateQueries({ queryKey: ['jobs'] }),
      qc.invalidateQueries({ queryKey: ['carrier', 'vehicles'] }),
      qc.invalidateQueries({ queryKey: ['carrier', 'drivers'] }),
      qc.invalidateQueries({ queryKey: ['matching', 'board'] }),
    ]);
  };

  const toast = useToast();

  const approveReplacement = useMutation({
    mutationFn: (exceptionId: string) => approveTripExceptionReplacement(exceptionId),
    onSuccess: async () => {
      toast.success(t('jobs.exceptionApproveSuccess'));
      await qc.invalidateQueries({ queryKey: ['jobs', id] });
    },
  });

  const rejectReplacement = useMutation({
    mutationFn: (exceptionId: string) => rejectTripExceptionReplacement(exceptionId),
    onSuccess: async () => {
      toast.success(t('jobs.exceptionRejectSuccess'));
      await qc.invalidateQueries({ queryKey: ['jobs', id] });
    },
  });

  const accept = useMutation({
    mutationFn: (proposalId: string) => acceptProposal(id, proposalId),
    onError: (err) => {
      setScaChallenge(null);
      setAcceptMsg(getErrorDetail(err));
    },
    onSuccess: (res) => {
      void applyAcceptResult(res);
    },
  });

  const resumePayment = useMutation({
    mutationFn: () => syncJobPayment(id),
    onError: (err) => {
      setScaChallenge(null);
      setAcceptMsg(getErrorDetail(err));
    },
    onSuccess: (res) => {
      void applyAcceptResult(res);
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelJob(id),
    onSuccess: () => {
      toast.success(
        t('jobs.cancelSuccess', {
          defaultValue: 'Job cancelled successfully. Any open bids have been closed.',
        }),
      );
      void qc.invalidateQueries({ queryKey: ['jobs', id] });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (err) => {
      toast.error(getErrorDetail(err));
    },
  });

  const [proposalSort, setProposalSort] = useState<'recommended' | 'price' | 'reliability'>('recommended');
  const jobProposals = job.data?.proposals;
  const sortedProposals = useMemo(() => {
    const list = [...(jobProposals ?? [])];
    if (proposalSort === 'price') {
      return list.sort((a, b) => a.amountIncGstCents - b.amountIncGstCents);
    }
    if (proposalSort === 'reliability') {
      return list.sort(
        (a, b) =>
          (b.carrierCompany?.reliabilityScore ?? 100) -
          (a.carrierCompany?.reliabilityScore ?? 100),
      );
    }
    return list.sort((a, b) => {
      if (a.status === 'SUBMITTED' && b.status !== 'SUBMITTED') return -1;
      if (a.status !== 'SUBMITTED' && b.status === 'SUBMITTED') return 1;
      const aRel = a.carrierCompany?.reliabilityScore ?? 100;
      const bRel = b.carrierCompany?.reliabilityScore ?? 100;
      if (Math.abs(aRel - bRel) >= 10) return bRel - aRel;
      return a.amountIncGstCents - b.amountIncGstCents;
    });
  }, [jobProposals, proposalSort]);

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (job.isLoading) return <LoadingBlock label={t('jobs.loadingDetail')} />;
  if (job.isError || !job.data) {
    return (
      <Notice tone="error">{getErrorDetail(job.error)}</Notice>
    );
  }

  const j = job.data;
  const openProposals = (j.proposals ?? []).filter((p) => p.status === 'SUBMITTED');
  const pricingLabel =
    j.pricingModel === 'HOURLY' ? t('jobs.pricingHourly') : t('jobs.pricingPerKm');
  const canEdit = Boolean(j.editability?.mode && j.editability.mode !== 'NONE');
  const showPublish = j.status === 'DRAFT';

  const publishJobAction = () => {
    void (async () => {
      const ok = await confirm({
        title: t('confirm.publishJobTitle'),
        description: t('confirm.publishJobBody'),
        confirmLabel: t('jobs.publish'),
      });
      if (ok) publish.mutate();
    })();
  };

  const canCancel =
    Boolean(j) &&
    j.status !== 'CANCELLED' &&
    j.status !== 'COMPLETED' &&
    (!j.assignment || j.assignment.status === 'CANCELLED');

  const cancelJobAction = () => {
    void (async () => {
      const ok = await confirm({
        title: t('confirm.cancelJobTitle', { defaultValue: 'Cancel Job' }),
        description: t('confirm.cancelJobBody', {
          defaultValue:
            'Are you sure you want to cancel this job? All pending carrier proposals will be closed and vehicles/drivers will be released.',
        }),
        confirmLabel: t('jobs.cancelJob', { defaultValue: 'Cancel Job' }),
      });
      if (ok) cancel.mutate();
    })();
  };

  const detailRow = (label: string, value: ReactNode) => (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <dt className="text-clox-mute">{label}</dt>
      <dd className="text-right font-medium text-clox-ink">{value}</dd>
    </div>
  );

  return (
    <div>
      <Link to="/jobs" className="text-sm text-clox-orange hover:underline">
        ← {t('jobs.backToJobs')}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {j.title ?? t('jobs.fallbackTitle')}
          </h1>
          <p className="mt-1 text-sm text-clox-mute">
            {pricingLabel}
            {j.minVehicleClass
              ? ` · ${t('jobs.view.minClass')} ${j.minVehicleClass}`
              : ''}
            {j.recommendedVehicleClass
              ? ` · ${t('jobs.view.recClass')} ${j.recommendedVehicleClass}`
              : ''}
          </p>
          <p className="mt-1 font-mono text-[11px] text-clox-faint">
            {t('jobs.view.jobId')} · {j.id.slice(0, 8)}
          </p>
          <div className="mt-2 space-y-0.5 text-xs text-clox-faint">
            {formatWhen(j.createdAt) ? (
              <p>{t('jobs.createdAt', { when: formatWhen(j.createdAt) })}</p>
            ) : null}
            {formatWhen(j.publishedAt) ? (
              <p>{t('jobs.publishedAt', { when: formatWhen(j.publishedAt) })}</p>
            ) : null}
            {formatWhen(j.completedAt) ? (
              <p>{t('jobs.completedAt', { when: formatWhen(j.completedAt) })}</p>
            ) : null}
            {formatWhen(j.pickupAt) ? (
              <p>
                {t('jobs.view.pickup')}: {formatWhen(j.pickupAt)}
              </p>
            ) : null}
          </div>
        </div>
        <StatusPill tone={jobStatusTone(j.status)}>
          {t(`jobStatuses.${j.status}`, { defaultValue: j.status })}
        </StatusPill>
      </div>

      {j.openException ? (
        <Notice
          tone={
            j.openException.status === 'AWAITING_SENDER_APPROVAL' ? 'info' : 'warn'
          }
          className="mt-4"
          title={
            j.openException.status === 'AWAITING_SENDER_APPROVAL'
              ? t('jobs.exceptionApproveTitle')
              : t('jobs.exceptionBannerTitle')
          }
        >
          <p className="text-sm">
            {j.openException.kind} · {j.openException.phase} · {j.openException.status}
          </p>
          {j.openException.note ? (
            <p className="mt-1 text-xs text-clox-mute">{j.openException.note}</p>
          ) : null}
          {j.openException.status === 'AWAITING_SENDER_APPROVAL' ? (
            <>
              {(j.openException.proposedVehicle || j.openException.proposedDriver) && (
                <p className="mt-2 text-sm font-medium text-clox-ink">
                  {t('jobs.exceptionProposedCrew', {
                    vehicle:
                      j.openException.proposedVehicle?.registration ??
                      j.openException.proposedVehicle?.label ??
                      t('dash'),
                    driver:
                      j.openException.proposedDriver?.name ??
                      j.openException.proposedDriver?.email ??
                      t('dash'),
                  })}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="cta"
                  disabled={approveReplacement.isPending || rejectReplacement.isPending}
                  onClick={() => approveReplacement.mutate(j.openException!.id)}
                >
                  {approveReplacement.isPending
                    ? t('loading')
                    : t('jobs.exceptionApprove')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={approveReplacement.isPending || rejectReplacement.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('jobs.exceptionReject'),
                      description: t('jobs.exceptionRejectConfirm'),
                      confirmLabel: t('jobs.exceptionReject'),
                      tone: 'destructive',
                    });
                    if (ok) rejectReplacement.mutate(j.openException!.id);
                  }}
                >
                  {rejectReplacement.isPending
                    ? t('loading')
                    : t('jobs.exceptionReject')}
                </Button>
              </div>
              {approveReplacement.isError ? (
                <Notice tone="error" className="mt-2">
                  {getErrorDetail(approveReplacement.error)}
                </Notice>
              ) : null}
              {rejectReplacement.isError ? (
                <Notice tone="error" className="mt-2">
                  {getErrorDetail(rejectReplacement.error)}
                </Notice>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-xs text-clox-faint">{t('jobs.exceptionBannerHint')}</p>
          )}
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
            <h2 className="font-display text-sm font-semibold text-clox-ink">
              {t('jobs.view.sectionPricing')}
            </h2>
            <dl className="mt-3 space-y-2">
              {detailRow(t('validation.pricingModelLabel'), pricingLabel)}
              {detailRow(
                t('jobs.view.distance'),
                j.route.distanceKm != null ? `${j.route.distanceKm} km` : t('dash'),
              )}
              {detailRow(
                t('jobs.view.duration'),
                <>
                  {j.route.durationMinutes != null
                    ? `${j.route.durationMinutes} min`
                    : t('dash')}
                  {j.route.fatigueBreakMinutes > 0
                    ? ` ${t('jobs.fatigueBreak', { minutes: j.route.fatigueBreakMinutes })}`
                    : ''}
                  {j.route.billableHours != null
                    ? ` ${t('jobs.billableHours', { hours: j.route.billableHours })}`
                    : ''}
                </>,
              )}
              {detailRow(
                t('jobs.view.estimate'),
                j.estimate.incGstCents != null
                  ? t('jobs.estimateIncGst', {
                      amount: formatDollars(j.estimate.incGstCents),
                    })
                  : t('dash'),
              )}
            </dl>
          </section>

          {(j.stops?.length ?? 0) > 0 ? (
            <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <h2 className="font-display text-sm font-semibold text-clox-ink">
                {t('jobs.view.sectionStops')}
              </h2>
              <ol className="mt-3 space-y-2">
                {j.stops.map((s) => (
                  <li
                    key={s.id ?? `${s.sequence}-${s.stopType}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="font-medium text-clox-ink">
                      {s.stopType} ·{' '}
                      {[
                        s.addressLine,
                        s.suburb ?? t('dash'),
                        [s.state, s.postcode].filter(Boolean).join(' '),
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    {s.receiverName || s.receiverEmail ? (
                      <span className="text-xs text-clox-faint">
                        {[s.receiverName, s.receiverEmail].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {(j.assignment || j.payment) && (
            <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-clox-ink">
                  {t('jobs.view.sectionAssignment')}
                </h2>
                {j.assignment &&
                !j.assignment.paidAndConfirmed &&
                j.assignment.status !== 'CANCELLED' ? (
                  <Button
                    type="button"
                    variant="cta"
                    size="sm"
                    disabled={resumePayment.isPending}
                    onClick={() => resumePayment.mutate()}
                  >
                    {resumePayment.isPending
                      ? t('loading')
                      : t('jobs.completePayment', { defaultValue: 'Complete payment' })}
                  </Button>
                ) : null}
              </div>
              <dl className="mt-3 space-y-2">
                {j.assignment
                  ? detailRow(
                      t('jobs.view.assignmentStatus'),
                      <span
                        className={
                          j.assignment.paidAndConfirmed
                            ? 'text-[var(--status-ok)]'
                            : undefined
                        }
                      >
                        {j.assignment.status}
                        {j.assignment.paidAndConfirmed
                          ? ` ${t('jobs.assignmentPaid')}`
                          : ` ${t('jobs.assignmentPendingPayment')}`}
                      </span>,
                    )
                  : null}
                {j.payment
                  ? detailRow(
                      t('jobs.view.paymentStatus'),
                      <span className="font-mono text-xs">
                        {t('jobs.paymentLine', {
                          status: j.payment.status,
                          pi: j.payment.stripePaymentIntentId ?? t('dash'),
                        })}
                      </span>,
                    )
                  : null}
              </dl>
              {j.assignment &&
              !j.assignment.paidAndConfirmed &&
              j.assignment.status !== 'CANCELLED' ? (
                <p className="mt-3 text-xs text-clox-mute">
                  {t('jobs.pendingPaymentResumeHint', {
                    defaultValue:
                      'Bid accepted — complete card payment to lock this assignment so the carrier can begin the trip.',
                  })}
                </p>
              ) : null}
            </section>
          )}

          {(canEdit || showPublish || canCancel) && (
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Link
                  to={`/jobs/${j.id}/edit`}
                  className="clox-btn clox-btn-secondary inline-flex"
                >
                  {j.editability?.mode === 'RECEIVER'
                    ? t('jobs.editReceiver')
                    : t('jobs.editJob')}
                </Link>
              ) : null}
              {showPublish ? (
                <Button
                  variant="cta"
                  disabled={publish.isPending}
                  onClick={publishJobAction}
                >
                  {publish.isPending ? t('loading') : t('jobs.publish')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="text-clox-error border-clox-error/40 hover:bg-clox-error/5"
                  disabled={cancel.isPending}
                  onClick={cancelJobAction}
                >
                  {cancel.isPending ? t('loading') : t('jobs.cancelJob', { defaultValue: 'Cancel job' })}
                </Button>
              ) : null}
            </div>
          )}
          {j.status === 'CANCELLED' ? (
            <Notice tone="warn">
              {t('jobs.jobCancelledNotice', {
                defaultValue: 'This job has been cancelled. No bids can be accepted.',
              })}
            </Notice>
          ) : null}
          {j.editability?.mode === 'RECEIVER' ? (
            <p className="text-xs text-clox-mute">{t('jobs.editReceiverHint')}</p>
          ) : null}
          {publish.isError ? (
            <Notice tone="error">{getErrorDetail(publish.error)}</Notice>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-clox-ink">
                  {t('jobs.proposalsTitle')}
                </h2>
                {(j.openProposalCount ?? openProposals.length) > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-clox-orange dark:bg-orange-950/40 dark:text-orange-400">
                    {t('jobs.openBidsCount', {
                      count: j.openProposalCount ?? openProposals.length,
                    })}
                  </span>
                ) : null}
              </div>
              {sortedProposals.length > 1 ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-clox-faint">{t('jobs.sortBy', { defaultValue: 'Sort:' })}</span>
                  <button
                    type="button"
                    onClick={() => setProposalSort('recommended')}
                    className={cn(
                      'rounded px-2 py-0.5 font-medium transition',
                      proposalSort === 'recommended'
                        ? 'bg-clox-orange text-white'
                        : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
                    )}
                  >
                    {t('jobs.sortRecommended', { defaultValue: 'Recommended' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposalSort('price')}
                    className={cn(
                      'rounded px-2 py-0.5 font-medium transition',
                      proposalSort === 'price'
                        ? 'bg-clox-orange text-white'
                        : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
                    )}
                  >
                    {t('jobs.sortPrice', { defaultValue: 'Lowest Price' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposalSort('reliability')}
                    className={cn(
                      'rounded px-2 py-0.5 font-medium transition',
                      proposalSort === 'reliability'
                        ? 'bg-clox-orange text-white'
                        : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
                    )}
                  >
                    {t('jobs.sortReliability', { defaultValue: 'Reliability' })}
                  </button>
                </div>
              ) : null}
            </div>
            {sortedProposals.length === 0 ? (
              <p className="mt-2 text-sm text-clox-faint">{t('jobs.noBidsYet')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {sortedProposals.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-clox-ink">
                            {p.carrierCompany?.tradingName ||
                              p.carrierCompany?.legalName ||
                              p.carrierLabel}
                            {p.carrierCompany?.tradingName &&
                            p.carrierCompany.legalName &&
                            p.carrierCompany.tradingName !== p.carrierCompany.legalName ? (
                              <span className="ml-1.5 text-xs font-normal text-clox-mute">
                                ({p.carrierCompany.legalName})
                              </span>
                            ) : null}
                          </p>
                          {typeof p.carrierCompany?.reliabilityScore === 'number' ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                p.carrierCompany.reliabilityScore >= 90
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : p.carrierCompany.reliabilityScore >= 75
                                    ? 'border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                                    : p.carrierCompany.reliabilityScore >= 60
                                      ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                      : 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
                              )}
                              title={t('companies.reliabilityScoreTooltip', {
                                defaultValue:
                                  'Carrier Reliability Score based on historical on-time delivery and breakdown records',
                              })}
                            >
                              <ShieldCheck className="h-3 w-3 shrink-0" />
                              <span>
                                {p.carrierCompany.reliabilityScore}%{' '}
                                {t('companies.reliabilityShort', { defaultValue: 'Reliability' })}
                              </span>
                              {p.carrierCompany.reliabilityScore >= 90 ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                  ★ {t('companies.topRated', { defaultValue: 'Top Rated' })}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                        {(p.carrierCompany?.email ||
                          p.carrierCompany?.phone ||
                          p.carrierCompany?.abn) ? (
                          <p className="text-xs text-clox-mute">
                            {[
                              p.carrierCompany?.email,
                              p.carrierCompany?.phone,
                              p.carrierCompany?.abn ? `ABN ${p.carrierCompany.abn}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        <p className="text-sm text-clox-mute">
                          {t('jobs.view.bidAmount', {
                            amount: formatDollars(p.amountIncGstCents),
                          })}
                          {p.etaMinutes != null
                            ? ` · ${t('jobs.view.etaMinutes', { minutes: p.etaMinutes })}`
                            : ''}
                          {p.vehicleClass ? ` · ${p.vehicleClass}` : ''}
                          {p.vehicleRegistration || p.vehicleLabel
                            ? ` (${[p.vehicleLabel, p.vehicleRegistration]
                                .filter(
                                  (val, i, arr) => Boolean(val) && arr.indexOf(val) === i,
                                )
                                .join(' · ')})`
                            : ''}
                        </p>
                        {(p.driver?.name || p.driver?.email) ? (
                          <p className="text-xs text-clox-faint">
                            {[
                              p.driver.name,
                              p.driver.email,
                              p.driver.licenceClass
                                ? `${t('validation.licenceClassLabel')}: ${p.driver.licenceClass}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        {p.dgDocumentId ? (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-clox-border bg-clox-surface p-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-clox-orange" />
                              <span
                                className="truncate font-medium text-clox-ink"
                                title={p.dgDocumentFilename || undefined}
                              >
                                {p.dgDocumentFilename ||
                                  t('jobs.viewCarrierDgDoc', {
                                    defaultValue: 'Carrier DG Document',
                                  })}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 px-2 py-0.5 text-xs font-semibold"
                              onClick={() =>
                                void openDocumentContent(p.dgDocumentId!).catch((err) =>
                                  toast.error(getErrorDetail(err)),
                                )
                              }
                            >
                              {t('jobs.viewDoc', { defaultValue: 'View' })}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <StatusPill
                        tone={
                          p.status === 'ACCEPTED'
                            ? j.assignment?.paidAndConfirmed
                              ? 'ok'
                              : 'warn'
                            : p.status === 'SUBMITTED'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {p.status === 'ACCEPTED' &&
                        j.assignment &&
                        !j.assignment.paidAndConfirmed &&
                        j.assignment.status !== 'CANCELLED'
                          ? `${p.status} ${t('jobs.assignmentPendingPayment')}`
                          : p.status}
                      </StatusPill>
                    </div>
                    {p.status === 'SUBMITTED' && (!j.assignment || j.assignment.status === 'CANCELLED') ? (
                      <Button
                        variant="cta"
                        className="mt-3"
                        disabled={accept.isPending}
                        onClick={() => {
                          void (async () => {
                            const ok = await confirm({
                              title: t('confirm.acceptProposalTitle'),
                              description: t('confirm.acceptProposalBody'),
                              confirmLabel: t('jobs.acceptAndCharge'),
                            });
                            if (ok) accept.mutate(p.id);
                          })();
                        }}
                      >
                        {t('jobs.acceptAndCharge')}
                      </Button>
                    ) : p.status === 'ACCEPTED' &&
                      j.assignment &&
                      !j.assignment.paidAndConfirmed &&
                      j.assignment.status !== 'CANCELLED' ? (
                      <Button
                        variant="cta"
                        className="mt-3"
                        disabled={resumePayment.isPending}
                        onClick={() => resumePayment.mutate()}
                      >
                        {resumePayment.isPending
                          ? t('loading')
                          : t('jobs.completePayment', { defaultValue: 'Complete payment' })}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {openProposals.length === 0 && j.assignment?.paidAndConfirmed && j.assignment.status !== 'CANCELLED' ? (
            <div className="space-y-2">
              <Notice tone="success">{t('jobs.jobPaidLocked')}</Notice>
              <Link
                to={`/jobs/${j.id}/track`}
                className="text-sm text-clox-orange hover:underline"
              >
                {t('jobs.openLiveTrack')}
              </Link>
            </div>
          ) : null}
          {scaChallenge ? (
            <ScaPaymentConfirm
              clientSecret={scaChallenge.clientSecret}
              publishableKey={scaChallenge.publishableKey}
              stripeStatus={scaChallenge.stripeStatus}
              amountIncGstCents={scaChallenge.amountIncGstCents}
              onCancel={() => setScaChallenge(null)}
              onSucceeded={async () => {
                const synced = await syncJobPayment(id);
                await applyAcceptResult(synced);
              }}
            />
          ) : null}
          {acceptMsg ? <Notice tone="warn">{acceptMsg}</Notice> : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
            <h2 className="font-display text-sm font-semibold text-clox-ink">
              {t('jobs.view.sectionCargo')}
            </h2>
            <dl className="mt-3 space-y-2">
              {detailRow(
                t('jobs.view.weight'),
                j.deadWeightKg != null ? `${j.deadWeightKg} kg` : t('dash'),
              )}
              {detailRow(
                t('jobs.view.dims'),
                j.lengthCm != null && j.widthCm != null && j.heightCm != null
                  ? t('jobs.wizard.summaryDims', {
                      l: j.lengthCm,
                      w: j.widthCm,
                      h: j.heightCm,
                    })
                  : t('dash'),
              )}
              {detailRow(
                t('jobs.view.chargeable'),
                j.chargeableWeightKg != null
                  ? `${j.chargeableWeightKg} kg`
                  : t('dash'),
              )}
              {detailRow(
                t('jobs.view.dg'),
                j.requiresDg ? t('jobs.view.dgYes') : t('jobs.view.dgNo'),
              )}
              {j.minVehicleClass
                ? detailRow(t('jobs.view.minClass'), j.minVehicleClass)
                : null}
            </dl>
            {j.requiresDg && j.dgDocumentId ? (
              <div className="mt-3 border-t border-clox-border pt-3">
                <div className="rounded-lg border border-clox-border bg-clox-surface p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-clox-orange/10 text-clox-orange">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-clox-mute">
                        {t('jobs.dgDocSectionTitle', { defaultValue: 'DG Declaration' })}
                      </p>
                      <p
                        className="truncate text-xs font-semibold text-clox-ink"
                        title={j.dgDocumentFilename || 'DG Declaration / SDS'}
                      >
                        {j.dgDocumentFilename || 'DG Declaration / SDS'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-clox-border/60 pt-2 text-[11px]">
                    <span className="font-medium text-[var(--status-ok)]">
                      ✓ {t('jobs.dgDocVerifiedAttached', { defaultValue: 'Attached' })}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 px-2.5 py-1 text-xs font-semibold"
                      onClick={() =>
                        void openDocumentContent(j.dgDocumentId!).catch((err) =>
                          toast.error(getErrorDetail(err)),
                        )
                      }
                    >
                      {t('jobs.viewDgDoc', { defaultValue: 'View Document' })}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
            <h2 className="font-display text-sm font-semibold text-clox-ink">
              {t('jobs.siteAccess.sectionTitle')}
            </h2>
            <dl className="mt-3 space-y-2">
              {detailRow(
                t('jobs.siteAccess.maneuverabilityLabel'),
                formatManeuverabilityLabel(j.siteManeuverability),
              )}
              {detailRow(
                t('jobs.siteAccess.facilityLabel'),
                formatFacilityLabel(j.siteFacility),
              )}
              {detailRow(
                t('jobs.siteAccess.disclaimerLabel'),
                j.siteDisclaimerAcceptedAt ? (
                  <span className="text-xs font-medium text-[var(--status-ok)]">
                    ✓ Accepted ({new Date(j.siteDisclaimerAcceptedAt).toLocaleDateString()})
                  </span>
                ) : (
                  <span className="text-xs text-clox-faint">—</span>
                ),
              )}
            </dl>
          </section>

          <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
            <h2 className="font-display text-sm font-semibold text-clox-ink">
              {t('jobs.view.sectionReceiver')}
            </h2>
            <dl className="mt-3 space-y-2">
              {detailRow(t('jobs.receiverName'), j.receiverName || t('dash'))}
              {detailRow(t('jobs.receiverEmail'), j.receiverEmail || t('dash'))}
              {detailRow(t('jobs.receiverPhone'), j.receiverPhone || t('dash'))}
              {j.receiverAltEmail
                ? detailRow(
                    t('jobs.receiverAltEmail', { defaultValue: 'Alternate Email' }),
                    j.receiverAltEmail,
                  )
                : null}
              {j.receiverAltPhone
                ? detailRow(
                    t('jobs.receiverAltPhone', { defaultValue: 'Alternate Phone' }),
                    j.receiverAltPhone,
                  )
                : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
