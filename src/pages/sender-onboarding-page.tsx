import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  confirmDocument,
  confirmSenderPayment,
  createUploadIntent,
  getErrorDetail,
  getSenderOnboarding,
  setupSenderPayment,
  submitSenderVerification,
  updateSenderProfile,
  uploadDocumentContent,
  type SenderOnboarding,
} from '@/lib/api';
import {
  Button,
  Field,
  Notice,
  RadioCardGroup,
  StepChips,
  useConfirm,
  useToast,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { resolveUploadMime } from '@/lib/upload-mime';
import { abnSchema, AU_STATES } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const SENDER_STEPS = [
  'account_type',
  'invoice',
  'documents',
  'waiting_ops',
  'payment',
  'complete',
] as const;

type SenderStepId = (typeof SENDER_STEPS)[number];

const SENDER_EDITABLE_STEPS: readonly SenderStepId[] = [
  'account_type',
  'invoice',
  'documents',
];

export function SenderOnboardingPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const [viewStep, setViewStep] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['sender', 'onboarding'],
    queryFn: () => getSenderOnboarding(),
    enabled: role === AppRole.SENDER,
  });

  const serverStep = query.data?.step;
  useEffect(() => {
    if (serverStep) setViewStep(serverStep);
  }, [serverStep]);

  if (role !== AppRole.SENDER) {
    return <Navigate to="/" replace />;
  }

  if (query.isLoading) {
    return <LoadingBlock label={t('senderOnboarding.loading')} />;
  }

  if (query.isError || !query.data) {
    return <Notice tone="error">{getErrorDetail(query.error)}</Notice>;
  }

  const data = query.data;
  const step = viewStep ?? data.step;
  const canEditSteps =
    data.company.status === 'DRAFT' || data.company.status === 'INFO_REQUESTED';
  const serverIdx = SENDER_STEPS.indexOf(
    (SENDER_STEPS as readonly string[]).includes(data.step)
      ? (data.step as SenderStepId)
      : 'account_type',
  );

  const refreshAndGo = async (
    next?: SenderOnboarding,
    options?: { showSavedToast?: boolean },
  ) => {
    const fresh =
      next ??
      (await qc.fetchQuery({
        queryKey: ['sender', 'onboarding'],
        queryFn: () => getSenderOnboarding(),
      }));
    // Mutation responses must update the cache — otherwise prev/next steps
    // remount with stale empty fields (ABN, invoice, etc.).
    if (next) {
      qc.setQueryData(['sender', 'onboarding'], next);
    }
    if (options?.showSavedToast !== false) {
      toast.success(t('saved'));
    }
    if (fresh?.step) setViewStep(fresh.step);
    return fresh;
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t('senderOnboarding.title')}</h1>
      <p className="mt-2 text-sm text-clox-mute">{t('senderOnboarding.subtitle')}</p>

      <StepChips
        className="mt-4"
        current={step}
        steps={[
          { id: 'account_type', label: t('senderOnboarding.stepAccount') },
          { id: 'invoice', label: t('senderOnboarding.stepInvoice') },
          { id: 'documents', label: t('senderOnboarding.stepDocs') },
          { id: 'waiting_ops', label: t('senderOnboarding.stepOps') },
          { id: 'payment', label: t('senderOnboarding.stepPay') },
          { id: 'complete', label: t('senderOnboarding.stepDone') },
        ]}
        onStepSelect={canEditSteps ? setViewStep : undefined}
        canSelectStep={(id, index) => {
          if (!canEditSteps) return false;
          if (!SENDER_EDITABLE_STEPS.includes(id as SenderStepId)) return false;
          return index <= serverIdx || id === data.step;
        }}
      />
      {canEditSteps && step !== data.step ? (
        <p className="mt-2 text-xs text-clox-mute">
          {t('senderOnboarding.viewingPastStep')}{' '}
          <button
            type="button"
            className="font-semibold text-clox-orange hover:underline"
            onClick={() => setViewStep(data.step)}
          >
            {t('senderOnboarding.backToCurrentStep')}
          </button>
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-clox-border bg-clox-surface p-3 text-xs text-clox-mute">
        {t('senderOnboarding.statusStrip', {
          status: data.company.status,
          canBook: String(data.goNoGo.canBook),
        })}
        {data.stripeMock ? ' · ' + t('senderOnboarding.stripeMock') : ''}
      </div>

      {data.company.status === 'INFO_REQUESTED' ? (
        <Notice tone="warn" className="mt-4">
          {t('senderOnboarding.opsRequestedInfo', {
            note: data.latestCase?.decisionNote ? `: ${data.latestCase.decisionNote}` : '',
          })}
        </Notice>
      ) : null}

      {step === 'account_type' && (
        <AccountStep data={data} onSaved={refreshAndGo} />
      )}

      {step === 'invoice' && <InvoiceStep data={data} onSaved={refreshAndGo} />}

      {step === 'documents' && (
        <DocumentsStep
          companyId={data.company.id}
          accountType={data.company.senderAccountType}
          onSubmitted={async () => {
            await refreshAndGo(undefined, { showSavedToast: false });
          }}
        />
      )}

      {step === 'waiting_ops' && (
        <Notice tone="warn" className="mt-8" title={t('waitingForOps')}>
          <p>
            {t('senderOnboarding.waitingOpsBody', { status: data.latestCase?.status ?? 'OPEN' })}
            {data.latestCase?.decisionNote
              ? ' ' + t('senderOnboarding.notePrefix', { note: data.latestCase.decisionNote })
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

      {step === 'payment' && (
        <PaymentStep
          mock={data.stripeMock}
          onDone={async () => {
            await qc.invalidateQueries({ queryKey: ['sender', 'onboarding'] });
          }}
        />
      )}

      {step === 'complete' && (
        <Notice tone="success" className="mt-8" title={t('senderOnboarding.activeTitle')}>
          <p>{t('senderOnboarding.activeBody')}</p>
          <ul className="mt-3 space-y-1 text-xs">
            <li>{t('senderOnboarding.goNoGoOpsApproved', { value: String(data.goNoGo.opsApproved) })}</li>
            <li>{t('senderOnboarding.goNoGoInvoice', { value: String(data.goNoGo.invoiceComplete) })}</li>
            <li>{t('senderOnboarding.goNoGoPayment', { value: String(data.goNoGo.paymentReady) })}</li>
            <li>{t('senderOnboarding.goNoGoCanBook', { value: String(data.goNoGo.canBook) })}</li>
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

type AccountForm = {
  accountType: 'BUSINESS' | 'INDIVIDUAL';
  legalName: string;
  abn: string;
};

type InvoiceForm = {
  abn: string;
  invoiceLegalName: string;
  invoiceAddressLine1: string;
  invoiceSuburb: string;
  invoiceState: string;
  invoicePostcode: string;
  gstRegistered: boolean;
};

function AccountStep({
  data,
  onSaved,
}: {
  data: SenderOnboarding;
  onSaved: (next?: SenderOnboarding) => Promise<unknown>;
}) {
  const { t } = useTranslation();

  const schema = z
    .object({
      accountType: z.enum(['BUSINESS', 'INDIVIDUAL']),
      legalName: z.string().trim().min(1, t('validation.legalNameRequired')),
      abn: z.string().trim(),
    })
    .superRefine((values, ctx) => {
      if (values.accountType === 'BUSINESS') {
        const abn = abnSchema(t('validation.abnRequired'), t('validation.abnInvalid')).safeParse(
          values.abn,
        );
        if (!abn.success) {
          ctx.addIssue({
            code: 'custom',
            path: ['abn'],
            message: abn.error.issues[0]?.message ?? t('validation.abnInvalid'),
          });
        }
      }
    });

  const form = useForm<AccountForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountType: data.company.senderAccountType ?? 'BUSINESS',
      legalName: data.company.legalName || '',
      abn: data.company.abn || '',
    },
  });

  useEffect(() => {
    form.reset({
      accountType: data.company.senderAccountType ?? 'BUSINESS',
      legalName: data.company.legalName || '',
      abn: data.company.abn || '',
    });
  }, [
    data.company.senderAccountType,
    data.company.legalName,
    data.company.abn,
    form,
  ]);

  const accountType = form.watch('accountType');

  const mutation = useMutation({
    mutationFn: (values: AccountForm) =>
      updateSenderProfile({
        accountType: values.accountType,
        legalName: values.legalName,
        abn: values.accountType === 'BUSINESS' ? values.abn.replace(/\s/g, '') : undefined,
        homeRegionCode: data.company.homeRegionCode || 'VIC',
      }),
    onSuccess: (next) => void onSaved(next),
  });

  return (
    <form
      className="mt-8"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <h2 className="mb-4 font-display text-lg font-semibold">
        {t('senderOnboarding.stepAccount')}
      </h2>
      <RadioCardGroup
        name="accountType"
        value={accountType}
        onChange={(next) => form.setValue('accountType', next, { shouldValidate: true })}
        options={[
          {
            value: 'BUSINESS',
            title: t('senderOnboarding.accountBusiness'),
            description: t('senderOnboarding.accountBusinessHint'),
          },
          {
            value: 'INDIVIDUAL',
            title: t('senderOnboarding.accountIndividual'),
            description: t('senderOnboarding.accountIndividualHint'),
          },
        ]}
      />
      <Field
        label={t('legalName')}
        required
        error={form.formState.errors.legalName?.message}
        {...form.register('legalName')}
      />
      {accountType === 'BUSINESS' ? (
        <Field
          label={t('abn')}
          required
          inputMode="numeric"
          error={form.formState.errors.abn?.message}
          {...form.register('abn')}
        />
      ) : null}
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

function InvoiceStep({
  data,
  onSaved,
}: {
  data: SenderOnboarding;
  onSaved: (next?: SenderOnboarding) => Promise<unknown>;
}) {
  const { t } = useTranslation();

  const isBusiness = (data.company.senderAccountType ?? 'BUSINESS') === 'BUSINESS';

  const schema = z
    .object({
      abn: z.string().trim(),
      invoiceLegalName: z.string().trim().min(1, t('validation.invoiceLegalNameRequired')),
      invoiceAddressLine1: z.string().trim().min(1, t('validation.addressRequired')),
      invoiceSuburb: z.string().trim().min(1, t('validation.suburbRequired')),
      invoiceState: z
        .string()
        .trim()
        .toUpperCase()
        .refine((value) => (AU_STATES as readonly string[]).includes(value), {
          message: t('validation.stateInvalid'),
        }),
      invoicePostcode: z.string().trim().regex(/^\d{4}$/, t('validation.postcodeInvalid')),
      gstRegistered: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (!isBusiness) return;
      // Prefer form value; fall back to ABN already saved on account step.
      const candidate = (values.abn || data.company.abn || '').replace(/\s/g, '');
      const abn = abnSchema(t('validation.abnRequired'), t('validation.abnInvalid')).safeParse(
        candidate,
      );
      if (!abn.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['abn'],
          message: abn.error.issues[0]?.message ?? t('validation.abnInvalid'),
        });
      }
    });

  const form = useForm<InvoiceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      abn: data.company.abn || '',
      invoiceLegalName: data.company.invoiceLegalName || data.company.legalName || '',
      invoiceAddressLine1: data.company.invoiceAddressLine1 || '',
      invoiceSuburb: data.company.invoiceSuburb || '',
      invoiceState: data.company.invoiceState || 'VIC',
      invoicePostcode: data.company.invoicePostcode || '',
      gstRegistered: data.company.gstRegistered,
    },
  });

  useEffect(() => {
    form.reset({
      abn: data.company.abn || '',
      invoiceLegalName: data.company.invoiceLegalName || data.company.legalName || '',
      invoiceAddressLine1: data.company.invoiceAddressLine1 || '',
      invoiceSuburb: data.company.invoiceSuburb || '',
      invoiceState: data.company.invoiceState || 'VIC',
      invoicePostcode: data.company.invoicePostcode || '',
      gstRegistered: data.company.gstRegistered,
    });
  }, [
    data.company.abn,
    data.company.invoiceLegalName,
    data.company.legalName,
    data.company.invoiceAddressLine1,
    data.company.invoiceSuburb,
    data.company.invoiceState,
    data.company.invoicePostcode,
    data.company.gstRegistered,
    form,
  ]);

  const mutation = useMutation({
    mutationFn: (values: InvoiceForm) => {
      const accountType = data.company.senderAccountType ?? 'BUSINESS';
      const nextAbn = values.abn.replace(/\s/g, '');
      return updateSenderProfile({
        accountType,
        legalName: data.company.legalName || values.invoiceLegalName,
        // Omit abn when unchanged/empty so server keeps the account-step ABN.
        ...(accountType === 'BUSINESS' && nextAbn
          ? { abn: nextAbn }
          : accountType === 'BUSINESS' && !data.company.abn
            ? { abn: '' }
            : {}),
        homeRegionCode: data.company.homeRegionCode || 'VIC',
        invoiceLegalName: values.invoiceLegalName,
        invoiceAddressLine1: values.invoiceAddressLine1,
        invoiceSuburb: values.invoiceSuburb,
        invoiceState: values.invoiceState,
        invoicePostcode: values.invoicePostcode,
        gstRegistered: values.gstRegistered,
      });
    },
    onSuccess: (next) => void onSaved(next),
  });

  return (
    <form
      className="mt-8"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <h2 className="mb-4 font-display text-lg font-semibold">
        {t('senderOnboarding.stepInvoice')}
      </h2>
      {isBusiness ? (
        <Field
          label={t('abn')}
          required
          inputMode="numeric"
          error={form.formState.errors.abn?.message}
          {...form.register('abn')}
        />
      ) : null}
      <Field
        label={t('senderOnboarding.placeholderInvoiceLegalName')}
        required
        error={form.formState.errors.invoiceLegalName?.message}
        {...form.register('invoiceLegalName')}
      />
      <Field
        label={t('senderOnboarding.placeholderAddressLine1')}
        required
        error={form.formState.errors.invoiceAddressLine1?.message}
        {...form.register('invoiceAddressLine1')}
      />
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-2">
        <Field
          label={t('senderOnboarding.placeholderSuburb')}
          required
          error={form.formState.errors.invoiceSuburb?.message}
          {...form.register('invoiceSuburb')}
        />
        <Field
          label={t('senderOnboarding.placeholderState')}
          required
          error={form.formState.errors.invoiceState?.message}
          {...form.register('invoiceState', {
            setValueAs: (value: string) => value.toUpperCase(),
          })}
        />
        <Field
          label={t('senderOnboarding.placeholderPostcode')}
          required
          inputMode="numeric"
          error={form.formState.errors.invoicePostcode?.message}
          {...form.register('invoicePostcode')}
        />
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-clox-mute">
        <input type="checkbox" className="accent-clox-accent" {...form.register('gstRegistered')} />
        {t('senderOnboarding.gstRegistered')}
      </label>
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

function DocumentsStep({
  companyId,
  accountType,
  onSubmitted,
}: {
  companyId: string;
  accountType: 'BUSINESS' | 'INDIVIDUAL' | null;
  onSubmitted: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const docType = accountType === 'INDIVIDUAL' ? 'GOVERNMENT_ID' : 'ABN_EXTRACT';
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('senderOnboarding.errorChooseFile'));
      const mime = resolveUploadMime(file);
      const intent = await createUploadIntent({
        companyId,
        docType,
        originalFilename: file.name || `capture.${mime === 'image/png' ? 'png' : 'jpg'}`,
        mimeType: mime,
        sizeBytes: file.size,
      });
      const up = await uploadDocumentContent(intent.id, file);
      await confirmDocument(intent.id, up.contentHash);
      return intent.id;
    },
    onSuccess: (id) => {
      setDocId(id);
      setMessage(t('senderOnboarding.documentUploaded'));
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!docId) throw new Error(t('senderOnboarding.errorUploadFirst'));
      return submitSenderVerification([docId]);
    },
    onSuccess: () => onSubmitted(),
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('senderOnboarding.docsTitle')}</h2>
      <p className="text-sm text-clox-mute">
        {t('senderOnboarding.docsRequired', { docType })}
      </p>
      <div className="clox-file-field mb-0">
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="clox-file-input"
          onChange={(e) => {
            upload.reset();
            submit.reset();
            setMessage(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />
      </div>
      {(upload.isError || submit.isError) && (
        <Notice tone="error">{getErrorDetail(upload.error ?? submit.error)}</Notice>
      )}
      {message ? <Notice tone="success">{message}</Notice> : null}
      <div className="clox-form-actions">
        <Button
          variant="secondary"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? t('uploading') : t('upload')}
        </Button>
        <Button
          variant="cta"
          disabled={!docId || submit.isPending}
          onClick={() => {
            void (async () => {
              const ok = await confirm({
                title: t('confirm.submitComplianceTitle'),
                description: t('confirm.submitComplianceBody'),
                confirmLabel: t('senderOnboarding.submitToOps'),
              });
              if (ok) submit.mutate();
            })();
          }}
        >
          {submit.isPending ? t('submitting') : t('senderOnboarding.submitToOps')}
        </Button>
      </div>
    </div>
  );
}

function PaymentStep({ mock, onDone }: { mock: boolean; onDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const [setupInfo, setSetupInfo] = useState<string | null>(null);

  const setup = useMutation({
    mutationFn: () => setupSenderPayment(),
    onSuccess: (data) => {
      setSetupInfo(
        data.mock
          ? t('senderOnboarding.setupIntentMock', { id: data.setupIntentId })
          : t('senderOnboarding.setupIntentReady'),
      );
    },
  });

  const confirm = useMutation({
    mutationFn: () => confirmSenderPayment(mock ? undefined : undefined),
    onSuccess: () => {
      setSetupInfo(null);
      void onDone();
    },
  });

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">{t('senderOnboarding.paymentTitle')}</h2>
      <p className="text-sm text-clox-mute">
        {mock
          ? t('senderOnboarding.paymentMockHint')
          : t('senderOnboarding.paymentLiveHint')}
      </p>
      {(setup.isError || confirm.isError) && (
        <Notice tone="error">{getErrorDetail(setup.error ?? confirm.error)}</Notice>
      )}
      {setupInfo ? <Notice tone="success">{setupInfo}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={setup.isPending}
          onClick={() => {
            // Clear sticky Confirm-before-setup error under the upcoming success notice.
            confirm.reset();
            setup.mutate();
          }}
        >
          {t('senderOnboarding.createSetupIntent')}
        </Button>
        <Button
          variant="cta"
          disabled={confirm.isPending}
          onClick={() => {
            setup.reset();
            confirm.mutate();
          }}
        >
          {t('senderOnboarding.confirmPaymentReady')}
        </Button>
      </div>
    </div>
  );
}
