import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getErrorDetail, requestOtp, verifyOtp } from '@/lib/api';
import { fieldClassName, primaryButtonClassName } from '@/components/admin-shell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAuthStore } from '@/stores/auth-store';

type EmailForm = { email: string };
type OtpForm = { code: string };

export function LoginPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>({ defaultValues: { email: '' } });
  const otpForm = useForm<OtpForm>({ defaultValues: { code: '' } });

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
    mutationFn: (payload: OtpForm) =>
      verifyOtp({ email, code: payload.code.trim() }),
    onSuccess: (tokens) => {
      setSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: tokens.admin.email,
        adminId: tokens.admin.id,
        adminName: tokens.admin.name,
      });
      navigate('/', { replace: true });
    },
  });

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  const pending = requestMutation.isPending || verifyMutation.isPending;
  const error =
    requestMutation.error || verifyMutation.error
      ? getErrorDetail(requestMutation.error ?? verifyMutation.error)
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clox-orange">
            {t('brand')}
          </p>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-4 text-3xl font-bold">{t('admin.loginTitle')}</h1>
        <p className="mt-3 text-sm text-slate-300">
          {step === 'email' ? t('admin.loginHint') : t('admin.otpHint')}
        </p>

        {step === 'email' ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={emailForm.handleSubmit((values) => requestMutation.mutate(values))}
            noValidate
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">
                {t('email')}
              </label>
              <input
                type="email"
                autoComplete="email"
                className={fieldClassName}
                placeholder="super-admin@email.com"
                {...emailForm.register('email', { required: true })}
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            ) : null}
            <button type="submit" disabled={pending} className={`${primaryButtonClassName} w-full`}>
              {pending ? t('loading') : t('admin.sendCode')}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={otpForm.handleSubmit((values) => verifyMutation.mutate(values))}
            noValidate
          >
            <p className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
              {t('admin.codeSentTo')} <span className="font-medium text-white">{email}</span>
            </p>
            {debugCode ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                  {t('admin.debugOtpLabel')}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.35em] text-white">
                  {debugCode}
                </p>
                <p className="mt-1 text-xs text-amber-200/80">{t('admin.debugOtpHint')}</p>
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">
                {t('admin.loginCode')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={`${fieldClassName} tracking-[0.3em]`}
                placeholder="••••••"
                maxLength={8}
                {...otpForm.register('code', { required: true })}
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            ) : null}
            <button type="submit" disabled={pending} className={`${primaryButtonClassName} w-full`}>
              {pending ? t('loading') : t('admin.verifyCode')}
            </button>
            <button
              type="button"
              className="w-full text-sm text-slate-400 hover:text-white"
              onClick={() => {
                setStep('email');
                setDebugCode(null);
                requestMutation.reset();
                verifyMutation.reset();
              }}
            >
              {t('admin.useDifferentEmail')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
