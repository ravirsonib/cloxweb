import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
import { Button, Field, Notice, Select } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { resolveUploadMime } from '@/lib/upload-mime';
import { futureDateSchema, LICENCE_CLASSES } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';

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
        setFileError(licenceFile ? null : t('driverOnboarding.errorLicenceFileRequired'));
        if (!licenceFile) return;
        mutation.mutate(values);
      })}
      noValidate
    >
      <h2 className="font-display text-lg font-semibold">{t('driverOnboarding.licenceTitle')}</h2>
      <p className="mb-4 mt-1 text-sm text-clox-mute">{t('driverOnboarding.licenceHint')}</p>
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
      <div className="clox-file-field">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
          {t('driverOnboarding.licenceUploadLabel')}
          <span className="text-[var(--status-danger)]"> *</span>
        </label>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="clox-file-input"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setLicenceFile(next);
            setFileError(null);
          }}
        />
        {fileError ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--status-danger)]" role="alert">
            {fileError}
          </p>
        ) : null}
      </div>
      <label className="mb-4 flex items-start gap-2 text-sm text-clox-mute">
        <input type="checkbox" className="mt-1 accent-clox-accent" {...form.register('nhvrAcknowledged')} />
        <span>
          {t('driverOnboarding.nhvrCheckbox')}
          {form.formState.errors.nhvrAcknowledged?.message ? (
            <span className="mt-1 block text-[12px] font-medium text-[var(--status-danger)]" role="alert">
              {form.formState.errors.nhvrAcknowledged.message}
            </span>
          ) : null}
        </span>
      </label>
      {mutation.isError ? (
        <Notice tone="error" className="mb-0">
          {getErrorDetail(mutation.error)}
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
