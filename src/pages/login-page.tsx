import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { applyAuthTokensToStore, getErrorDetail, requestOtp, verifyOtp } from '@/lib/api';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button, Field, Notice } from '@/components/ui';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type EmailForm = { email: string };
type OtpForm = { code: string };

const QA_HINTS = [
  'cloxadmin@yopmail.com — Super',
  'state.vic@yopmail.com — State VIC',
  'local.mel@yopmail.com — Local MEL',
  'sender.qa@yopmail.com — Sender',
  'carrier.qa@yopmail.com — Carrier',
  'driver.qa@yopmail.com — Driver',
];

export function LoginPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail =
    typeof (location.state as { email?: string } | null)?.email === 'string'
      ? (location.state as { email: string }).email
      : '';
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState(prefillEmail);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const emailSchema = z.object({
    email: z
      .string()
      .trim()
      .min(1, t('login.emailRequired'))
      .email(t('login.emailInvalid')),
  });

  const otpSchema = z.object({
    code: z
      .string()
      .trim()
      .min(1, t('login.otpRequired'))
      .regex(/^\d{4,8}$/, t('login.otpInvalid')),
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: prefillEmail },
  });
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const requestMutation = useMutation({
    mutationFn: (payload: EmailForm) => requestOtp({ email: payload.email.trim() }),
    onSuccess: (data, variables) => {
      setEmail(variables.email.trim().toLowerCase());
      setStep('otp');
      const code = data.debugCode?.trim() || null;
      setDebugCode(code);
      otpForm.reset({ code: code || '' });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: OtpForm) => verifyOtp({ email, code: payload.code.trim() }),
    onSuccess: (tokens) => {
      applyAuthTokensToStore(tokens);
      const nextRole = tokens.principal?.role ?? tokens.admin?.role;
      navigate(
        nextRole === 'SENDER'
          ? '/sender/onboarding'
          : nextRole === 'TRANSPORT_COMPANY'
            ? '/carrier/onboarding'
            : '/',
        { replace: true },
      );
    },
  });

  if (accessToken) {
    return (
      <Navigate
        to={
          role === AppRole.SENDER
            ? '/sender/onboarding'
            : role === AppRole.TRANSPORT_COMPANY
              ? '/carrier/onboarding'
              : '/'
        }
        replace
      />
    );
  }

  const pending = requestMutation.isPending || verifyMutation.isPending;
  const error =
    requestMutation.error || verifyMutation.error
      ? getErrorDetail(requestMutation.error ?? verifyMutation.error)
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-clox-bg px-4 py-10 text-clox-text sm:px-6">
      <div className="clox-card w-full max-w-md p-6 shadow-clox-2 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo variant="default" className="h-9 w-auto object-contain object-left" />
          <LanguageSwitcher />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold text-clox-ink">{t('login.title')}</h1>
        <p className="mt-3 text-sm text-clox-mute">
          {step === 'email' ? t('login.emailHint') : t('login.otpHint')}
        </p>

        <Notice tone="info" className="mt-4" title={t('login.qaSeeds')}>
          <ul className="mt-1 space-y-0.5 font-mono text-[11.5px]">
            {QA_HINTS.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </Notice>

        {step === 'email' ? (
          <form
            className="mt-6"
            onSubmit={emailForm.handleSubmit((values) => requestMutation.mutate(values))}
            noValidate
          >
            <Field
              type="email"
              autoComplete="email"
              label={t('email')}
              required
              placeholder="name@yopmail.com"
              error={emailForm.formState.errors.email?.message}
              {...emailForm.register('email')}
            />
            {error ? <Notice tone="error" className="mb-4">{error}</Notice> : null}
            <Button type="submit" variant="cta" size="block" disabled={pending}>
              {pending ? t('loading') : t('login.sendCode')}
            </Button>
          </form>
        ) : (
          <form
            className="mt-6"
            onSubmit={otpForm.handleSubmit((values) => verifyMutation.mutate(values))}
            noValidate
          >
            <Notice tone="info" className="mb-4">
              {t('login.codeSentTo')} <span className="font-semibold text-clox-ink">{email}</span>
            </Notice>
            {debugCode ? (
              <Notice tone="warn" className="mb-4" title={t('login.devOtp')}>
                <p className="font-mono text-2xl font-bold tracking-[0.35em] text-clox-ink">
                  {debugCode}
                </p>
              </Notice>
            ) : null}
            <Field
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              label={t('login.loginCode')}
              required
              placeholder="••••••"
              maxLength={8}
              className="tracking-[0.3em]"
              error={otpForm.formState.errors.code?.message}
              {...otpForm.register('code')}
            />
            {error ? <Notice tone="error" className="mb-4">{error}</Notice> : null}
            <Button type="submit" variant="cta" size="block" disabled={pending}>
              {pending ? t('loading') : t('login.verify')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="block"
              className="mt-2"
              onClick={() => {
                setStep('email');
                setDebugCode(null);
                requestMutation.reset();
                verifyMutation.reset();
              }}
            >
              {t('login.useDifferentEmail')}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-clox-mute">
          {t('login.newSender')}{' '}
          <Link to="/register/sender" className="font-semibold text-clox-orange hover:underline">
            {t('login.register')}
          </Link>
          {' · '}
          {t('login.newCarrier')}{' '}
          <Link to="/register/carrier" className="font-semibold text-clox-orange hover:underline">
            {t('login.register')}
          </Link>
        </p>
      </div>
    </main>
  );
}
