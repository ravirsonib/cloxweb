import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  confirmDocument,
  createUploadIntent,
  getDriverAssignability,
  getDriverOnboarding,
  getErrorDetail,
  submitDriverProfile,
  uploadDocumentContent,
  type DriverOnboarding,
} from '@/lib/api';
import { Button, ChoiceCheck, Field, FileInput, Notice, Select } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { resolveUploadMime } from '@/lib/upload-mime';
import {
  AU_STATES,
  futureDateSchema,
  LICENCE_CLASSES,
  requiredPhoneSchema,
} from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';

function formatLicenceSubmitError(error: unknown, fallback: (err: unknown) => string): string {
  const detail = fallback(error);
  if (/licenceDocumentId/i.test(detail)) {
    return detail.includes('uuid') || /invalid/i.test(detail)
      ? detail
      : 'Upload your driver licence document (PDF or image) before submitting.';
  }
  if (/DRIVER_LICENCE_DOC_REQUIRED/i.test(detail)) {
    return 'A usable driver licence document is required before activation. Upload the file and try again.';
  }
  return detail;
}

export function DriverOnboardingPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();

  const onboarding = useQuery({
    queryKey: ['driver', 'onboarding'],
    queryFn: () => getDriverOnboarding(),
    enabled: role === AppRole.DRIVER,
  });

  const assignability = useQuery({
    queryKey: ['driver', 'assignability'],
    queryFn: () => getDriverAssignability(),
    enabled: role === AppRole.DRIVER && onboarding.data?.step === 'complete',
  });

  if (role !== AppRole.DRIVER) {
    return <Navigate to="/" replace />;
  }

  if (onboarding.isLoading) return <LoadingBlock label={t('driverOnboarding.loading')} />;
  if (onboarding.isError) {
    return <Notice tone="error">{getErrorDetail(onboarding.error)}</Notice>;
  }

  const data = onboarding.data!;
  const step = data.step;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['driver'] });
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
        {t('driverOnboarding.title')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">
        {data.company ? (
          <>
            {t('driverOnboarding.companyLine', {
              legalName: data.company.legalName,
              status: data.driver.status,
            })}
          </>
        ) : (
          <span className="text-[var(--status-warn)]">{t('driverOnboarding.noCompanyLinked')}</span>
        )}
      </p>

      {step === 'accept' ? (
        <div className="mt-8 space-y-3">
          <Notice tone="warn">{t('driverOnboarding.inviteNotAccepted')}</Notice>
          <Link to="/login" className="clox-btn clox-btn-secondary inline-flex">
            {t('backToLogin')}
          </Link>
        </div>
      ) : null}

      {step === 'licence' ? (
        <LicenceStep
          data={data}
          onSaved={refresh}
          companyId={data.company?.id ?? null}
          driverId={data.driver.id}
        />
      ) : null}

      {step === 'complete' ? (
        <div className="mt-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--status-ok)]">
            {t('driverOnboarding.activeTitle')}
          </h2>
          <ul className="text-sm text-clox-mute">
            <li>
              {t('driverOnboarding.personalSummary', {
                name: data.user.name ?? t('dash'),
                phone: data.user.phone ?? t('dash'),
              })}
            </li>
            <li>
              {t('driverOnboarding.addressSummary', {
                line: data.driver.addressLine1 ?? t('dash'),
                suburb: data.driver.suburb ?? t('dash'),
                state: data.driver.state ?? t('dash'),
                postcode: data.driver.postcode ?? t('dash'),
              })}
            </li>
            <li>
              {t('driverOnboarding.licenceLine', {
                licenceClass: data.driver.licenceClass
                  ? t(`driverOnboarding.licenceClasses.${data.driver.licenceClass}`, {
                      defaultValue: data.driver.licenceClass,
                    })
                  : t('dash'),
                licenceNo: data.driver.licenceNo,
                expiry: data.driver.licenceExpiry?.slice(0, 10),
              })}
            </li>
            <li>
              {t('driverOnboarding.nhvrAcknowledged', {
                value: data.driver.nhvrAcknowledgedAt ? t('yes') : t('no'),
              })}
            </li>
            <li>{t('driverOnboarding.canBeAssigned', { value: String(data.goNoGo.canBeAssigned) })}</li>
            {assignability.data ? (
              <li>
                {t('driverOnboarding.assignabilityReason', {
                  reason: assignability.data.reason ?? t('driverOnboarding.assignabilityOk'),
                })}
              </li>
            ) : null}
            <li className="text-clox-faint">{data.goNoGo.tripApisNote}</li>
          </ul>
        </div>
      ) : null}

      {step === 'suspended' ? (
        <Notice tone="error" className="mt-8">
          {t('driverOnboarding.suspended')}
        </Notice>
      ) : null}
    </div>
  );
}

