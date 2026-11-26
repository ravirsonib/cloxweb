import { useQuery } from '@tanstack/react-query';
import { BellRing, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingBlock } from '@/components/status-blocks';
import { Button, Notice, StatusPill } from '@/components/ui';
import { getErrorDetail } from '@/lib/api';
import { getPushStats } from '@/lib/api/notifications';

/**
 * Third-party service health & delivery logs panel for Super Admins.
 * Designed as an extensible hub: Mobile Push (FCM) today, ready for Stripe, SMTP,
 * Valhalla/Maps, ABR, and future integrations as separate cards.
 */
export function ServiceHealthPanel() {
  const { t } = useTranslation('common');

  const pushStats = useQuery({
    queryKey: ['admin', 'push-stats'],
    queryFn: ({ signal }) => getPushStats({ signal }),
  });

  return (
    <div className="mt-5 space-y-5">
      <section className="clox-card-elevated space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-clox-orange" />
              <h2 className="text-base font-bold text-clox-ink">
                {t('platformSettings.pushHealthTitle', {
                  defaultValue: 'Mobile Push Notifications (FCM)',
                })}
              </h2>
              {pushStats.data ? (
                <StatusPill
                  tone={
                    !pushStats.data.enabled
                      ? 'neutral'
                      : pushStats.data.mode === 'fcm'
                      ? 'ok'
                      : 'warn'
                  }
                >
                  {!pushStats.data.enabled
                    ? t('platformSettings.pushDisabled', { defaultValue: 'Disabled' })
                    : pushStats.data.mode === 'fcm'
                    ? t('platformSettings.pushLiveFcm', { defaultValue: 'FCM Live' })
                    : t('platformSettings.pushMockMode', { defaultValue: 'Mock Mode' })}
                </StatusPill>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-clox-mute">
              {t('platformSettings.pushHealthSubtitle', {
                defaultValue:
                  'Active registered mobile push tokens and delivery outcomes over the last 24 hours.',
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pushStats.isFetching}
            onClick={() => void pushStats.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pushStats.isFetching ? 'animate-spin' : ''}`} />
            {t('platformSettings.refresh', { defaultValue: 'Refresh' })}
          </Button>
        </div>

        {pushStats.isLoading ? (
          <LoadingBlock label={t('loading')} />
        ) : pushStats.isError ? (
          <Notice tone="error">{getErrorDetail(pushStats.error)}</Notice>
        ) : pushStats.data ? (
          <div className="space-y-4">
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
                <p className="text-xs font-medium text-clox-mute">Active Devices</p>
                <p className="mt-1 font-mono text-2xl font-bold text-clox-ink">
                  {pushStats.data.activeDevices.total}
                </p>
                <p className="mt-1 text-[11px] text-clox-mute">
                  Android {pushStats.data.activeDevices.android} · iOS{' '}
                  {pushStats.data.activeDevices.ios} · Web {pushStats.data.activeDevices.web}
                </p>
              </div>
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
                <p className="text-xs font-medium text-clox-mute">Sent (24h)</p>
                <p className="mt-1 font-mono text-2xl font-bold text-clox-ink">
                  {pushStats.data.last24h.sent}
                </p>
                <p className="mt-1 text-[11px] text-clox-mute">
                  Skipped: {pushStats.data.last24h.skipped}
                </p>
              </div>
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
                <p className="text-xs font-medium text-clox-mute">Pending / Retry (24h)</p>
                <p className="mt-1 font-mono text-2xl font-bold text-clox-ink">
                  {pushStats.data.last24h.pending}
                </p>
                <p className="mt-1 text-[11px] text-clox-mute">Queued in outbox</p>
              </div>
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
                <p className="text-xs font-medium text-clox-mute">Failed (24h)</p>
                <p className="mt-1 font-mono text-2xl font-bold text-clox-ink">
                  {pushStats.data.last24h.failed}
                </p>
                <p className="mt-1 text-[11px] text-clox-mute">
                  Stale tokens auto-deactivated
                </p>
              </div>
            </div>

            {pushStats.data.recentFailures.length > 0 ? (
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-clox-mute">
                  Recent Push Failures
                </h3>
                <ul className="mt-2 divide-y divide-clox-border-soft text-xs">
                  {pushStats.data.recentFailures.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-clox-ink">
                          {f.type}
                        </span>
                        {f.platform ? (
                          <span className="ml-2 text-clox-mute">({f.platform})</span>
                        ) : null}
                        <p className="truncate text-clox-mute" title={f.lastError ?? ''}>
                          {f.lastError || 'Unknown error'}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-clox-mute">
                        {f.attempts} attempts · {new Date(f.updatedAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
