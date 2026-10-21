import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { acceptDriverInvite, getErrorDetail, peekDriverInvite } from '@/lib/api';
import { clearBrowserSession } from '@/lib/auth-session';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Notice } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';

export function DriverInvitePage() {
  const { t } = useTranslation('common');
  const { token = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    void clearBrowserSession();
  }, []);

  const peek = useQuery({
    queryKey: ['driver', 'invite', token],
    queryFn: () => peekDriverInvite(token),
    enabled: Boolean(token),
  });

  const accept = useMutation({
    mutationFn: async () => {
      await clearBrowserSession();
      return acceptDriverInvite(token);
    },
    onSuccess: (data) => {
      navigate(`/login?email=${encodeURIComponent(data.email)}`, { replace: true });
    },
  });

  if (!token) {
    return (
      <main className="auth-shell mx-auto flex max-w-lg flex-col justify-center px-6 py-12">
        <Notice tone="error">{t('driverInvite.missingToken')}</Notice>
      </main>
    );
  }

  if (peek.isLoading) return <LoadingBlock label={t('driverInvite.loading')} />;

  if (peek.isError) {
    return (
      <main className="auth-shell mx-auto flex max-w-lg flex-col justify-center px-6 py-12">
        <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        <h1 className="mt-4 font-display text-2xl font-bold text-clox-ink">
          {t('driverInvite.unavailableTitle')}
        </h1>
        <Notice tone="error" className="mt-4">
          {getErrorDetail(peek.error)}
        </Notice>
        <Link to="/login" className="clox-btn clox-btn-secondary mt-6 inline-flex">
          {t('backToLogin')}
        </Link>
      </main>
    );
  }

  const data = peek.data!;

  return (
    <main
      className="auth-shell mx-auto flex max-w-lg flex-col justify-center px-6 py-12"
      data-role="default"
      data-theme="ops"
    >
      <div className="clox-card p-6 shadow-clox-2 sm:p-8">
        <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-clox-faint">
          {t('driverInvite.prefix')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-clox-ink">
          {t('driverInvite.title')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-clox-mute">
          <span className="font-semibold text-clox-ink">{data.companyName}</span>{' '}
          {t('driverInvite.invited')}{' '}
          <span className="font-semibold text-clox-ink">{data.name ?? data.email}</span>{' '}
          {t('driverInvite.toDriveOn')}
        </p>
        <ul className="mt-6 space-y-1.5 text-sm text-clox-mute">
          <li>{t('driverInvite.emailLine', { email: data.email })}</li>
          <li>
            {t('driverInvite.statusLabel')}: {data.status}
            {data.expired ? ` · ${t('driverInvite.expired')}` : ''}
            {data.consumed ? ` · ${t('driverInvite.consumed')}` : ''}
          </li>
        </ul>
        <Notice tone="info" className="mt-4">
          {t('driverInvite.otpNote')}
        </Notice>
        {accept.isError ? (
          <Notice tone="error" className="mt-4">
            {getErrorDetail(accept.error)}
          </Notice>
        ) : null}
        {!data.canAccept ? (
          <Notice tone="warn" className="mt-4">
            {data.expired
              ? t('driverInvite.expired')
              : data.consumed
                ? t('driverInvite.consumed')
                : t('driverInvite.unavailableTitle')}
          </Notice>
        ) : null}
        <Button
          type="button"
          variant="cta"
          size="block"
          className="mt-6"
          disabled={!data.canAccept || accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? t('loading') : t('driverInvite.acceptButton')}
        </Button>
        {!data.canAccept ? (
          <Link
            to="/login"
            className="clox-btn clox-btn-secondary mt-3 inline-flex w-full justify-center"
          >
            {t('goToLogin')}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
