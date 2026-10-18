import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  getDriverAssignability,
  getDriverOnboarding,
  getErrorDetail,
  submitDriverProfile,
  type DriverOnboarding,
} from '@/lib/api';
import { Button, Field, Notice, Select } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { futureDateSchema, LICENCE_CLASSES } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

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
      <h1 className="text-2xl font-bold sm:text-3xl">{t('driverOnboarding.title')}</h1>
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

      {step === 'licence' ? <LicenceStep onSaved={refresh} /> : null}

      {step === 'complete' ? (
        <div className="mt-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--status-ok)]">
            {t('driverOnboarding.activeTitle')}
          </h2>
          <ul className="text-sm text-clox-mute">
            <li>
              {t('driverOnboarding.licenceLine', {
                licenceClass: data.driver.licenceClass,
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

function LicenceStep({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useTranslation();

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

  const form = useForm<LicenceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      licenceNo: '',
      licenceClass: 'C',
      licenceExpiry: '2030-12-31',
      nhvrAcknowledged: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: LicenceForm) =>
      submitDriverProfile({
        licenceNo: values.licenceNo.trim(),
        licenceClass: values.licenceClass,
        licenceExpiry: values.licenceExpiry,
        nhvrAcknowledged: true,
      }),
    onSuccess: () => onSaved(),
  });

  return (
    <form
      className="mt-8 max-w-lg"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
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
            {c}
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
        <Notice tone="error" className="mb-4">
          {getErrorDetail(mutation.error)}
        </Notice>
      ) : null}
      <Button type="submit" variant="cta" disabled={mutation.isPending}>
        {mutation.isPending ? t('submitting') : t('driverOnboarding.submitAndActivate')}
      </Button>
    </form>
  );
}

/** Keep type import used for future steps */
export type { DriverOnboarding };
