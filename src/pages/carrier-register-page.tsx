import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorDetail, registerCarrier } from '@/lib/api';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Field, Notice } from '@/components/ui';

type Form = {
  name: string;
  email: string;
  phone: string;
  acceptedTerms: boolean;
};

export function CarrierRegisterPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const schema = z.object({
    name: z.string().trim().min(1, t('validation.companyNameRequired')),
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid')),
    phone: z.string(),
    acceptedTerms: z.boolean().refine((value) => value === true, {
      message: t('validation.termsRequired'),
    }),
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', acceptedTerms: false },
  });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      registerCarrier({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        acceptedTerms: values.acceptedTerms,
      }),
    onSuccess: (_data, values) => {
      navigate('/login', { replace: true, state: { email: values.email.trim().toLowerCase() } });
    },
  });

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-clox-bg px-4 py-10 text-clox-text sm:px-6"
      data-role="carrier"
    >
      <div className="clox-card w-full max-w-md p-6 shadow-clox-2 sm:p-8">
        <BrandLogo variant="default" className="h-9 w-auto object-contain object-left" />
        <h1 className="mt-4 font-display text-3xl font-bold text-clox-ink">
          {t('carrierRegister.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">{t('carrierRegister.subtitle')}</p>

        <form
          className="mt-6"
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          noValidate
        >
          <Field
            label={t('carrierRegister.nameLabel')}
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Field
            type="email"
            label={t('email')}
            required
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Field
            label={t('phoneOptional')}
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
          <label className="mb-4 flex items-start gap-2 text-sm text-clox-mute">
            <input type="checkbox" className="mt-1 accent-clox-accent" {...form.register('acceptedTerms')} />
            <span>
              {t('acceptTerms')}
              {form.formState.errors.acceptedTerms?.message ? (
                <span className="mt-1 block text-[12px] font-medium text-[var(--status-danger)]" role="alert">
                  {form.formState.errors.acceptedTerms.message}
                </span>
              ) : null}
            </span>
          </label>

          {mutation.isError ? (
            <Notice tone="error" className="mb-4">
              {getErrorDetail(mutation.error)}
            </Notice>
          ) : null}

          <Button type="submit" variant="cta" size="block" disabled={mutation.isPending}>
            {mutation.isPending ? t('creating') : t('carrierRegister.createAccount')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-clox-mute">
          {t('alreadyRegistered')}{' '}
          <Link to="/login" className="font-semibold text-clox-orange hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </div>
    </main>
  );
}
