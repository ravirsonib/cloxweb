import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { acceptAdminInvite, getErrorDetail, peekAdminInvite } from '@/lib/api';
import { clearBrowserSession } from '@/lib/auth-session';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Notice } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';

export function AdminInvitePage() {
  const { t } = useTranslation('common');
  const { token = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    void clearBrowserSession();
  }, []);

  const peek = useQuery({
    queryKey: ['ops', 'admin-invite', token],
    queryFn: () => peekAdminInvite(token),
    enabled: Boolean(token),
  });

  const accept = useMutation({
    mutationFn: async () => {
      await clearBrowserSession();
      return acceptAdminInvite(token);
    },
    onSuccess: (data) => {
      navigate('/login', { replace: true, state: { email: data.email } });
    },
  });

  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <Notice tone="error">{t('adminInvite.missingToken')}</Notice>
      </main>
    );
  }

  if (peek.isLoading) return <LoadingBlock label={t('adminInvite.loading')} />;

  if (peek.isError) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        <h1 className="mt-4 font-display text-2xl font-bold text-clox-ink">
          {t('adminInvite.unavailableTitle')}
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-clox-bg px-6 py-12 text-clox-text">
      <div className="clox-card p-6 shadow-clox-2 sm:p-8">
        <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-clox-faint">
          {t('adminInvite.prefix')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-clox-ink">
          {t('adminInvite.title')}
        </h1>
        <p className="mt-3 text-clox-mute">
          {t('adminInvite.invitedAs', {
            name: data.name ?? data.email,
            role: data.role,
            company: data.companyName ?? t('dash'),
          })}
        </p>
        <ul className="mt-6 space-y-1 text-sm text-clox-mute">
          <li>{t('adminInvite.emailLine', { email: data.email })}</li>
          <li>
            {t('adminInvite.scopeLine', {
              region: data.regionCode ?? t('dash'),
              territory: data.territoryCode ?? t('dash'),
            })}
          </li>
          <li>
            {t('adminInvite.statusLabel')}: {data.status}
            {data.expired ? ` · ${t('adminInvite.expired')}` : ''}
            {data.consumed ? ` · ${t('adminInvite.consumed')}` : ''}
          </li>
        </ul>
        <Notice tone="info" className="mt-4">
          {t('adminInvite.otpNote')}
        </Notice>
        {accept.isError ? (
          <Notice tone="error" className="mt-4">
            {getErrorDetail(accept.error)}
          </Notice>
        ) : null}
        {!data.canAccept ? (
          <Notice tone="warn" className="mt-4">
            {data.expired
              ? t('adminInvite.expired')
              : data.consumed
                ? t('adminInvite.consumed')
                : t('adminInvite.unavailableTitle')}
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
          {accept.isPending ? t('loading') : t('adminInvite.acceptButton')}
        </Button>
        {!data.canAccept ? (
          <Link to="/login" className="clox-btn clox-btn-secondary mt-4 inline-flex w-full justify-center">
            {t('backToLogin')}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
