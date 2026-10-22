import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  addCarrierVehicle,
  confirmCarrierConnect,
  confirmDocument,
  createUploadIntent,
  getCarrierOnboarding,
  getErrorDetail,
  inviteCarrierDriver,
  openDocumentContent,
  resendCarrierDriverInvite,
  setupCarrierConnect,
  submitCarrierVerification,
  updateCarrierCapabilities,
  updateCarrierProfile,
  uploadDocumentContent,
  type CarrierOnboarding,
} from '@/lib/api';
import { Button, Field, Notice, Select, StepChips, useConfirm } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import {
  abnSchema,
  suggestedGvmKgForClass,
  suggestedTareKgForClass,
  VEHICLE_CLASSES,
} from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const STEPS = [
  'profile',
  'documents',
  'connect',
  'vehicles',
  'drivers',
  'capabilities',
  'submit',
  'waiting_ops',
  'complete',
] as const;

type CarrierStepId = (typeof STEPS)[number];

const EDITABLE_STEPS: readonly CarrierStepId[] = [
  'profile',
  'documents',
  'connect',
  'vehicles',
  'drivers',
  'capabilities',
  'submit',
];

const STEP_LABEL_KEYS = {
  profile: 'carrierOnboarding.stepLegal',
  documents: 'carrierOnboarding.stepDocs',
  connect: 'carrierOnboarding.stepConnect',
  vehicles: 'carrierOnboarding.stepFleet',
  drivers: 'carrierOnboarding.stepDrivers',
  capabilities: 'carrierOnboarding.stepCaps',
  submit: 'carrierOnboarding.stepSubmit',
  waiting_ops: 'carrierOnboarding.stepOps',
  complete: 'carrierOnboarding.stepDone',
} as const satisfies Record<CarrierStepId, string>;

function isCarrierStepId(value: string): value is CarrierStepId {
  return (STEPS as readonly string[]).includes(value);
}

