import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
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
import {
  Button,
  ChoiceCheck,
  Field,
  FileInput,
  Notice,
  Select,
  StepChips,
  useConfirm,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { resolveUploadMime } from '@/lib/upload-mime';
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
  // Seed once only — do not yank the user off Fleet after RWC upload when the
  // server step advances; steps call setViewStep explicitly on Continue.
  useEffect(() => {
    if (serverStep) setViewStep((prev) => prev ?? serverStep);
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
  const refreshAndGo = async () => {
    const fresh = await refresh();
    if (fresh?.step) setViewStep(fresh.step);
    return fresh;
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
          const connectIdx = STEPS.indexOf('connect');
          // Fleet and later stay locked until Stripe payouts are confirmed in DB.
          // Prevents skipping Payouts via step chips while Continue is still pending.
          if (
            index > connectIdx &&
            !data.company.stripeConnectPayoutsEnabled
          ) {
            return false;
          }
          // Completed steps + server current only (never ahead of server).
          return index <= serverIdx;
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

      {step === 'profile' && <ProfileStep data={data} onSaved={refreshAndGo} />}
      {step === 'documents' && (
        <DocumentsStep
          companyId={data.company.id}
          uploadedDocs={data.uploadedDocs}
          onUploaded={refresh}
          onSubmitted={refreshAndGo}
        />
      )}
      {step === 'connect' && (
        <ConnectStep
          companyId={data.company.id}
          mock={data.stripeMock}
          hasConnectAccount={Boolean(data.company.stripeConnectAccountId)}
          payoutsEnabled={data.company.stripeConnectPayoutsEnabled}
          onDone={refreshAndGo}
        />
      )}
      {step === 'vehicles' && (
        <VehiclesStep
          data={data}
          onSaved={refresh}
          onContinue={refreshAndGo}
        />
      )}
      {step === 'drivers' && <DriversStep data={data} onSaved={refreshAndGo} />}
      {step === 'capabilities' && (
        <CapabilitiesStep
          data={data}
          onSaved={async (next) => {
            if (next) {
              qc.setQueryData(['carrier', 'onboarding'], next);
            }
            const fresh = next ?? (await refresh());
            if (fresh?.step) setViewStep(fresh.step);
          }}
        />
      )}
      {step === 'submit' && <SubmitStep data={data} onSubmitted={refreshAndGo} />}
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

function ProfileStep({
  data,
  onSaved,
}: {
  data: CarrierOnboarding;
  onSaved: () => Promise<CarrierOnboarding | void>;
}) {
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
  useEffect(() => {
    form.reset({
      legalName: data.company.legalName || '',
      abn: data.company.abn || '',
    });
  }, [data.company.legalName, data.company.abn, form]);
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

function pickCompanyDoc(
  docs: NonNullable<CarrierOnboarding['uploadedDocs']> | undefined,
  docType: string,
) {
  const matches = (docs ?? []).filter((d) => d.docType === docType && !d.vehicleId);
  return (
    matches.find((d) => d.status === 'UPLOADED') ??
    matches.find((d) => d.status === 'UNDER_REVIEW') ??
    matches.find((d) => d.status === 'APPROVED') ??
    matches[0]
  );
}

function DocumentsStep({
  companyId,
  uploadedDocs,
  onUploaded,
  onSubmitted,
}: {
  companyId: string;
  uploadedDocs?: CarrierOnboarding['uploadedDocs'];
  onUploaded: () => Promise<CarrierOnboarding | void>;
  onSubmitted: () => Promise<CarrierOnboarding | void>;
}) {
  const { t } = useTranslation();
  const existingPl = pickCompanyDoc(uploadedDocs, 'PUBLIC_LIABILITY');
  const existingCargo = pickCompanyDoc(uploadedDocs, 'CARGO_INSURANCE');
  const [plId, setPlId] = useState<string | null>(existingPl?.id ?? null);
  const [cargoId, setCargoId] = useState<string | null>(existingCargo?.id ?? null);
  const [message, setMessage] = useState<string | null>(
    existingPl && existingCargo ? t('carrierOnboarding.usingPreviousUploads') : null,
  );

  useEffect(() => {
    const pl = pickCompanyDoc(uploadedDocs, 'PUBLIC_LIABILITY');
    const cargo = pickCompanyDoc(uploadedDocs, 'CARGO_INSURANCE');
    if (pl?.id) setPlId(pl.id);
    if (cargo?.id) setCargoId(cargo.id);
    if (pl && cargo) {
      setMessage(t('carrierOnboarding.usingPreviousUploads'));
    }
  }, [uploadedDocs, t]);

  async function upload(docType: 'PUBLIC_LIABILITY' | 'CARGO_INSURANCE', file: File) {
    const mime = resolveUploadMime(file);
    const intent = await createUploadIntent({
      companyId,
      docType,
      originalFilename:
        file.name || `capture.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
      mimeType: mime,
      sizeBytes: file.size,
    });
    const up = await uploadDocumentContent(intent.id, file);
    await confirmDocument(intent.id, up.contentHash);
    return intent.id;
  }

  const uploadPl = useMutation({
    mutationFn: async (file: File) => upload('PUBLIC_LIABILITY', file),
    onSuccess: async (id) => {
      setPlId(id);
      setMessage(t('carrierOnboarding.publicLiabilityUploaded'));
      await onUploaded();
    },
  });
  const uploadCargo = useMutation({
    mutationFn: async (file: File) => upload('CARGO_INSURANCE', file),
    onSuccess: async (id) => {
      setCargoId(id);
      setMessage(t('carrierOnboarding.cargoInsuranceUploaded'));
      await onUploaded();
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
      {existingPl || existingCargo ? (
        <ul className="space-y-1 rounded-xl border border-clox-border bg-clox-surface p-3 text-xs text-clox-mute">
          {existingPl ? (
            <li>
              PUBLIC_LIABILITY · {existingPl.status}
              {existingPl.id ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="font-semibold text-clox-orange hover:underline"
                    onClick={() => {
                      void openDocumentContent(existingPl.id).catch(() => undefined);
                    }}
                  >
                    {t('documentsUpload.viewDocument')}
                  </button>
                </>
              ) : null}
            </li>
          ) : null}
          {existingCargo ? (
            <li>
              CARGO_INSURANCE · {existingCargo.status}
              {existingCargo.id ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="font-semibold text-clox-orange hover:underline"
                    onClick={() => {
                      void openDocumentContent(existingCargo.id).catch(() => undefined);
                    }}
                  >
                    {t('documentsUpload.viewDocument')}
                  </button>
                </>
              ) : null}
            </li>
          ) : null}
        </ul>
      ) : null}
      <FileInput
        className="mb-0"
        label={t('carrierOnboarding.publicLiability')}
        accept=".pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => {
          uploadPl.reset();
          uploadCargo.reset();
          setMessage(null);
          const f = e.target.files?.[0];
          if (f) uploadPl.mutate(f);
        }}
      />
      <FileInput
        className="mb-0"
        label={t('carrierOnboarding.cargoInsurance')}
        accept=".pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => {
          uploadPl.reset();
          uploadCargo.reset();
          setMessage(null);
          const f = e.target.files?.[0];
          if (f) uploadCargo.mutate(f);
        }}
      />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {(uploadPl.isError || uploadCargo.isError) && (
        <Notice tone="error">
          {getErrorDetail(uploadPl.error ?? uploadCargo.error)}
        </Notice>
      )}
      <div className="clox-form-actions">
        <Button
          variant="cta"
          disabled={!plId || !cargoId}
          onClick={() => void onSubmitted()}
        >
          {t('carrierOnboarding.continueDocsSaved')}
        </Button>
      </div>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.docsSavedHint')}</p>
    </div>
  );
}

const CONNECT_PENDING_KEY = 'clox.carrier.connect.pending';

function readConnectPending(companyId: string): boolean {
  try {
    return sessionStorage.getItem(CONNECT_PENDING_KEY) === companyId;
  } catch {
    return false;
  }
}

function writeConnectPending(companyId: string) {
  try {
    sessionStorage.setItem(CONNECT_PENDING_KEY, companyId);
  } catch {
    // Ignore private-mode / blocked storage — query param + account id still work.
  }
}

function clearConnectPending() {
  try {
    sessionStorage.removeItem(CONNECT_PENDING_KEY);
  } catch {
    // ignore
  }
}

function ConnectStep({
  companyId,
  mock,
  hasConnectAccount,
  payoutsEnabled,
  onDone,
}: {
  companyId: string;
  mock: boolean;
  hasConnectAccount: boolean;
  payoutsEnabled: boolean;
  onDone: () => Promise<CarrierOnboarding | void>;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isConnectReturn =
    searchParams.get('connect') === 'return' || searchParams.get('connect') === 'mock';
  const [sessionPending, setSessionPending] = useState(() => readConnectPending(companyId));
  // Continue must survive Stripe redirect (full page reload). Rely on DB account id,
  // return query, session flag, or already-confirmed payouts — never memory alone.
  const [setupStarted, setSetupStarted] = useState(
    () =>
      hasConnectAccount ||
      isConnectReturn ||
      payoutsEnabled ||
      readConnectPending(companyId),
  );
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const autoConfirmTriedRef = useRef(false);

  const canConfirm =
    payoutsEnabled ||
    hasConnectAccount ||
    isConnectReturn ||
    sessionPending ||
    setupStarted;

  const beforeItems = [
    t('carrierOnboarding.connectBeforeItem1'),
    t('carrierOnboarding.connectBeforeItem2'),
    t('carrierOnboarding.connectBeforeItem3'),
    t('carrierOnboarding.connectBeforeItem4'),
    t('carrierOnboarding.connectBeforeItem5'),
  ];
  const howSteps = mock
    ? [
        t('carrierOnboarding.connectMockHow1'),
        t('carrierOnboarding.connectMockHow2'),
        t('carrierOnboarding.connectMockHow3'),
      ]
    : [
        t('carrierOnboarding.connectHow1'),
        t('carrierOnboarding.connectHow2'),
        t('carrierOnboarding.connectHow3'),
        t('carrierOnboarding.connectHow4'),
        t('carrierOnboarding.connectHow5'),
        t('carrierOnboarding.connectHow6'),
        t('carrierOnboarding.connectHow7'),
      ];

  const clearConnectQuery = () => {
    if (!searchParams.has('connect')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('connect');
    setSearchParams(next, { replace: true });
  };

  const confirm = useMutation({
    mutationFn: () => confirmCarrierConnect(),
    onSuccess: async () => {
      clearConnectPending();
      setSessionPending(false);
      clearConnectQuery();
      await onDone();
    },
  });

  const setup = useMutation({
    mutationFn: () => setupCarrierConnect(),
    onSuccess: (data) => {
      setSetupStarted(true);
      writeConnectPending(companyId);
      setSessionPending(true);
      if (data.mock) {
        setStripeUrl(null);
        return;
      }
      setStripeUrl(data.url);
      // Same-tab redirect so Stripe return/refresh URL restores this page.
      window.location.assign(data.url);
    },
  });

  useEffect(() => {
    if (hasConnectAccount || isConnectReturn || payoutsEnabled || sessionPending) {
      setSetupStarted(true);
    }
  }, [hasConnectAccount, isConnectReturn, payoutsEnabled, sessionPending]);

  // After Stripe hosted onboarding, verify payouts and advance.
  useEffect(() => {
    if (payoutsEnabled || mock) return;
    if (!hasConnectAccount) return;
    if (!isConnectReturn && !sessionPending) return;
    if (autoConfirmTriedRef.current) return;
    autoConfirmTriedRef.current = true;
    confirm.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when returning from Stripe
  }, [isConnectReturn, sessionPending, hasConnectAccount, payoutsEnabled, mock]);

  // Already confirmed in DB — Continue advances; auto-advance only on Stripe return.
  useEffect(() => {
    if (!payoutsEnabled || !isConnectReturn) return;
    clearConnectPending();
    clearConnectQuery();
    void onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on return when already ready
  }, [payoutsEnabled, isConnectReturn]);

  return (
    <div className="mt-8 space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">
          {t('carrierOnboarding.connectTitle')}
        </h2>
        <p className="mt-2 text-sm text-clox-mute">
          {mock
            ? t('carrierOnboarding.connectMockIntro')
            : t('carrierOnboarding.connectIntro')}
        </p>
      </div>

      {!mock ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-clox-ink">
            {t('carrierOnboarding.connectBeforeTitle')}
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-clox-mute">
            {beforeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-clox-ink">
          {t('carrierOnboarding.connectHowTitle')}
        </h3>
        <ol className="list-decimal space-y-2.5 pl-5 text-sm text-clox-mute">
          {howSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      {!mock ? (
        <Notice tone="info" title={t('carrierOnboarding.connectTipTitle')}>
          <p className="text-sm">{t('carrierOnboarding.connectTipBody')}</p>
        </Notice>
      ) : (
        <Notice tone="info">{t('carrierOnboarding.connectMockHint')}</Notice>
      )}

      {(setup.isError || confirm.isError) && (
        <Notice tone="error">{getErrorDetail(setup.error ?? confirm.error)}</Notice>
      )}

      {(isConnectReturn || sessionPending) && confirm.isPending ? (
        <Notice tone="info">{t('carrierOnboarding.connectConfirming')}</Notice>
      ) : null}

      {payoutsEnabled ? (
        <Notice tone="success" title={t('carrierOnboarding.connectAlreadyReadyTitle')}>
          <p className="text-sm">{t('carrierOnboarding.connectAlreadyReadyBody')}</p>
        </Notice>
      ) : null}

      {canConfirm && !mock && !confirm.isPending && !payoutsEnabled ? (
        <Notice tone="success" title={t('carrierOnboarding.connectOpenedTitle')}>
          <p className="text-sm">{t('carrierOnboarding.connectOpenedBody')}</p>
          {stripeUrl ? (
            <p className="mt-2 text-sm">
              <a
                href={stripeUrl}
                className="font-medium text-clox-orange underline"
              >
                {t('carrierOnboarding.connectOpenLinkAgain')}
              </a>
            </p>
          ) : null}
        </Notice>
      ) : null}

      {canConfirm && mock && !payoutsEnabled ? (
        <Notice tone="success">{t('carrierOnboarding.mockConnectReady')}</Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!payoutsEnabled ? (
          <Button
            variant={canConfirm ? 'secondary' : 'cta'}
            disabled={setup.isPending || confirm.isPending}
            onClick={() => {
              confirm.reset();
              autoConfirmTriedRef.current = false;
              setup.mutate();
            }}
          >
            {setup.isPending
              ? t('carrierOnboarding.connectOpening')
              : canConfirm
                ? t('carrierOnboarding.createConnectAccountAgain')
                : t('carrierOnboarding.createConnectAccount')}
          </Button>
        ) : null}
        <Button
          variant="cta"
          disabled={confirm.isPending || (!canConfirm && !payoutsEnabled)}
          onClick={() => {
            setup.reset();
            if (payoutsEnabled) {
              clearConnectPending();
              void onDone();
              return;
            }
            confirm.mutate();
          }}
        >
          {confirm.isPending
            ? t('carrierOnboarding.connectConfirming')
            : payoutsEnabled
              ? t('continue')
              : t('carrierOnboarding.confirmPayoutsReady')}
        </Button>
      </div>
      {!canConfirm && !payoutsEnabled ? (
        <p className="text-xs text-clox-faint">{t('carrierOnboarding.connectConfirmHint')}</p>
      ) : null}
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

function VehiclesStep({
  data,
  onSaved,
  onContinue,
}: {
  data: CarrierOnboarding;
  onSaved: () => Promise<CarrierOnboarding | void>;
  onContinue: () => Promise<CarrierOnboarding | void>;
}) {
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
    const mime = resolveUploadMime(file);
    const intent = await createUploadIntent({
      companyId: data.company.id,
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

  const mutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!rwcFile) {
        throw new Error(t('fleet.rwcRequiredError'));
      }
      // Persist vehicle first so a later RWC/network failure does not look like
      // "add failed" after refresh (vehicle already exists).
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
      try {
        await uploadRwcForVehicle(created.id, rwcFile);
      } catch (err) {
        const detail = getErrorDetail(err);
        throw new Error(
          t('carrierOnboarding.vehicleSavedRwcFailed', {
            detail,
            defaultValue: `Vehicle saved, but RWC upload failed: ${detail}. Upload RWC on the vehicle below, then continue.`,
          }),
        );
      }
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
    onError: async (error) => {
      // Refresh so a persisted vehicle appears even when RWC/network failed.
      try {
        await onSaved();
      } catch {
        /* ignore refresh errors */
      }
      setRwcFormError(getErrorDetail(error));
    },
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
                <FileInput
                  className="mt-2 mb-0"
                  label={`${t('carrierOnboarding.rwc')} (${t('carrierOnboarding.rwcPerVehicle')})`}
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setRwcFormError(null);
                    void uploadRwcForVehicle(v.id, f)
                      .then(async () => {
                        setRwcMsg(t('carrierOnboarding.rwcUploaded'));
                        await onSaved();
                      })
                      .catch((err) => setRwcFormError(getErrorDetail(err)));
                  }}
                />
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
        <FileInput
          label={
            <>
              {t('fleet.rwcLabel')}{' '}
              <span className="text-[var(--status-danger)]">*</span>
            </>
          }
          hint={t('fleet.rwcHint')}
          accept=".pdf,image/jpeg,image/png,image/webp"
          fileName={rwcFile?.name ?? null}
          onChange={(e) => {
            setRwcFile(e.target.files?.[0] ?? null);
            setRwcFormError(null);
          }}
        />
        {rwcFormError || mutation.isError ? (
          <Notice tone="error" className="mb-0">
            {rwcFormError ?? getErrorDetail(mutation.error)}
          </Notice>
        ) : null}
        <div className="clox-form-actions">
          <Button type="submit" variant="cta" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('carrierOnboarding.addVehicle')}
          </Button>
          {allActiveHaveRwc ? (
            <Button type="button" variant="secondary" onClick={() => void onContinue()}>
              {t('continue')}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

type DriverInviteForm = { name: string; email: string };

function DriversStep({
  data,
  onSaved,
}: {
  data: CarrierOnboarding;
  onSaved: () => Promise<CarrierOnboarding | void>;
}) {
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
          className="clox-dialog-backdrop"
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

  useEffect(() => {
    setDg(data.company.capabilities.includes('DG'));
    setReefer(data.company.capabilities.includes('REEFER'));
    setOversize(data.company.capabilities.includes('OVERSIZE'));
    setTailLift(
      data.company.capabilities.length === 0 || data.company.capabilities.includes('TAIL_LIFT'),
    );
    const dgDoc = (data.uploadedDocs ?? []).find(
      (d) =>
        d.docType === 'DG_LICENCE' &&
        !d.vehicleId &&
        (d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW' || d.status === 'APPROVED'),
    );
    setDgDocId(dgDoc?.id ?? null);
    setDgMsg(dgDoc ? t('carrierOnboarding.dgLicenceUploaded') : null);
  }, [data.company.capabilities, data.uploadedDocs, t]);

  async function uploadDgLicence(file: File) {
    const mime = resolveUploadMime(file);
    const intent = await createUploadIntent({
      companyId: data.company.id,
      docType: 'DG_LICENCE',
      originalFilename:
        file.name || `dg.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
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
      <div className="space-y-3">
        <ChoiceCheck checked={tailLift} onChange={(e) => setTailLift(e.target.checked)}>
          {t('carrierOnboarding.capTailLift')}
        </ChoiceCheck>
        <ChoiceCheck checked={reefer} onChange={(e) => setReefer(e.target.checked)}>
          {t('carrierOnboarding.capReefer')}
        </ChoiceCheck>
        <ChoiceCheck
          checked={dg}
          onChange={(e) => {
            setDg(e.target.checked);
            setFormError(null);
          }}
        >
          {t('carrierOnboarding.capDangerousGoods')}
        </ChoiceCheck>
        {dg ? (
          <div className="rounded-xl border border-clox-border bg-clox-surface-alt p-3">
            <p className="text-xs font-semibold text-clox-ink">
              {t('carrierOnboarding.dgLicenceLabel')}{' '}
              <span className="text-[var(--status-danger)]">*</span>
            </p>
            <p className="mt-1 text-xs text-clox-faint">{t('carrierOnboarding.dgLicenceHint')}</p>
            <FileInput
              className="mt-3 mb-0"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFormError(null);
                void uploadDgLicence(f)
                  .then((id) => {
                    setDgDocId(id);
                    setDgMsg(t('carrierOnboarding.dgLicenceUploaded'));
                  })
                  .catch((err) => setFormError(getErrorDetail(err)));
              }}
            />
            {dgDocId ? (
              <div className="clox-form-actions mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void openDocumentContent(dgDocId).catch((err) =>
                      setFormError(getErrorDetail(err)),
                    );
                  }}
                >
                  {t('compliance.viewDocument')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <ChoiceCheck checked={oversize} onChange={(e) => setOversize(e.target.checked)}>
          {t('carrierOnboarding.capOversize')}
        </ChoiceCheck>
      </div>
      <p className="text-xs text-clox-faint">{t('carrierOnboarding.serviceRegionVic')}</p>
      {dgMsg ? <Notice tone="success">{dgMsg}</Notice> : null}
      {formError || mutation.isError ? (
        <Notice tone="error">{formError ?? getErrorDetail(mutation.error)}</Notice>
      ) : null}
      <div className="clox-form-actions">
        <Button type="submit" variant="cta" disabled={mutation.isPending || (dg && !dgDocId)}>
          {mutation.isPending ? t('saving') : t('saveAndContinue')}
        </Button>
      </div>
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
  onSubmitted: () => Promise<CarrierOnboarding | void>;
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
    const mime = resolveUploadMime(file);
    const intent = await createUploadIntent({
      companyId: data.company.id,
      docType,
      originalFilename:
        file.name || `capture.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
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
      <FileInput
        className="mb-0"
        label={t('carrierOnboarding.publicLiability')}
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
      <FileInput
        className="mb-0"
        label={t('carrierOnboarding.cargoInsurance')}
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
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {submit.isError ? (
        <Notice tone="error">{getErrorDetail(submit.error)}</Notice>
      ) : null}
      <div className="clox-form-actions">
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
    </div>
  );
}
