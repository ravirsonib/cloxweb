import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  acceptProposal,
  approveTripExceptionReplacement,
  createJob,
  getErrorDetail,
  getSenderJob,
  listSenderJobs,
  previewJobRoute,
  publishJob,
  recommendVehicle,
  rejectTripExceptionReplacement,
  syncJobPayment,
  updateJob,
  updateJobReceiver,
  type AcceptProposalResult,
  type JobSummary,
} from '@/lib/api';
import { ScaPaymentConfirm } from '@/components/stripe/ScaPaymentConfirm';
import {
  Button,
  ChoiceCheck,
  DataCardList,
  DataTable,
  Field,
  Notice,
  RadioCardGroup,
  ResponsiveDataView,
  StatusFilterChips,
  StatusPill,
  StepChips,
  ViewModeToggle,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import {
  countByBucket,
  filterAndSortByBucket,
  statusAccentClass,
  type ListStatusTone,
} from '@/lib/status-list';
import { jobStatusTone } from '@/lib/status-tone';
import {
  MAX_JOB_CHARGEABLE_WEIGHT_KG,
  MAX_JOB_DEAD_WEIGHT_KG,
  MAX_JOB_HEIGHT_CM,
  MAX_JOB_LENGTH_CM,
  MAX_JOB_WIDTH_CM,
  chargeableWeightKg,
  isChargeableOverLimit,
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
            ? `$${(j.estimate.incGstCents / 100).toFixed(2)}`
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
        <DataCardList
          className="mt-6"
          items={filteredItems}
          getKey={(j) => j.id}
          mode="grid"
          renderItem={jobCard}
        />
      ) : (
        <ResponsiveDataView
          className="mt-6"
          cards={
            <DataCardList
              items={filteredItems}
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
              {filteredItems.map((j) => {
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
                        ? `$${(j.estimate.incGstCents / 100).toFixed(2)}`
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
      )}
    </div>
  );
}

type JobCreateForm = {
  pricingModel: 'PER_KM' | 'HOURLY';
  distanceKm: number;
  deadWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  loadDg: boolean;
  receiverName: string;
  receiverEmail: string;
  siteDisclaimerAccepted: boolean;
};

/** Single pickup → single dropoff only (multi-stop / multi-pickup deferred). */
function buildDemoStops(values: Pick<JobCreateForm, 'receiverName' | 'receiverEmail'>) {
  return [
    {
      sequence: 0,
      stopType: 'PICKUP' as const,
      addressLine: '1 Collins St',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      lat: -37.8136,
      lng: 144.9631,
    },
    {
      sequence: 1,
      stopType: 'DROPOFF' as const,
      addressLine: '100 Airport Dr',
      suburb: 'Tullamarine',
      state: 'VIC',
      postcode: '3045',
      lat: -37.669,
      lng: 144.841,
      receiverName: values.receiverName,
      receiverEmail: values.receiverEmail,
    },
  ];
}

function buildJobTitle(
  values: JobCreateForm,
  stops: ReturnType<typeof buildDemoStops>,
): string {
  const pickup = stops.find((s) => s.stopType === 'PICKUP')?.suburb?.trim() || 'Pickup';
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
  // Route-first label; include weight so demo jobs are distinguishable on the market board.
  return `${pickup} → ${destination} · ${values.pricingModel} · ${values.deadWeightKg}kg`;
}

function buildJobPayload(values: JobCreateForm) {
  const loadTypes = ['GENERAL', ...(values.loadDg ? (['DG'] as const) : [])];
  const stops = buildDemoStops(values);
  return {
    title: buildJobTitle(values, stops),
    pricingModel: values.pricingModel,
    // Pattern A reserved for simple 1 pickup → 1 drop; multi-stop / Pattern B deferred.
    hourlyPattern: values.pricingModel === 'HOURLY' ? ('A' as const) : undefined,
    pickupAt: new Date(Date.now() + 86_400_000).toISOString(),
    receiverName: values.receiverName,
    receiverEmail: values.receiverEmail,
    deadWeightKg: values.deadWeightKg,
    lengthCm: values.lengthCm,
    widthCm: values.widthCm,
    heightCm: values.heightCm,
    distanceKm: values.distanceKm,
    loadTypes,
    siteManeuverability: 'MODERATE',
    siteFacility: 'GROUND',
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
    receiverPhone: z.string().trim().optional(),
  });

  type ReceiverForm = z.infer<typeof schema>;

  const form = useForm<ReceiverForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      receiverName: job.receiverName || '',
      receiverEmail: job.receiverEmail || '',
      receiverPhone: job.receiverPhone || '',
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
        receiverPhone: values.receiverPhone?.trim() || null,
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
    const ok = await form.trigger(['receiverName', 'receiverEmail', 'receiverPhone']);
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
      const ok = await form.trigger(['receiverName', 'receiverEmail', 'receiverPhone']);
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
      <Field label={t('jobs.receiverPhone')} {...form.register('receiverPhone')} />
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
  pricing: ['pricingModel', 'distanceKm'],
  cargo: ['deadWeightKg', 'lengthCm', 'widthCm', 'heightCm', 'loadDg'],
  receiver: ['receiverName', 'receiverEmail'],
  confirm: ['siteDisclaimerAccepted'],
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

  const schema = z
    .object({
      pricingModel: z.enum(['PER_KM', 'HOURLY']),
      distanceKm: z.number().positive(t('validation.distancePositive')),
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
      receiverName: z.string().trim().min(1, t('validation.receiverNameRequired')),
      receiverEmail: z
        .string()
        .trim()
        .min(1, t('validation.receiverEmailRequired'))
        .email(t('validation.receiverEmailInvalid')),
      siteDisclaimerAccepted: z.boolean().refine((value) => value === true, {
        message: t('validation.siteDisclaimerRequired'),
      }),
    })
    .superRefine((values, ctx) => {
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
    });

  const form = useForm<JobCreateForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      pricingModel: 'PER_KM',
      distanceKm: undefined as unknown as number,
      deadWeightKg: 800,
      lengthCm: 120,
      widthCm: 80,
      heightCm: 80,
      loadDg: false,
      receiverName: '',
      receiverEmail: '',
      siteDisclaimerAccepted: false,
    },
  });

  const existing = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getSenderJob(jobId),
    enabled: isEdit && role === AppRole.SENDER && Boolean(jobId),
  });

  const lastSuggestedKm = useRef<number | null>(null);
  const [suggestedKm, setSuggestedKm] = useState<number | null>(null);
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
    form.reset({
      pricingModel: existing.data.pricingModel === 'HOURLY' ? 'HOURLY' : 'PER_KM',
      distanceKm: Number.isFinite(savedKm) && savedKm > 0 ? savedKm : (undefined as unknown as number),
      deadWeightKg: Number(existing.data.deadWeightKg) || 800,
      lengthCm: Number(existing.data.lengthCm) || 120,
      widthCm: Number(existing.data.widthCm) || 80,
      heightCm: Number(existing.data.heightCm) || 80,
      loadDg: Boolean(existing.data.requiresDg),
      receiverName: existing.data.receiverName || '',
      receiverEmail: existing.data.receiverEmail || '',
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
  const receiverName = form.watch('receiverName');
  const receiverEmail = form.watch('receiverEmail');
  const deadWeightKg = form.watch('deadWeightKg');
  const lengthCm = form.watch('lengthCm');
  const widthCm = form.watch('widthCm');
  const heightCm = form.watch('heightCm');
  const distanceKm = form.watch('distanceKm');
  const loadDg = form.watch('loadDg');

  useEffect(() => {
    if (role !== AppRole.SENDER) return;
    if (isEdit && !hydratedEdit.current) return;
    let cancelled = false;
    const stops = buildDemoStops({
      receiverName: receiverName.trim() || 'Receiver',
      receiverEmail: receiverEmail.trim() || 'receiver@example.com',
    });
    void previewJobRoute({ pricingModel, stops })
      .then((route) => {
        if (cancelled) return;
        setSuggestedKm(route.distanceKm);
        const current = form.getValues('distanceKm');
        const last = lastSuggestedKm.current;
        const isEmpty = !Number.isFinite(current) || current <= 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suggest from pricing + demo stops
  }, [pricingModel, isEdit, role]);

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
    <div className="max-w-2xl">
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
          void form.handleSubmit((values) => save.mutate(values))();
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
          </>
        ) : null}

        {step === 'cargo' ? (
          <>
            <Field
              type="number"
              label={t('validation.deadWeightLabel')}
              required
              hint={t('jobs.deadWeightMaxHint', { max: MAX_JOB_DEAD_WEIGHT_KG })}
              error={form.formState.errors.deadWeightKg?.message}
              {...form.register('deadWeightKg', { valueAsNumber: true })}
            />
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
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
            {!cargoOverLimit && recommend.data ? (
              <Notice tone="success" className="mb-4">
                {t('jobs.chargeableHint', {
                  kg: recommend.data.chargeableWeightKg.toFixed(1),
                  vehicleClass: recommend.data.recommendedVehicleClass,
                })}
              </Notice>
            ) : null}
            <ChoiceCheck className="mb-4" {...form.register('loadDg')}>
              {t('jobs.dgLoad')}
            </ChoiceCheck>
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
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <div className="mb-4 rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
              <p className="font-display text-sm font-semibold text-clox-ink">
                {t('jobs.wizard.summaryTitle')}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.wizard.summaryPricing')}</dt>
                  <dd className="font-medium text-clox-ink">
                    {pricingModel === 'HOURLY'
                      ? t('jobs.pricingHourly')
                      : t('jobs.pricingPerKm')}
                    {' · '}
                    {t('jobs.wizard.summaryDistance', {
                      km: Number.isFinite(distanceKm) ? distanceKm : '—',
                    })}
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
                      {loadDg ? t('jobs.wizard.summaryDgYes') : t('jobs.wizard.summaryDgNo')}
                      {recommend.data
                        ? ` · ${t('jobs.chargeableHint', {
                            kg: recommend.data.chargeableWeightKg.toFixed(1),
                            vehicleClass: recommend.data.recommendedVehicleClass,
                          })}`
                        : ''}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-clox-mute">{t('jobs.wizard.summaryReceiver')}</dt>
                  <dd className="text-right font-medium text-clox-ink">
                    {receiverName || '—'}
                    <span className="mt-0.5 block text-xs font-normal text-clox-faint">
                      {receiverEmail || '—'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <ChoiceCheck
              className="mb-4"
              error={form.formState.errors.siteDisclaimerAccepted?.message}
              {...form.register('siteDisclaimerAccepted')}
            >
              {t('jobs.siteDisclaimer')}
            </ChoiceCheck>
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
            <Button type="submit" variant="cta" disabled={save.isPending}>
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
  });
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null);
  const [scaChallenge, setScaChallenge] = useState<{
    clientSecret: string;
    publishableKey: string;
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
      res.stripeStatus === 'requires_action' &&
      res.clientSecret &&
      res.publishableKey
    ) {
      setAcceptMsg(t('jobs.scaRequired'));
      setScaChallenge({
        clientSecret: res.clientSecret,
        publishableKey: res.publishableKey,
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
    await qc.invalidateQueries({ queryKey: ['jobs', id] });
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
                      amount: (j.estimate.incGstCents / 100).toFixed(2),
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
                      {s.stopType} · {s.suburb ?? t('dash')}
                      {s.state ? `, ${s.state}` : ''}
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
              <h2 className="font-display text-sm font-semibold text-clox-ink">
                {t('jobs.view.sectionAssignment')}
              </h2>
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
            </section>
          )}

          {(canEdit || showPublish) && (
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
            </div>
          )}
          {j.editability?.mode === 'RECEIVER' ? (
            <p className="text-xs text-clox-mute">{t('jobs.editReceiverHint')}</p>
          ) : null}
          {publish.isError ? (
            <Notice tone="error">{getErrorDetail(publish.error)}</Notice>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('jobs.proposalsTitle')}
              </h2>
              {(j.openProposalCount ?? openProposals.length) > 0 ? (
                <span className="text-xs text-clox-faint">
                  {t('jobs.openBidsCount', {
                    count: j.openProposalCount ?? openProposals.length,
                  })}
                </span>
              ) : null}
            </div>
            {(j.proposals ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-clox-faint">{t('jobs.noBidsYet')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(j.proposals ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-clox-1"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-clox-ink">{p.carrierLabel}</p>
                        <p className="mt-1 text-sm text-clox-mute">
                          {t('jobs.view.bidAmount', {
                            amount: (p.amountIncGstCents / 100).toFixed(2),
                          })}
                          {p.etaMinutes != null
                            ? ` · ${t('jobs.view.etaMinutes', { minutes: p.etaMinutes })}`
                            : ''}
                          {p.vehicleClass ? ` · ${p.vehicleClass}` : ''}
                        </p>
                      </div>
                      <StatusPill
                        tone={
                          p.status === 'ACCEPTED'
                            ? 'ok'
                            : p.status === 'SUBMITTED'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {p.status}
                      </StatusPill>
                    </div>
                    {p.status === 'SUBMITTED' && !j.assignment ? (
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
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {openProposals.length === 0 && j.assignment?.paidAndConfirmed ? (
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
          </section>

          <section className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-4">
            <h2 className="font-display text-sm font-semibold text-clox-ink">
              {t('jobs.view.sectionReceiver')}
            </h2>
            <dl className="mt-3 space-y-2">
              {detailRow(t('jobs.receiverName'), j.receiverName || t('dash'))}
              {detailRow(t('jobs.receiverEmail'), j.receiverEmail || t('dash'))}
              {j.receiverPhone
                ? detailRow(t('jobs.receiverPhone'), j.receiverPhone)
                : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
