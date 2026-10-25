import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  acceptProposal,
  createJob,
  getErrorDetail,
  getSenderJob,
  listSenderJobs,
  previewJobRoute,
  publishJob,
  recommendVehicle,
  updateJob,
  updateJobReceiver,
  type JobSummary,
} from '@/lib/api';
import {
  Button,
  DataCardList,
  DataTable,
  Field,
  Notice,
  RadioCardGroup,
  ResponsiveDataView,
  ViewModeToggle,
  dataCardClassName,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function JobsListPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const [viewMode, setViewMode] = useDataViewMode('jobs', 'list');
  const jobs = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: () => listSenderJobs(),
    enabled: role === AppRole.SENDER,
  });

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (jobs.isLoading) return <LoadingBlock label={t('jobs.loadingList')} />;

  const items = jobs.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-clox-ink">{t('jobs.listTitle')}</h1>
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

      {(() => {
        const jobCard = (j: (typeof items)[number]) => (
          <Link to={`/jobs/${j.id}`} className={`block h-full ${dataCardClassName}`}>
            <p className="font-semibold text-clox-ink">{j.title ?? j.id.slice(0, 8)}</p>
            <p className="mt-1 font-mono text-xs text-clox-mute">
              {j.status} · {j.pricingModel} · min {j.minVehicleClass} ·{' '}
              {j.estimate.incGstCents != null
                ? `$${(j.estimate.incGstCents / 100).toFixed(2)}`
                : t('dash')}
              {(j.openProposalCount ?? 0) > 0
                ? ` · ${t('jobs.openBidsCount', { count: j.openProposalCount })}`
                : ''}
            </p>
          </Link>
        );

        if (viewMode === 'grid') {
          return (
            <DataCardList
              className="mt-6"
              items={items}
              getKey={(j) => j.id}
              mode="grid"
              renderItem={jobCard}
            />
          );
        }

        return (
          <ResponsiveDataView
            className="mt-6"
            cards={
              <DataCardList
                items={items}
                getKey={(j) => j.id}
                mode="list"
                renderItem={jobCard}
              />
            }
            table={
              <DataTable
                headers={[
                  t('jobs.colTitle'),
                  t('admin.colStatus'),
                  t('jobs.colPricing'),
                  t('jobs.colClass'),
                  t('jobs.colEstimate'),
                  t('jobs.colBids'),
                ]}
              >
                {items.map((j) => (
                  <tr
                    key={j.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/jobs/${j.id}`}
                        className="font-medium text-clox-ink hover:text-clox-orange"
                      >
                        {j.title ?? j.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clox-mute">{j.status}</td>
                    <td className="px-4 py-3 text-clox-mute">{j.pricingModel}</td>
                    <td className="px-4 py-3 font-mono text-xs">{j.minVehicleClass}</td>
                    <td className="px-4 py-3 text-clox-mute">
                      {j.estimate.incGstCents != null
                        ? `$${(j.estimate.incGstCents / 100).toFixed(2)}`
                        : t('dash')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                      {(j.openProposalCount ?? 0) > 0
                        ? t('jobs.openBidsCount', { count: j.openProposalCount })
                        : t('dash')}
                    </td>
                  </tr>
                ))}
              </DataTable>
            }
          />
        );
      })()}
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
  // Route-first label; pricing model last for board scanning.
  return `${pickup} → ${destination} · ${values.pricingModel}`;
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

function JobReceiverForm({ jobId, job }: { jobId: string; job: JobSummary }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const dropoffs = (job.stops ?? []).filter((s) => s.stopType === 'DROPOFF' && s.id);

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

  return (
    <div>
      <Link to={`/jobs/${jobId}`} className="text-sm text-clox-orange hover:underline">
        ← {t('jobs.backToJob')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink">
        {t('jobs.editReceiverTitle')}
      </h1>
      <p className="mt-1 text-sm text-clox-mute">{t('jobs.editReceiverHint')}</p>
      <form
        className="mt-8 max-w-lg space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
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
          {...form.register('receiverPhone')}
        />
        {dropoffs.length > 1
          ? dropoffs.map((s) =>
              s.id ? (
                <div key={s.id} className="rounded border border-clox-line p-3">
                  <p className="mb-2 text-sm font-medium text-clox-ink">
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
            )
          : null}
        {mutation.isError ? (
          <Notice tone="error">{getErrorDetail(mutation.error)}</Notice>
        ) : null}
        <Button type="submit" variant="cta" disabled={mutation.isPending}>
          {mutation.isPending ? t('submitting') : t('jobs.saveReceiver')}
        </Button>
      </form>
    </div>
  );
}

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

  const schema = z.object({
    pricingModel: z.enum(['PER_KM', 'HOURLY']),
    distanceKm: z.number().positive(t('validation.distancePositive')),
    deadWeightKg: z.number().positive(t('validation.weightPositive')),
    lengthCm: z.number().positive(t('validation.dimensionPositive')),
    widthCm: z.number().positive(t('validation.dimensionPositive')),
    heightCm: z.number().positive(t('validation.dimensionPositive')),
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

  const recommend = useQuery({
    queryKey: ['jobs', 'recommend', deadWeightKg, lengthCm, widthCm, heightCm],
    queryFn: () =>
      recommendVehicle({
        deadWeightKg: Number(deadWeightKg) || 0,
        lengthCm: Number(lengthCm) || 0,
        widthCm: Number(widthCm) || 0,
        heightCm: Number(heightCm) || 0,
      }),
    enabled:
      Number(deadWeightKg) > 0 &&
      Number(lengthCm) > 0 &&
      Number(widthCm) > 0 &&
      Number(heightCm) > 0,
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

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (isEdit && existing.isLoading) return <LoadingBlock label={t('jobs.loadingDetail')} />;
  if (isEdit && (existing.isError || !existing.data)) {
    return <Notice tone="error">{getErrorDetail(existing.error)}</Notice>;
  }

  return (
    <div className="max-w-xl">
      {isEdit ? (
        <Link to={`/jobs/${jobId}`} className="text-sm text-clox-orange hover:underline">
          ← {t('jobs.backToJob')}
        </Link>
      ) : null}
      <h1 className={`font-display text-2xl font-bold text-clox-ink ${isEdit ? 'mt-2' : ''}`}>
        {isEdit ? t('jobs.editTitle') : t('jobs.createTitle')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">
        {isEdit ? t('jobs.editHint') : t('jobs.createHint')}
      </p>
      <form
        className="mt-6"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        noValidate
      >
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
        <Field
          type="number"
          label={t('validation.deadWeightLabel')}
          required
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
        {recommend.data ? (
          <Notice tone="success" className="mb-4">
            {t('jobs.chargeableHint', {
              kg: recommend.data.chargeableWeightKg.toFixed(1),
              vehicleClass: recommend.data.recommendedVehicleClass,
            })}
          </Notice>
        ) : null}
        <label className="mb-4 flex items-center gap-2 text-sm text-clox-mute">
          <input type="checkbox" className="accent-clox-accent" {...form.register('loadDg')} />
          {t('jobs.dgLoad')}
        </label>
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
        <label className="mb-4 flex items-start gap-2 text-sm text-clox-mute">
          <input
            type="checkbox"
            className="mt-1 accent-clox-accent"
            {...form.register('siteDisclaimerAccepted')}
          />
          <span>
            {t('jobs.siteDisclaimer')}
            {form.formState.errors.siteDisclaimerAccepted?.message ? (
              <span className="mt-1 block text-[12px] font-medium text-[var(--status-danger)]" role="alert">
                {form.formState.errors.siteDisclaimerAccepted.message}
              </span>
            ) : null}
          </span>
        </label>
        {save.isError ? (
          <Notice tone="error" className="mb-4">
            {getErrorDetail(save.error)}
          </Notice>
        ) : null}
        <Button type="submit" variant="cta" disabled={save.isPending}>
          {save.isPending
            ? t('saving')
            : isEdit
              ? t('jobs.saveDraft')
              : t('jobs.createDraft')}
        </Button>
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

  const publish = useMutation({
    mutationFn: () => publishJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', id] }),
  });

  const accept = useMutation({
    mutationFn: (proposalId: string) => acceptProposal(id, proposalId),
    onError: (err) => setAcceptMsg(getErrorDetail(err)),
    onSuccess: async (res) => {
      if (res.paidAndConfirmed) {
        setAcceptMsg(
          `${res.mock ? t('jobs.paidAndLockedMock') : t('jobs.paidAndLocked')}${res.idempotentReplay ? ` · ${t('jobs.idempotentReplay')}` : ''}`,
        );
      } else if (res.clientSecret) {
        setAcceptMsg(
          `${t('jobs.scaRequired')}: ${res.clientSecret}${res.publishableKey ? ` · pk=${res.publishableKey}` : ''}`,
        );
      } else {
        setAcceptMsg(
          `${res.message ?? res.paymentStatus}${res.stripeStatus ? ` · ${res.stripeStatus}` : ''}`,
        );
      }
      await qc.invalidateQueries({ queryKey: ['jobs', id] });
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

  return (
    <div>
      <Link to="/jobs" className="text-sm text-clox-orange hover:underline">
        ← {t('jobs.backToJobs')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink">
        {j.title ?? t('jobs.fallbackTitle')}
      </h1>
      <p className="mt-1 font-mono text-sm text-clox-mute">
        {j.status} · {j.pricingModel} · min {j.minVehicleClass} · rec {j.recommendedVehicleClass}
      </p>
      {j.openException ? (
        <Notice tone="warn" className="mt-4" title={t('jobs.exceptionBannerTitle')}>
          <p className="text-sm">
            {j.openException.kind} · {j.openException.phase} · {j.openException.status}
          </p>
          {j.openException.note ? (
            <p className="mt-1 text-xs text-clox-mute">{j.openException.note}</p>
          ) : null}
          <p className="mt-1 text-xs text-clox-faint">{t('jobs.exceptionBannerHint')}</p>
        </Notice>
      ) : null}
      <ul className="mt-4 space-y-1 text-sm text-clox-mute">
        <li>
          {t('jobs.routeLine', {
            distanceKm: j.route.distanceKm ?? t('dash'),
            durationMin: j.route.durationMinutes ?? t('dash'),
          })}
          {j.route.fatigueBreakMinutes > 0
            ? ` ${t('jobs.fatigueBreak', { minutes: j.route.fatigueBreakMinutes })}`
            : ''}
          {j.route.billableHours != null
            ? ` ${t('jobs.billableHours', { hours: j.route.billableHours })}`
            : ''}
        </li>
        <li>
          {t('jobs.chargeableLine', {
            kg: j.chargeableWeightKg,
            requiresDg: String(j.requiresDg),
          })}
        </li>
        <li>
          {t('jobs.estimateLabel')}{' '}
          {j.estimate.incGstCents != null
            ? t('jobs.estimateIncGst', { amount: (j.estimate.incGstCents / 100).toFixed(2) })
            : t('dash')}
        </li>
        {j.assignment ? (
          <li className="text-[var(--status-ok)]">
            Assignment {j.assignment.status}
            {j.assignment.paidAndConfirmed
              ? ` ${t('jobs.assignmentPaid')}`
              : ` ${t('jobs.assignmentPendingPayment')}`}
          </li>
        ) : null}
        {j.payment ? (
          <li className="font-mono text-xs text-clox-mute">
            {t('jobs.paymentLine', {
              status: j.payment.status,
              pi: j.payment.stripePaymentIntentId ?? t('dash'),
            })}
          </li>
        ) : null}
      </ul>

      {j.editability?.mode && j.editability.mode !== 'NONE' ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/jobs/${j.id}/edit`} className="clox-btn clox-btn-secondary inline-flex">
            {j.editability.mode === 'RECEIVER' ? t('jobs.editReceiver') : t('jobs.editJob')}
          </Link>
          {j.status === 'DRAFT' ? (
            <Button
              variant="cta"
              disabled={publish.isPending}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: t('confirm.publishJobTitle'),
                    description: t('confirm.publishJobBody'),
                    confirmLabel: t('jobs.publish'),
                  });
                  if (ok) publish.mutate();
                })();
              }}
            >
              {t('jobs.publish')}
            </Button>
          ) : null}
        </div>
      ) : j.status === 'DRAFT' ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant="cta"
            disabled={publish.isPending}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: t('confirm.publishJobTitle'),
                  description: t('confirm.publishJobBody'),
                  confirmLabel: t('jobs.publish'),
                });
                if (ok) publish.mutate();
              })();
            }}
          >
            {t('jobs.publish')}
          </Button>
        </div>
      ) : null}
      {j.editability?.mode === 'RECEIVER' ? (
        <p className="mt-2 text-xs text-clox-mute">{t('jobs.editReceiverHint')}</p>
      ) : null}

      <h2 className="mt-8 font-display text-lg font-semibold text-clox-ink">
        {t('jobs.proposalsTitle')}
      </h2>
      {(j.proposals ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-clox-faint">{t('jobs.noBidsYet')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {(j.proposals ?? []).map((p) => (
            <li key={p.id} className="clox-card p-4">
              <p className="font-medium text-clox-ink">
                {p.carrierLabel}{' '}
                <span className="font-mono text-xs text-clox-faint">{p.status}</span>
              </p>
              <p className="font-mono text-xs text-clox-mute">
                ${(p.amountIncGstCents / 100).toFixed(2)} · ETA {p.etaMinutes}m · {p.vehicleClass}
              </p>
              {p.status === 'SUBMITTED' && !j.assignment ? (
                <Button
                  variant="secondary"
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
      {openProposals.length === 0 && j.assignment?.paidAndConfirmed ? (
        <div className="mt-4 space-y-2">
          <Notice tone="success">{t('jobs.jobPaidLocked')}</Notice>
          <Link to={`/jobs/${j.id}/track`} className="text-sm text-clox-orange hover:underline">
            {t('jobs.openLiveTrack')}
          </Link>
        </div>
      ) : null}
      {acceptMsg ? (
        <Notice tone="warn" className="mt-4">
          {acceptMsg}
        </Notice>
      ) : null}
    </div>
  );
}