export function CarrierOnboardingPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['carrier', 'onboarding'],
    queryFn: () => getCarrierOnboarding(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });
  const [viewStep, setViewStep] = useState<string | null>(null);

  const serverStep = query.data?.step;
  useEffect(() => {
    if (serverStep) setViewStep(serverStep);
  }, [serverStep]);

  if (role !== AppRole.TRANSPORT_COMPANY) {
    return <Navigate to="/" replace />;
  }
  if (query.isLoading) return <LoadingBlock label={t('carrierOnboarding.loading')} />;
  if (query.isError || !query.data) {
    return <Notice tone="error">{getErrorDetail(query.error)}</Notice>;
  }

  const data = query.data;
  const step = viewStep ?? data.step;
  const canEditSteps =
    data.company.status === 'DRAFT' || data.company.status === 'INFO_REQUESTED';
  const serverIdx = STEPS.indexOf(isCarrierStepId(data.step) ? data.step : 'profile');
  const refresh = async () => {
    const result = await qc.fetchQuery({
      queryKey: ['carrier', 'onboarding'],
      queryFn: () => getCarrierOnboarding(),
    });
    return result;
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t('carrierOnboarding.title')}</h1>
      <p className="mt-2 text-sm text-clox-mute">{t('carrierOnboarding.subtitle')}</p>

      <StepChips
        className="mt-4"
        current={step}
        steps={STEPS.map((id) => ({
          id,
          label: t(STEP_LABEL_KEYS[id]),
        }))}
        onStepSelect={canEditSteps ? setViewStep : undefined}
        canSelectStep={(id, index) => {
          if (!canEditSteps) return false;
          if (!EDITABLE_STEPS.includes(id as CarrierStepId)) return false;
          // Completed steps + server current (and any earlier editable revisits).
          return index <= serverIdx || id === data.step;
        }}
      />
      {canEditSteps && step !== data.step ? (
        <p className="mt-2 text-xs text-clox-mute">
          {t('carrierOnboarding.viewingPastStep')}{' '}
          <button
            type="button"
            className="font-semibold text-clox-orange hover:underline"
            onClick={() => setViewStep(data.step)}
          >
            {t('carrierOnboarding.backToCurrentStep')}
          </button>
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-clox-border bg-clox-surface p-3 text-xs text-clox-mute">
        {t('carrierOnboarding.statusStrip', {
          status: data.company.status,
          canBid: String(data.goNoGo.canBid),
        })}
        {data.stripeMock ? ' · ' + t('carrierOnboarding.stripeMock') : ''}
      </div>

      {data.company.status === 'INFO_REQUESTED' ? (
        <Notice tone="warn" className="mt-4">
          {t('carrierOnboarding.opsRequestedInfo', {
            note: data.latestCase?.decisionNote ? `: ${data.latestCase.decisionNote}` : '',
          })}
        </Notice>
      ) : null}

      {step === 'profile' && <ProfileStep data={data} onSaved={refresh} />}
      {step === 'documents' && (
        <DocumentsStep companyId={data.company.id} onSubmitted={refresh} />
      )}
      {step === 'connect' && <ConnectStep mock={data.stripeMock} onDone={refresh} />}
      {step === 'vehicles' && <VehiclesStep data={data} onSaved={refresh} />}
      {step === 'drivers' && <DriversStep data={data} onSaved={refresh} />}
      {step === 'capabilities' && (
        <CapabilitiesStep
          data={data}
          onSaved={async (next) => {
            const fresh = next ?? (await refresh());
            if (fresh.step) setViewStep(fresh.step);
          }}
        />
      )}
      {step === 'submit' && <SubmitStep data={data} onSubmitted={refresh} />}
      {step === 'waiting_ops' && (
        <Notice tone="warn" className="mt-8" title={t('waitingForOps')}>
          <p>
            {t('carrierOnboarding.waitingOpsBody', {
              status: data.latestCase?.status ?? 'OPEN',
            })}
            {data.latestCase?.decisionNote
              ? ' ' + t('carrierOnboarding.notePrefix', { note: data.latestCase.decisionNote })
              : ''}
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => void query.refetch()}>
            {t('refreshStatus')}
          </Button>
        </Notice>
      )}
      {step === 'rejected' && (
        <Notice tone="error" className="mt-8">
          {t('applicationRejected')} {data.latestCase?.decisionNote}
        </Notice>
      )}
      {step === 'complete' && (
        <Notice
          tone={data.goNoGo.canBid ? 'success' : 'warn'}
          className="mt-8"
          title={
            data.goNoGo.canBid
              ? t('carrierOnboarding.bidEligibleTitle')
              : t('carrierOnboarding.opsApprovedNotBiddingTitle')
          }
        >
          {data.goNoGo.canBid ? (
            <p>{data.goNoGo.netPayoutHint}</p>
          ) : (
            <p>{t('carrierOnboarding.opsApprovedNotBiddingBody')}</p>
          )}
          <ul className="mt-3 space-y-1 text-xs">
            <li>{t('carrierOnboarding.goNoGoOps', { value: String(data.goNoGo.opsApproved) })}</li>
            <li>{t('carrierOnboarding.goNoGoConnect', { value: String(data.goNoGo.connectReady) })}</li>
            <li>{t('carrierOnboarding.goNoGoFleet', { value: String(data.goNoGo.fleetReady) })}</li>
            <li>{t('carrierOnboarding.goNoGoCanBid', { value: String(data.goNoGo.canBid) })}</li>
          </ul>
          <p className="mt-3 text-sm">{t('carrierOnboarding.manageFleetHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/carrier/fleet"
              className={
                data.goNoGo.canBid
                  ? 'clox-btn clox-btn-secondary inline-flex items-center text-sm'
                  : 'clox-btn clox-btn-cta inline-flex items-center text-sm'
              }
            >
              {t('carrierOnboarding.manageFleetCta')}
            </Link>
            <Link
              to="/carrier/drivers"
              className="clox-btn clox-btn-secondary inline-flex items-center text-sm"
            >
              {t('carrierOnboarding.manageDriversCta')}
            </Link>
            {data.goNoGo.canBid ? (
              <Link to="/market" className="clox-btn clox-btn-cta inline-flex items-center text-sm">
                {t('nav.jobBoard')}
              </Link>
            ) : null}
          </div>
        </Notice>
      )}

      <p className="mt-8 text-sm text-clox-faint">
        <Link to="/" className="text-clox-orange hover:underline">
          {t('nav.home')}
        </Link>
      </p>
    </div>
  );
}

type CarrierProfileForm = { legalName: string; abn: string };

function ProfileStep({ data, onSaved }: { data: CarrierOnboarding; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const schema = z.object({
    legalName: z.string().trim().min(1, t('validation.legalNameRequired')),
    abn: abnSchema(t('validation.abnRequired'), t('validation.abnInvalid')),
  });
  const form = useForm<CarrierProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: data.company.legalName || '',
      abn: data.company.abn || '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: CarrierProfileForm) =>
      updateCarrierProfile({
        legalName: values.legalName,
        abn: values.abn,
        homeRegionCode: 'VIC',
      }),
    onSuccess: () => onSaved(),
  });
  return (
    <form
      className="mt-8"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <h2 className="mb-4 font-display text-lg font-semibold">{t('carrierOnboarding.profileTitle')}</h2>
      <Field
        label={t('legalName')}
        required
        error={form.formState.errors.legalName?.message}
        {...form.register('legalName')}
      />
      <Field
        label={t('abn')}
        required
        inputMode="numeric"
        error={form.formState.errors.abn?.message}
        {...form.register('abn')}
      />
      {mutation.isError ? (
        <Notice tone="error" className="mb-4">
          {getErrorDetail(mutation.error)}
        </Notice>
      ) : null}
      <Button type="submit" variant="cta" disabled={mutation.isPending}>
        {mutation.isPending ? t('saving') : t('saveAndContinue')}
      </Button>
    </form>
  );
}

