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
import { futureDateSchema, LICENCE_CLASSES } from '@/lib/validation';
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
  const expiryDefault = data.driver.licenceExpiry
    ? data.driver.licenceExpiry.slice(0, 10)
    : '2030-12-31';

  const form = useForm<LicenceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
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
    form.reset({
      licenceNo: data.driver.licenceNo || '',
      licenceClass: nextClass,
      licenceExpiry: data.driver.licenceExpiry
        ? data.driver.licenceExpiry.slice(0, 10)
        : '2030-12-31',
      nhvrAcknowledged: Boolean(data.driver.nhvrAcknowledgedAt),
    });
  }, [
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
      <h2 className="font-display text-lg font-semibold">{t('driverOnboarding.licenceTitle')}</h2>
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