type LicenceForm = {
  name: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  addressLine1: string;
  suburb: string;
  state: (typeof AU_STATES)[number];
  postcode: string;
  licenceNo: string;
  licenceClass: (typeof LICENCE_CLASSES)[number];
  licenceExpiry: string;
  nhvrAcknowledged: boolean;
};

function LicenceStep({
  data,
  onSaved,
  companyId,
  driverId,
}: {
  data: DriverOnboarding;
  onSaved: () => Promise<void>;
  companyId: string | null;
  driverId: string;
}) {
  const { t } = useTranslation();
  const [licenceFile, setLicenceFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(2, t('validation.nameRequired'))
      .max(120)
      .regex(/^[\p{L}][\p{L}\s.'\-]*$/u, t('validation.nameInvalid')),
    phone: requiredPhoneSchema(t('validation.phoneRequired'), t('validation.phoneInvalid')),
    emergencyContactName: z
      .string()
      .trim()
      .min(2, t('validation.emergencyNameRequired'))
      .max(120)
      .regex(/^[\p{L}][\p{L}\s.'\-]*$/u, t('validation.nameInvalid')),
    emergencyContactPhone: requiredPhoneSchema(
      t('validation.emergencyPhoneRequired'),
      t('validation.phoneInvalid'),
    ),
    addressLine1: z.string().trim().min(3, t('validation.addressRequired')).max(200),
    suburb: z.string().trim().min(2, t('validation.suburbRequired')).max(100),
    state: z.enum(AU_STATES, { message: t('validation.stateRequired') }),
    postcode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, t('validation.postcodeInvalid')),
    licenceNo: z.string().trim().min(1, t('validation.licenceNoRequired')),
    licenceClass: z.enum(LICENCE_CLASSES, {
      message: t('validation.licenceClassRequired'),
    }),
    licenceExpiry: futureDateSchema(
      t('validation.licenceExpiryRequired'),
      t('validation.licenceExpiryFuture'),
    ),
    nhvrAcknowledged: z.boolean().refine((value) => value === true, {
      message: t('validation.nhvrRequired'),
    }),
  });

  const licenceClassDefault = (LICENCE_CLASSES as readonly string[]).includes(
    data.driver.licenceClass ?? '',
  )
    ? (data.driver.licenceClass as (typeof LICENCE_CLASSES)[number])
    : 'C';
  const stateDefault = (AU_STATES as readonly string[]).includes(data.driver.state ?? '')
    ? (data.driver.state as (typeof AU_STATES)[number])
    : 'VIC';
  const expiryDefault = data.driver.licenceExpiry
    ? data.driver.licenceExpiry.slice(0, 10)
    : '2030-12-31';

  const form = useForm<LicenceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: data.user.name || '',
      phone: data.user.phone || '',
      emergencyContactName: data.driver.emergencyContactName || '',
      emergencyContactPhone: data.driver.emergencyContactPhone || '',
      addressLine1: data.driver.addressLine1 || '',
      suburb: data.driver.suburb || '',
      state: stateDefault,
      postcode: data.driver.postcode || '',
      licenceNo: data.driver.licenceNo || '',
      licenceClass: licenceClassDefault,
      licenceExpiry: expiryDefault,
      nhvrAcknowledged: Boolean(data.driver.nhvrAcknowledgedAt),
    },
  });

  useEffect(() => {
    const nextClass = (LICENCE_CLASSES as readonly string[]).includes(data.driver.licenceClass ?? '')
      ? (data.driver.licenceClass as (typeof LICENCE_CLASSES)[number])
      : 'C';
    const nextState = (AU_STATES as readonly string[]).includes(data.driver.state ?? '')
      ? (data.driver.state as (typeof AU_STATES)[number])
      : 'VIC';
    form.reset({
      name: data.user.name || '',
      phone: data.user.phone || '',
      emergencyContactName: data.driver.emergencyContactName || '',
      emergencyContactPhone: data.driver.emergencyContactPhone || '',
      addressLine1: data.driver.addressLine1 || '',
      suburb: data.driver.suburb || '',
      state: nextState,
      postcode: data.driver.postcode || '',
      licenceNo: data.driver.licenceNo || '',
      licenceClass: nextClass,
      licenceExpiry: data.driver.licenceExpiry
        ? data.driver.licenceExpiry.slice(0, 10)
        : '2030-12-31',
      nhvrAcknowledged: Boolean(data.driver.nhvrAcknowledgedAt),
    });
  }, [
    data.user.name,
    data.user.phone,
    data.driver.emergencyContactName,
    data.driver.emergencyContactPhone,
    data.driver.addressLine1,
    data.driver.suburb,
    data.driver.state,
    data.driver.postcode,
    data.driver.licenceNo,
    data.driver.licenceClass,
    data.driver.licenceExpiry,
    data.driver.nhvrAcknowledgedAt,
    form,
  ]);

  const mutation = useMutation({
    mutationFn: async (values: LicenceForm) => {
      if (!companyId) {
        throw new Error(t('driverOnboarding.errorNoCompany'));
      }
      if (!licenceFile) {
        throw new Error(t('driverOnboarding.errorLicenceFileRequired'));
      }
      const mime = resolveUploadMime(licenceFile);
      const intent = await createUploadIntent({
        companyId,
        driverId,
        docType: 'DRIVER_LICENCE',
        originalFilename:
          licenceFile.name ||
          `licence.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
        mimeType: mime,
        sizeBytes: licenceFile.size,
      });
      if (!intent?.id) {
        throw new Error(t('driverOnboarding.errorLicenceFileRequired'));
      }
      const uploadedRes = await uploadDocumentContent(intent.id, licenceFile);
      await confirmDocument(intent.id, uploadedRes.contentHash);
      return submitDriverProfile({
        name: values.name.trim(),
        phone: values.phone.trim(),
        emergencyContactName: values.emergencyContactName.trim(),
        emergencyContactPhone: values.emergencyContactPhone.trim(),
        addressLine1: values.addressLine1.trim(),
        suburb: values.suburb.trim(),
        state: values.state,
        postcode: values.postcode.trim(),
        licenceNo: values.licenceNo.trim(),
        licenceClass: values.licenceClass,
        licenceExpiry: values.licenceExpiry,
        nhvrAcknowledged: true,
        licenceDocumentId: intent.id,
      });
    },
    onSuccess: () => onSaved(),
  });

  return (
    <form
      className="mt-8 max-w-lg"
      onSubmit={form.handleSubmit((values) => {
        const missingFile = !licenceFile;
        setFileError(missingFile ? t('driverOnboarding.errorLicenceFileRequired') : null);
        if (missingFile) return;
        mutation.mutate(values);
      })}
      noValidate
    >
      <h2 className="font-display text-lg font-semibold">{t('driverOnboarding.personalTitle')}</h2>
      <p className="mb-3 mt-1 text-sm text-clox-mute">{t('driverOnboarding.personalHint')}</p>

      <Field
        label={t('driverOnboarding.nameLabel')}
        required
        autoComplete="name"
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <Field
        label={t('driverOnboarding.phoneLabel')}
        required
        type="tel"
        autoComplete="tel"
        placeholder={t('driverOnboarding.phonePlaceholder')}
        error={form.formState.errors.phone?.message}
        {...form.register('phone')}
      />
      <Field
        label={t('driverOnboarding.emergencyNameLabel')}
        required
        error={form.formState.errors.emergencyContactName?.message}
        {...form.register('emergencyContactName')}
      />
      <Field
        label={t('driverOnboarding.emergencyPhoneLabel')}
        required
        type="tel"
        placeholder={t('driverOnboarding.phonePlaceholder')}
        error={form.formState.errors.emergencyContactPhone?.message}
        {...form.register('emergencyContactPhone')}
      />
      <Field
        label={t('driverOnboarding.addressLineLabel')}
        required
        autoComplete="street-address"
        error={form.formState.errors.addressLine1?.message}
        {...form.register('addressLine1')}
      />
      <Field
        label={t('driverOnboarding.suburbLabel')}
        required
        autoComplete="address-level2"
        error={form.formState.errors.suburb?.message}
        {...form.register('suburb')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t('driverOnboarding.stateLabel')}
          required
          error={form.formState.errors.state?.message}
          value={form.watch('state')}
          {...form.register('state')}
        >
          {AU_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Field
          label={t('driverOnboarding.postcodeLabel')}
          required
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={4}
          error={form.formState.errors.postcode?.message}
          {...form.register('postcode')}
        />
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">{t('driverOnboarding.licenceTitle')}</h2>
      <p className="mb-3 mt-1 text-sm text-clox-mute">{t('driverOnboarding.licenceHint')}</p>
      <Notice tone="info" className="mb-4">
        {t('driverOnboarding.licenceUploadRequiredNotice')}
      </Notice>

      <FileInput
        label={t('driverOnboarding.licenceUploadLabel')}
        required
        hint={t('driverOnboarding.licenceUploadHint')}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        fileName={licenceFile?.name ?? null}
        error={fileError}
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          setLicenceFile(next);
          setFileError(null);
        }}
      />

      <Field
        label={t('driverOnboarding.placeholderLicenceNumber')}
        required
        placeholder={t('driverOnboarding.placeholderLicenceNumber')}
        error={form.formState.errors.licenceNo?.message}
        {...form.register('licenceNo')}
      />
      <Select
        label={t('validation.licenceClassLabel')}
        required
        error={form.formState.errors.licenceClass?.message}
        value={form.watch('licenceClass')}
        {...form.register('licenceClass')}
      >
        {LICENCE_CLASSES.map((c) => (
          <option key={c} value={c}>
            {t(`driverOnboarding.licenceClasses.${c}`)}
          </option>
        ))}
      </Select>
      <Field
        type="date"
        label={t('validation.licenceExpiryLabel')}
        required
        error={form.formState.errors.licenceExpiry?.message}
        {...form.register('licenceExpiry')}
      />

      <Controller
        name="nhvrAcknowledged"
        control={form.control}
        render={({ field, fieldState }) => (
          <ChoiceCheck
            className="mb-4"
            checked={field.value}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            error={fieldState.error?.message}
            onChange={(e) => field.onChange(e.target.checked)}
          >
            {t('driverOnboarding.nhvrCheckbox')}
          </ChoiceCheck>
        )}
      />

      {mutation.isError ? (
        <Notice tone="error" className="mb-0">
          {formatLicenceSubmitError(mutation.error, getErrorDetail)}
        </Notice>
      ) : null}
      <div className="clox-form-actions">
        <Button type="submit" variant="cta" disabled={mutation.isPending || !companyId}>
          {mutation.isPending ? t('submitting') : t('driverOnboarding.submitAndActivate')}
        </Button>
      </div>
    </form>
  );
}

/** Keep type import used for future steps */
export type { DriverOnboarding };
