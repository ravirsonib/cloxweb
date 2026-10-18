import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  resendCarrierDriverInvite,
  setupCarrierConnect,
  submitCarrierVerification,
  updateCarrierCapabilities,
  updateCarrierProfile,
  uploadDocumentContent,
  type CarrierOnboarding,
} from '@/lib/api';
import { Button, Field, Notice, Select, StepChips } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { abnSchema, VEHICLE_CLASSES } from '@/lib/validation';
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
} as const satisfies Record<(typeof STEPS)[number], string>;

export function CarrierOnboardingPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['carrier', 'onboarding'],
    queryFn: () => getCarrierOnboarding(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  if (role !== AppRole.TRANSPORT_COMPANY) {
    return <Navigate to="/" replace />;
  }
  if (query.isLoading) return <LoadingBlock label={t('carrierOnboarding.loading')} />;
  if (query.isError || !query.data) {
    return <Notice tone="error">{getErrorDetail(query.error)}</Notice>;
  }

  const data = query.data;
  const step = data.step;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['carrier', 'onboarding'] });
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
      />

      <div className="mt-4 rounded-xl border border-clox-border bg-clox-surface p-3 text-xs text-clox-mute">
        {t('carrierOnboarding.statusStrip', {
          status: data.company.status,
          canBid: String(data.goNoGo.canBid),
        })}
        {data.stripeMock ? ' · ' + t('carrierOnboarding.stripeMock') : ''}
      </div>

      {step === 'profile' && <ProfileStep data={data} onSaved={refresh} />}
      {step === 'documents' && (
        <DocumentsStep companyId={data.company.id} onSubmitted={refresh} />
      )}
      {step === 'connect' && <ConnectStep mock={data.stripeMock} onDone={refresh} />}
      {step === 'vehicles' && <VehiclesStep data={data} onSaved={refresh} />}
      {step === 'drivers' && <DriversStep data={data} onSaved={refresh} />}
      {step === 'capabilities' && <CapabilitiesStep data={data} onSaved={refresh} />}
      {step === 'submit' && <SubmitStep data={data} onSubmitted={refresh} />}
      {step === 'waiting_ops' && (
        <Notice tone="warn" className="mt-8" title={t('waitingForOps')}>
          <p>{t('carrierOnboarding.waitingOpsBody', { status: data.latestCase?.status ?? 'OPEN' })}</p>
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
        <Notice tone="success" className="mt-8" title={t('carrierOnboarding.bidEligibleTitle')}>
          <p>{data.goNoGo.netPayoutHint}</p>
          <ul className="mt-3 space-y-1 text-xs">
            <li>{t('carrierOnboarding.goNoGoOps', { value: String(data.goNoGo.opsApproved) })}</li>
            <li>{t('carrierOnboarding.goNoGoConnect', { value: String(data.goNoGo.connectReady) })}</li>
            <li>{t('carrierOnboarding.goNoGoFleet', { value: String(data.goNoGo.fleetReady) })}</li>
            <li>{t('carrierOnboarding.goNoGoCanBid', { value: String(data.goNoGo.canBid) })}</li>
          </ul>
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
  const [rwcId, setRwcId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(
    docType: 'PUBLIC_LIABILITY' | 'CARGO_INSURANCE' | 'RWC',
    file: File,
  ) {
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
  const uploadRwc = useMutation({
    mutationFn: async (file: File) => upload('RWC', file),
    onSuccess: (id) => {
      setRwcId(id);
      setMessage(t('carrierOnboarding.rwcUploaded'));
    },
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.docsTitle')}</h2>
      <p className="text-sm text-clox-mute">
        {t('carrierOnboarding.docsRequired', {
          docType: 'PUBLIC_LIABILITY + CARGO_INSURANCE + RWC',
        })}
      </p>
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
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.rwc')}</p>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadRwc.mutate(f);
          }}
        />
      </div>
      {message ? <Notice tone="success">{message}</Notice> : null}
      {(uploadPl.isError || uploadCargo.isError || uploadRwc.isError) && (
        <Notice tone="error">
          {getErrorDetail(uploadPl.error ?? uploadCargo.error ?? uploadRwc.error)}
        </Notice>
      )}
      <Button
        variant="cta"
        disabled={!plId || !cargoId || !rwcId}
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
};

function VehiclesStep({ data, onSaved }: { data: CarrierOnboarding; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [rwcMsg, setRwcMsg] = useState<string | null>(null);
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
      label: 'Primary truck',
      registration: '',
      vehicleClass: 'RIGID_1_2T',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: VehicleForm) =>
      addCarrierVehicle({
        label: values.label,
        registration: values.registration,
        vehicleClass: values.vehicleClass,
        tareKg: 3500,
        gvmKg: 8000,
      }),
    onSuccess: async () => {
      form.reset({
        label: 'Primary truck',
        registration: '',
        vehicleClass: 'RIGID_1_2T',
      });
      await onSaved();
    },
  });

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
    setRwcMsg(t('carrierOnboarding.rwcUploaded'));
    await onSaved();
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.fleetTitle')}</h2>
      {data.vehicles.length > 0 ? (
        <ul className="space-y-2 text-sm text-clox-mute">
          {data.vehicles.map((v) => (
            <li key={v.id} className="rounded-xl border border-clox-border p-3">
              <p className="font-mono text-xs">
                {v.registration} · {v.vehicleClass} · {v.label}
              </p>
              <label className="mt-2 block text-xs text-clox-faint">
                {t('carrierOnboarding.rwc')} (vehicle)
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="mt-1 block"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadRwcForVehicle(v.id, f);
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {rwcMsg ? (
        <Notice tone="success">{rwcMsg}</Notice>
      ) : null}
      <form
        className="space-y-0"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
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
        {mutation.isError ? (
          <Notice tone="error" className="mb-4">
            {getErrorDetail(mutation.error)}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="cta" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('carrierOnboarding.addVehicle')}
          </Button>
          {data.vehicles.length >= 1 ? (
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
  return (
    <div className="mt-8 space-y-4">
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
                  disabled={resend.isPending}
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
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
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
          <Button type="submit" variant="cta" disabled={mutation.isPending}>
            {mutation.isPending ? t('submitting') : t('carrierOnboarding.inviteDriver')}
          </Button>
          {data.drivers.length >= 1 ? (
            <Button type="button" variant="secondary" onClick={() => void onSaved()}>
              {t('continue')}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function CapabilitiesStep({ data, onSaved }: { data: CarrierOnboarding; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [dg, setDg] = useState(data.company.capabilities.includes('DG'));
  const [reefer, setReefer] = useState(data.company.capabilities.includes('REEFER'));
  const [oversize, setOversize] = useState(data.company.capabilities.includes('OVERSIZE'));
  const [tailLift, setTailLift] = useState(
    data.company.capabilities.length === 0 || data.company.capabilities.includes('TAIL_LIFT'),
  );
  const mutation = useMutation({
    mutationFn: () => {
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
    onSuccess: () => onSaved(),
  });
  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
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
        <input type="checkbox" checked={dg} onChange={(e) => setDg(e.target.checked)} />
        {t('carrierOnboarding.capDangerousGoods')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={oversize} onChange={(e) => setOversize(e.target.checked)} />
        {t('carrierOnboarding.capOversize')}
      </label>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.serviceRegionVic')}</p>
      {mutation.isError ? (
        <Notice tone="error">{getErrorDetail(mutation.error)}</Notice>
      ) : null}
      <Button type="submit" variant="cta" disabled={mutation.isPending}>
        {mutation.isPending ? t('saving') : t('saveAndContinue')}
      </Button>
    </form>
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
  const existing = data.uploadedDocs ?? [];
  const pl = existing.find((d) => d.docType === 'PUBLIC_LIABILITY');
  const cargo = existing.find((d) => d.docType === 'CARGO_INSURANCE');
  const rwc = existing.find((d) => d.docType === 'RWC');
  const [plId, setPlId] = useState<string | null>(pl?.id ?? null);
  const [cargoId, setCargoId] = useState<string | null>(cargo?.id ?? null);
  const [rwcId, setRwcId] = useState<string | null>(rwc?.id ?? null);
  const [msg, setMsg] = useState<string | null>(
    pl && cargo && rwc ? t('carrierOnboarding.usingPreviousUploads') : null,
  );

  async function upload(
    docType: 'PUBLIC_LIABILITY' | 'CARGO_INSURANCE' | 'RWC',
    file: File,
  ) {
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
      if (!plId || !cargoId || !rwcId) {
        throw new Error(t('carrierOnboarding.errorUploadPlCargoRwc'));
      }
      return submitCarrierVerification([plId, cargoId, rwcId]);
    },
    onSuccess: () => onSubmitted(),
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('carrierOnboarding.submitTitle')}</h2>
      <p className="text-sm text-clox-mute">{t('carrierOnboarding.submitHint')}</p>
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
      <div>
        <p className="mb-1 text-xs text-clox-faint">{t('carrierOnboarding.rwc')}</p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setRwcId(await upload('RWC', f));
              setMsg(t('carrierOnboarding.rwcUploaded'));
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
        disabled={!plId || !cargoId || !rwcId || submit.isPending}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? t('submitting') : t('carrierOnboarding.submitComplianceCase')}
      </Button>
    </div>
  );
}