function DocumentsStep({ companyId, onSubmitted }: { companyId: string; onSubmitted: () => Promise<void> }) {
  const { t } = useTranslation();
  const [plId, setPlId] = useState<string | null>(null);
  const [cargoId, setCargoId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(docType: 'PUBLIC_LIABILITY' | 'CARGO_INSURANCE', file: File) {
    const mime = (file.type || 'application/pdf') as
      | 'application/pdf'
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp';
    const intent = await createUploadIntent({
      companyId,
      docType,
      originalFilename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
    });
    const up = await uploadDocumentContent(intent.id, file);
    await confirmDocument(intent.id, up.contentHash);
    return intent.id;
  }

  const uploadPl = useMutation({
    mutationFn: async (file: File) => upload('PUBLIC_LIABILITY', file),
    onSuccess: (id) => {
      setPlId(id);
      setMessage(t('carrierOnboarding.publicLiabilityUploaded'));
    },
  });
  const uploadCargo = useMutation({
    mutationFn: async (file: File) => upload('CARGO_INSURANCE', file),
    onSuccess: (id) => {
      setCargoId(id);
      setMessage(t('carrierOnboarding.cargoInsuranceUploaded'));
    },
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.docsTitle')}</h2>
      <p className="text-sm text-clox-mute">
        {t('carrierOnboarding.docsRequired', {
          docType: 'PUBLIC_LIABILITY + CARGO_INSURANCE',
        })}
      </p>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.docsRwcFleetHint')}</p>
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.publicLiability')}</p>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPl.mutate(f);
          }}
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.cargoInsurance')}</p>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadCargo.mutate(f);
          }}
        />
      </div>
      {message ? <Notice tone="success">{message}</Notice> : null}
      {(uploadPl.isError || uploadCargo.isError) && (
        <Notice tone="error">
          {getErrorDetail(uploadPl.error ?? uploadCargo.error)}
        </Notice>
      )}
      <Button
        variant="cta"
        disabled={!plId || !cargoId}
        onClick={() => void onSubmitted()}
      >
        {t('carrierOnboarding.continueDocsSaved')}
      </Button>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.docsSavedHint')}</p>
    </div>
  );
}

