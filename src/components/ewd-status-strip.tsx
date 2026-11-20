import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getEwdStatus, type EwdFatigueStatus } from '@/lib/api/ewd';
import { getErrorDetail } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function toneForStatus(status: EwdFatigueStatus | undefined): 'ok' | 'warn' | 'danger' {
  if (!status) return 'ok';
  if (status.potentialBreaches.length > 0) return 'danger';
  if (
    status.currentActivity === 'WORK' &&
    status.minutesUntilBreakRequired <= 30
  ) {
    return 'warn';
  }
  return 'ok';
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function EwdStatusStrip({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const enabled = role === AppRole.DRIVER;

  const statusQuery = useQuery({
    queryKey: ['driver', 'ewd', 'status'],
    queryFn: getEwdStatus,
    enabled,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 30_000;
      return data.currentActivity === 'WORK' ? 15_000 : 30_000;
    },
    retry: 1,
  });

  if (!enabled) return null;

  const status = statusQuery.data;
  const tone = toneForStatus(status);

  return (
    <Link
      to="/driver/ewd"
      className={cn(
        'block rounded-clox-md border px-3 py-2 text-sm transition hover:opacity-95',
        tone === 'ok' && 'border-emerald-600/40 bg-emerald-500/10 text-clox-ink',
        tone === 'warn' && 'border-amber-500/50 bg-amber-500/15 text-clox-ink',
        tone === 'danger' && 'border-red-500/50 bg-red-500/15 text-clox-ink',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-clox-mute">
          {t('driverEwd.stripTitle', { defaultValue: 'Work diary (pilot)' })}
        </p>
        <span className="text-xs font-medium text-clox-orange">
          {t('driverEwd.openDiary', { defaultValue: 'Open' })}
        </span>
      </div>
      {statusQuery.isError ? (
        <p className="mt-1 text-xs text-red-700">{getErrorDetail(statusQuery.error)}</p>
      ) : statusQuery.isLoading || !status ? (
        <p className="mt-1 text-xs text-clox-mute">
          {t('driverEwd.loadingStatus', { defaultValue: 'Loading fatigue status…' })}
        </p>
      ) : (
        <div className="mt-1 space-y-0.5">
          <p className="font-medium">
            {status.currentActivity === 'WORK'
              ? t('driverEwd.activityWork', { defaultValue: 'WORK' })
              : t('driverEwd.activityRest', { defaultValue: 'REST' })}
            {' · '}
            {formatMins(status.currentDurationMinutes)}
            {status.currentActivity === 'WORK' ? (
              <>
                {' · '}
                {t('driverEwd.untilBreak', {
                  defaultValue: '{{mins}} to break',
                  mins: formatMins(status.minutesUntilBreakRequired),
                })}
              </>
            ) : null}
          </p>
          {status.potentialBreaches[0] ? (
            <p className="text-xs text-red-700">{status.potentialBreaches[0].description}</p>
          ) : (
            <p className="text-xs text-clox-mute">
              {t('driverEwd.totals24h', {
                defaultValue: '24h work {{work}} · rest {{rest}}',
                work: formatMins(status.workMinutesLast24h),
                rest: formatMins(status.restMinutesLast24h),
              })}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
