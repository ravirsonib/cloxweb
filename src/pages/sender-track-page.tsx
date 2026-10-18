import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getErrorDetail, getSenderTrack, listSenderJobs } from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import { Notice } from '@/components/ui';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function SenderTrackPage() {
  const { t } = useTranslation('common');
  const { jobId = '' } = useParams();
  const role = useAuthStore((s) => s.role);

  const track = useQuery({
    queryKey: ['trips', 'track', jobId],
    queryFn: () => getSenderTrack(jobId),
    enabled: role === AppRole.SENDER && Boolean(jobId),
    refetchInterval: 5000,
  });

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (track.isLoading) return <LoadingBlock label={t('track.loading')} />;

  const data = track.data;

  return (
    <div>
      <Link to="/jobs" className="text-sm font-semibold text-clox-orange hover:underline">
        ← {t('track.backToJobs')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink">{t('track.title')}</h1>
      {track.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(track.error)}
        </Notice>
      ) : null}

      {data && !data.visible ? (
        <Notice tone="warn" className="mt-6">
          {data.message ?? t('track.notLiveYet')} ({data.code})
        </Notice>
      ) : null}

      {data?.stopsProgress && data.stopsProgress.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-display font-semibold text-clox-ink">{t('trips.stopsProgressTitle')}</h2>
          <ul className="mt-2 space-y-1.5">
            {data.stopsProgress.map((row) => {
              const stop = row.stop;
              const overage = row.waitOverageMinutes > 0;
              return (
                <li
                  key={row.id}
                  className="rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2 text-xs text-clox-mute"
                >
                  <span className="font-medium text-clox-ink">
                    #{stop?.sequence ?? 0} {stop?.stopType ?? '—'}
                    {stop?.suburb ? ` · ${stop.suburb}` : ''}
                  </span>
                  {row.enteredAt ? (
                    <span className="ml-2">
                      {t('trips.stopEntered', {
                        time: new Date(row.enteredAt).toLocaleTimeString(),
                      })}
                    </span>
                  ) : null}
                  {overage ? (
                    <span className="ml-2 text-clox-orange">
                      {t('trips.stopOverage', { min: row.waitOverageMinutes })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {data?.surcharges && data.surcharges.some((s) => s.status === 'PENDING_PAYMENT') ? (
        <Notice tone="warn" className="mt-4" title={t('trips.pendingSurchargesTitle')}>
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {data.surcharges
              .filter((s) => s.status === 'PENDING_PAYMENT')
              .map((s) => (
                <li key={s.id}>
                  {s.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass')} — $
                  {(s.amountIncGstCents / 100).toFixed(2)} inc GST
                </li>
              ))}
          </ul>
          <Link to="/surcharges" className="mt-2 inline-block text-xs font-semibold text-clox-orange hover:underline">
            {t('nav.surcharges')} →
          </Link>
        </Notice>
      ) : null}

      {data?.visible ? (
        <div className="mt-6 space-y-3 text-sm text-clox-mute">
          <p>
            {t('track.statusLabel', { status: data.tripStatus })}
            {data.onBreak ? ` · ${t('track.driverOnBreak')}` : ''}
          </p>
          {data.latest ? (
            <Notice tone="success">
              {t('track.latest', {
                lat: data.latest.lat.toFixed(5),
                lng: data.latest.lng.toFixed(5),
                time: new Date(data.latest.recordedAt).toLocaleTimeString(),
              })}
            </Notice>
          ) : (
            <p className="text-clox-faint">{t('track.noPingsYet')}</p>
          )}
          <ul className="font-mono text-xs text-clox-faint">
            {(data.locations ?? []).slice(0, 8).map((l, i) => (
              <li key={`${l.recordedAt}-${i}`}>
                {l.lat.toFixed(4)}, {l.lng.toFixed(4)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-clox-faint">{t('track.mapDeferredHint')}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Helper link list from jobs that may have trips */
export function SenderJobsTrackLinks() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const jobs = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: () => listSenderJobs(),
    enabled: role === AppRole.SENDER,
  });
  if (role !== AppRole.SENDER) return null;
  const assigned = (jobs.data ?? []).filter(
    (j) => j.status === 'ASSIGNED' || j.status === 'IN_TRANSIT' || j.status === 'COMPLETED',
  );
  if (assigned.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-sm text-clox-mute">{t('track.trackAfterStart')}</p>
      <ul className="mt-2 space-y-1">
        {assigned.map((j) => (
          <li key={j.id}>
            <Link to={`/jobs/${j.id}/track`} className="font-semibold text-clox-orange hover:underline">
              {j.title ?? j.id.slice(0, 8)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