function ConnectStep({ mock, onDone }: { mock: boolean; onDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<string | null>(null);
  const setup = useMutation({
    mutationFn: () => setupCarrierConnect(),
    onSuccess: (data) => {
      setInfo(
        data.mock
          ? t('carrierOnboarding.mockConnect', { accountId: data.accountId })
          : t('carrierOnboarding.openOnboarding', { url: data.url }),
      );
      if (!data.mock && data.url) window.open(data.url, '_blank');
    },
  });
  const confirm = useMutation({
    mutationFn: () => confirmCarrierConnect(),
    onSuccess: () => onDone(),
  });
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.connectTitle')}</h2>
      <p className="text-sm text-clox-mute">
        {mock
          ? t('carrierOnboarding.connectMockHint')
          : t('carrierOnboarding.connectLiveHint')}
      </p>
      {(setup.isError || confirm.isError) && (
        <Notice tone="error">{getErrorDetail(setup.error ?? confirm.error)}</Notice>
      )}
      {info ? <Notice tone="success">{info}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={setup.isPending} onClick={() => setup.mutate()}>
          {t('carrierOnboarding.createConnectAccount')}
        </Button>
        <Button variant="cta" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
          {t('carrierOnboarding.confirmPayoutsReady')}
        </Button>
      </div>
    </div>
  );
}

type VehicleForm = {
  label: string;
  registration: string;
  vehicleClass: (typeof VEHICLE_CLASSES)[number];
  tareKg: number;
  gvmKg: number;
};

function VehiclesStep({ data, onSaved }: { data: CarrierOnboarding; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [rwcMsg, setRwcMsg] = useState<string | null>(null);
  const [rwcFile, setRwcFile] = useState<File | null>(null);
  const [rwcFormError, setRwcFormError] = useState<string | null>(null);
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
      label: 'Primary truck',
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

  async function uploadRwcForVehicle(vehicleId: string, file: File) {
    const mime = (file.type || 'application/pdf') as
      | 'application/pdf'
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp';
    const intent = await createUploadIntent({
      companyId: data.company.id,
      docType: 'RWC',
      originalFilename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      vehicleId,
    });
    const up = await uploadDocumentContent(intent.id, file);
    await confirmDocument(intent.id, up.contentHash);
  }

  const mutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!rwcFile) {
        throw new Error(t('fleet.rwcRequiredError'));
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
      await uploadRwcForVehicle(created.id, rwcFile);
      return onboarding;
    },
    onSuccess: async () => {
      form.reset({
        label: 'Primary truck',
        registration: '',
        vehicleClass: 'RIGID_1_2T',
        tareKg: suggestedTareKgForClass('RIGID_1_2T'),
        gvmKg: suggestedGvmKgForClass('RIGID_1_2T'),
      });
      setRwcFile(null);
      setRwcFormError(null);
      setRwcMsg(t('carrierOnboarding.rwcUploaded'));
      await onSaved();
    },
    onError: (error) => setRwcFormError(getErrorDetail(error)),
  });

  const activeVehicles = data.vehicles.filter((v) => v.status === 'ACTIVE');
  const allActiveHaveRwc =
    activeVehicles.length > 0 && activeVehicles.every((v) => Boolean(v.hasRwc));

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.fleetTitle')}</h2>
      <p className="text-sm text-clox-mute">{t('carrierOnboarding.fleetRwcHint')}</p>
      {data.vehicles.length > 0 ? (
        <ul className="space-y-2 text-sm text-clox-mute">
          {data.vehicles.map((v) => (
            <li key={v.id} className="rounded-xl border border-clox-border p-3">
              <p className="font-mono text-xs">
                {v.registration} · {v.vehicleClass} · {v.label}
                {v.hasRwc ? ` · ${t('carrierOnboarding.rwcOnFile')}` : ''}
              </p>
              {v.hasRwc && v.rwcDocumentId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    void openDocumentContent(v.rwcDocumentId!).catch((err) =>
                      setRwcFormError(getErrorDetail(err)),
                    );
                  }}
                >
                  {t('fleet.rwcView')}
                </Button>
              ) : null}
              {!v.hasRwc ? (
                <label className="mt-2 block text-xs text-clox-faint">
                  {t('carrierOnboarding.rwc')} ({t('carrierOnboarding.rwcPerVehicle')})
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="mt-1 block"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void uploadRwcForVehicle(v.id, f)
                        .then(async () => {
                          setRwcMsg(t('carrierOnboarding.rwcUploaded'));
                          await onSaved();
                        })
                        .catch((err) => setRwcFormError(getErrorDetail(err)));
                    }}
                  />
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {rwcMsg ? (
        <Notice tone="success">{rwcMsg}</Notice>
      ) : null}
      {activeVehicles.length > 0 && !allActiveHaveRwc ? (
        <Notice tone="warn">{t('carrierOnboarding.fleetRwcRequired')}</Notice>
      ) : null}
      <form
        className="space-y-0"
        onSubmit={form.handleSubmit((values) => {
          if (!rwcFile) {
            setRwcFormError(t('fleet.rwcRequiredError'));
            return;
          }
          setRwcFormError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        <Field
          label={t('carrierOnboarding.placeholderLabel')}
          required
          error={form.formState.errors.label?.message}
          {...form.register('label')}
        />
        <Field
          label={t('carrierOnboarding.placeholderRegistration')}
          required
          error={form.formState.errors.registration?.message}
          {...form.register('registration')}
        />
        <Select
          label={t('validation.vehicleClassLabel')}
          required
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
          required
          error={form.formState.errors.gvmKg?.message}
          {...form.register('gvmKg', { valueAsNumber: true })}
        />
        <Field
          type="number"
          label={t('fleet.tareKgLabel')}
          hint={t('fleet.tareKgHint')}
          required
          error={form.formState.errors.tareKg?.message}
          {...form.register('tareKg', { valueAsNumber: true })}
        />
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold text-clox-ink">
            {t('fleet.rwcLabel')}{' '}
            <span className="text-[var(--status-danger)]">*</span>
          </p>
          <p className="mb-2 text-xs text-clox-faint">{t('fleet.rwcHint')}</p>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              setRwcFile(e.target.files?.[0] ?? null);
              setRwcFormError(null);
            }}
          />
          {rwcFile ? <p className="mt-1 text-xs text-clox-mute">{rwcFile.name}</p> : null}
        </div>
        {rwcFormError || mutation.isError ? (
          <Notice tone="error" className="mb-4">
            {rwcFormError ?? getErrorDetail(mutation.error)}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="cta" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('carrierOnboarding.addVehicle')}
          </Button>
          {allActiveHaveRwc ? (
            <Button type="button" variant="secondary" onClick={() => void onSaved()}>
              {t('continue')}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

type DriverInviteForm = { name: string; email: string };

function DriversStep({ data, onSaved }: { data: CarrierOnboarding; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [lastInvite, setLastInvite] = useState<{
    inviteUrl: string;
    debugToken?: string;
    mailSkipped: boolean;
  } | null>(null);
  const schema = z.object({
    name: z.string().trim().min(1, t('validation.driverNameRequired')),
    email: z
      .string()
      .trim()
      .min(1, t('validation.driverEmailRequired'))
      .email(t('validation.emailInvalid')),
  });
  const form = useForm<DriverInviteForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: DriverInviteForm) =>
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
      await onSaved();
    },
  });
  const resend = useMutation({
    mutationFn: (driverId: string) => resendCarrierDriverInvite(driverId),
    onSuccess: (res) => {
      setLastInvite({
        inviteUrl: res.inviteUrl,
        debugToken: res.debugToken,
        mailSkipped: res.mailSkipped,
      });
    },
  });
  const inviting = mutation.isPending;
  const busy = inviting || resend.isPending;
  return (
    <div className="relative mt-8 space-y-4" aria-busy={busy || undefined}>
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
      <h2 className="font-display text-lg font-semibold">{t('carrierOnboarding.driversTitle')}</h2>
      <p className="text-sm text-clox-mute">{t('carrierOnboarding.driversHint')}</p>
      {data.drivers.length > 0 ? (
        <ul className="space-y-2 text-sm text-clox-mute">
          {data.drivers.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span>
                {d.email} · {d.status}
              </span>
              {d.status === 'INVITED' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => resend.mutate(d.id)}
                >
                  {t('carrierOnboarding.resend')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        onSubmit={form.handleSubmit((values) => {
          if (busy) return;
          mutation.mutate(values);
        })}
        noValidate
      >
        <fieldset disabled={busy} className="min-w-0 border-0 p-0">
          <Field
            label={t('carrierOnboarding.placeholderDriverName')}
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Field
            type="email"
            label={t('carrierOnboarding.placeholderDriverEmail')}
            required
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          {mutation.isError ? (
            <Notice tone="error" className="mb-4">
              {getErrorDetail(mutation.error)}
            </Notice>
          ) : null}
          {resend.isError ? (
            <Notice tone="error" className="mb-4">
              {getErrorDetail(resend.error)}
            </Notice>
          ) : null}
          {lastInvite ? (
            <Notice tone="info" className="mb-4" title={t('carrierOnboarding.inviteUrlLabel')}>
              <a className="break-all text-clox-orange underline" href={lastInvite.inviteUrl}>
                {lastInvite.inviteUrl}
              </a>
              {lastInvite.mailSkipped && lastInvite.debugToken ? (
                <p className="mt-2">
                  {t('carrierOnboarding.smtpSkippedDebugToken', { token: lastInvite.debugToken })}
                </p>
              ) : null}
            </Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="cta" disabled={busy}>
              {inviting ? t('drivers.inviting') : t('carrierOnboarding.inviteDriver')}
            </Button>
            {data.drivers.length >= 1 ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void onSaved()}>
                {t('continue')}
              </Button>
            ) : null}
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function CapabilitiesStep({
  data,
  onSaved,
}: {
  data: CarrierOnboarding;
  onSaved: (next?: CarrierOnboarding) => Promise<void>;
}) {
  const { t } = useTranslation();
  const existingDg = (data.uploadedDocs ?? []).find(
    (d) =>
      d.docType === 'DG_LICENCE' &&
      !d.vehicleId &&
      (d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW' || d.status === 'APPROVED'),
  );
  const [dg, setDg] = useState(data.company.capabilities.includes('DG'));
  const [reefer, setReefer] = useState(data.company.capabilities.includes('REEFER'));
  const [oversize, setOversize] = useState(data.company.capabilities.includes('OVERSIZE'));
  const [tailLift, setTailLift] = useState(
    data.company.capabilities.length === 0 || data.company.capabilities.includes('TAIL_LIFT'),
  );
  const [dgDocId, setDgDocId] = useState<string | null>(existingDg?.id ?? null);
  const [dgMsg, setDgMsg] = useState<string | null>(
    existingDg ? t('carrierOnboarding.dgLicenceUploaded') : null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function uploadDgLicence(file: File) {
    const mime = (file.type || 'application/pdf') as
      | 'application/pdf'
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp';
    const intent = await createUploadIntent({
      companyId: data.company.id,
      docType: 'DG_LICENCE',
      originalFilename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
    });
    const up = await uploadDocumentContent(intent.id, file);
    await confirmDocument(intent.id, up.contentHash);
    return intent.id;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (dg && !dgDocId) {
        throw new Error(t('carrierOnboarding.dgLicenceRequired'));
      }
      const capabilities = [
        ...(dg ? (['DG'] as const) : []),
        ...(reefer ? (['REEFER'] as const) : []),
        ...(oversize ? (['OVERSIZE'] as const) : []),
        ...(tailLift ? (['TAIL_LIFT'] as const) : []),
      ];
      return updateCarrierCapabilities({
        capabilities,
        serviceRegionCodes: ['VIC'],
      });
    },
    onSuccess: async (next) => {
      setFormError(null);
      setDgMsg(t('carrierOnboarding.capabilitiesSaved'));
      await onSaved(next);
    },
    onError: (error) => setFormError(getErrorDetail(error)),
  });

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (dg && !dgDocId) {
          setFormError(t('carrierOnboarding.dgLicenceRequired'));
          return;
        }
        setFormError(null);
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.capabilitiesTitle')}</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tailLift} onChange={(e) => setTailLift(e.target.checked)} />
        {t('carrierOnboarding.capTailLift')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reefer} onChange={(e) => setReefer(e.target.checked)} />
        {t('carrierOnboarding.capReefer')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dg}
          onChange={(e) => {
            setDg(e.target.checked);
            setFormError(null);
          }}
        />
        {t('carrierOnboarding.capDangerousGoods')}
      </label>
      {dg ? (
        <div className="rounded-xl border border-clox-border p-3">
          <p className="text-xs font-semibold text-clox-ink">
            {t('carrierOnboarding.dgLicenceLabel')}{' '}
            <span className="text-[var(--status-danger)]">*</span>
          </p>
          <p className="mt-1 text-xs text-clox-faint">{t('carrierOnboarding.dgLicenceHint')}</p>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="mt-2 block"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void uploadDgLicence(f)
                .then((id) => {
                  setDgDocId(id);
                  setDgMsg(t('carrierOnboarding.dgLicenceUploaded'));
                  setFormError(null);
                })
                .catch((err) => setFormError(getErrorDetail(err)));
            }}
          />
          {dgDocId ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                void openDocumentContent(dgDocId).catch((err) =>
                  setFormError(getErrorDetail(err)),
                );
              }}
            >
              {t('compliance.viewDocument')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={oversize} onChange={(e) => setOversize(e.target.checked)} />
        {t('carrierOnboarding.capOversize')}
      </label>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.serviceRegionVic')}</p>
      {dgMsg ? <Notice tone="success">{dgMsg}</Notice> : null}
      {formError || mutation.isError ? (
        <Notice tone="error">{formError ?? getErrorDetail(mutation.error)}</Notice>
      ) : null}
      <Button type="submit" variant="cta" disabled={mutation.isPending || (dg && !dgDocId)}>
        {mutation.isPending ? t('saving') : t('saveAndContinue')}
      </Button>
    </form>
  );
}

function pickLatestDoc(
  docs: Array<{ id: string; docType: string; status: string }>,
  docType: string,
) {
  const matches = docs.filter((d) => d.docType === docType);
  return (
    matches.find((d) => d.status === 'UPLOADED') ??
    matches.find((d) => d.status === 'UNDER_REVIEW') ??
    matches[0]
  );
}

function SubmitStep({
  data,
  onSubmitted,
}: {
  data: CarrierOnboarding;
  onSubmitted: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const isInfoRequested = data.company.status === 'INFO_REQUESTED';
  const existing = data.uploadedDocs ?? [];
  const pl = pickLatestDoc(
    existing.filter((d) => !d.vehicleId),
    'PUBLIC_LIABILITY',
  );
  const cargo = pickLatestDoc(
    existing.filter((d) => !d.vehicleId),
    'CARGO_INSURANCE',
  );
  const [plId, setPlId] = useState<string | null>(pl?.id ?? null);
  const [cargoId, setCargoId] = useState<string | null>(cargo?.id ?? null);
  const [msg, setMsg] = useState<string | null>(
    pl && cargo ? t('carrierOnboarding.usingPreviousUploads') : null,
  );

  async function upload(docType: 'PUBLIC_LIABILITY' | 'CARGO_INSURANCE', file: File) {
    const mime = (file.type || 'application/pdf') as
      | 'application/pdf'
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp';
    const intent = await createUploadIntent({
      companyId: data.company.id,
      docType,
      originalFilename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
    });
    const up = await uploadDocumentContent(intent.id, file);
    await confirmDocument(intent.id, up.contentHash);
    return intent.id;
  }

  const submit = useMutation({
    mutationFn: () => {
      if (!plId || !cargoId) {
        throw new Error(t('carrierOnboarding.errorUploadPlCargo'));
      }
      return submitCarrierVerification([plId, cargoId]);
    },
    onSuccess: () => onSubmitted(),
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">
        {isInfoRequested
          ? t('carrierOnboarding.resubmitTitle')
          : t('carrierOnboarding.submitTitle')}
      </h2>
      <p className="text-sm text-clox-mute">
        {isInfoRequested
          ? t('carrierOnboarding.resubmitHint')
          : t('carrierOnboarding.submitHint')}
      </p>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.submitRwcFleetNote')}</p>
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.publicLiability')}</p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setPlId(await upload('PUBLIC_LIABILITY', f));
              setMsg(t('carrierOnboarding.plUploaded'));
            } catch (err) {
              setMsg(getErrorDetail(err));
            }
          }}
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.cargoInsurance')}</p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setCargoId(await upload('CARGO_INSURANCE', f));
              setMsg(t('carrierOnboarding.cargoUploaded'));
            } catch (err) {
              setMsg(getErrorDetail(err));
            }
          }}
        />
      </div>
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {submit.isError ? (
        <Notice tone="error">{getErrorDetail(submit.error)}</Notice>
      ) : null}
      <Button
        variant="cta"
        disabled={!plId || !cargoId || submit.isPending}
        onClick={() => {
          void (async () => {
            const ok = await confirm({
              title: t('confirm.submitComplianceTitle'),
              description: t('confirm.submitComplianceBody'),
              confirmLabel: isInfoRequested
                ? t('carrierOnboarding.resubmitComplianceCase')
                : t('carrierOnboarding.submitComplianceCase'),
            });
            if (ok) submit.mutate();
          })();
        }}
      >
        {submit.isPending
          ? t('submitting')
          : isInfoRequested
            ? t('carrierOnboarding.resubmitComplianceCase')
            : t('carrierOnboarding.submitComplianceCase')}
      </Button>
    </div>
  );
}
