import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  downloadBlob,
  fetchTripDocumentBlob,
  getErrorDetail,
  getSenderTrack,
  listSenderJobs,
} from '@/lib/api';
import type { TripDocumentKind } from '@/lib/api/trips';
import { LoadingBlock } from '@/components/status-blocks';
import { Button, Notice, useToast } from '@/components/ui';
import { RouteMap, useTrackingSocket, type MapStopPin, type MapTruckPosition } from '@/features/maps';
import { formatDollars } from '@/lib/currency';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function SenderTrackPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const { jobId = '' } = useParams();
  const role = useAuthStore((s) => s.role);

  const [wsConnected, setWsConnected] = useState(false);

  const track = useQuery({
    queryKey: ['trips', 'track', jobId],
    queryFn: () => getSenderTrack(jobId),
    enabled: role === AppRole.SENDER && Boolean(jobId),
    // Prefer WS when connected (20s background sync for stops/POD/break); 5s poll fallback when disconnected
    refetchInterval: wsConnected ? 20_000 : 5_000,
  });

  const data = track.data;
  const isLiveTracking = Boolean(data?.visible && data?.tripId && !data?.onBreak);

  const socket = useTrackingSocket({
    tripId: data?.tripId ?? null,
    jobId: jobId || null,
    enabled: role === AppRole.SENDER && isLiveTracking,
  });

  useEffect(() => {
    setWsConnected(socket.connected);
  }, [socket.connected]);

  const downloadDoc = useMutation({
    mutationFn: async (kind: TripDocumentKind) => {
      const tripId = track.data?.tripId;
      if (!tripId) throw new Error('No trip');
      const blob = await fetchTripDocumentBlob(tripId, kind);
      const names: Record<TripDocumentKind, string> = {
        pod: `CLOX-pod-${jobId.slice(0, 8)}.pdf`,
        'tax-invoice': `CLOX-tax-invoice-${jobId.slice(0, 8)}.pdf`,
        'run-sheet': `CLOX-run-sheet-${jobId.slice(0, 8)}.pdf`,
      };
      downloadBlob(blob, names[kind]);
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const effectiveEtaMinutes = useMemo(() => {
    if (!data?.visible || data.onBreak) return null;
    if (socket.latestEta && typeof socket.latestEta.etaMinutes === 'number') {
      return socket.latestEta.etaMinutes;
    }
    return data.etaMinutes ?? null;
  }, [data?.visible, data?.onBreak, data?.etaMinutes, socket.latestEta]);

  const effectiveNextStopId = useMemo(() => {
    if (!data?.visible || data.onBreak) return null;
    return socket.latestEta?.nextStopId ?? data.nextStopId ?? null;
  }, [data?.visible, data?.onBreak, data?.nextStopId, socket.latestEta]);

  const effectiveLatest = useMemo(() => {
    if (!data?.visible || data.onBreak) return null;
    const wsLoc = socket.latestLocation;
    const restLoc = data.latest;
    if (wsLoc) {
      const wsTime = Date.parse(wsLoc.timestamp);
      const restTime = restLoc ? Date.parse(restLoc.recordedAt) : 0;
      if (!Number.isNaN(wsTime) && wsTime >= restTime) {
        return {
          lat: wsLoc.snappedLat ?? wsLoc.lat,
          lng: wsLoc.snappedLng ?? wsLoc.lng,
          heading: wsLoc.heading ?? null,
          recordedAt: wsLoc.timestamp,
        };
      }
    }
    if (restLoc) {
      return {
        lat: restLoc.lat,
        lng: restLoc.lng,
        heading: null,
        recordedAt: restLoc.recordedAt,
      };
    }
    return null;
  }, [data?.visible, data?.onBreak, data?.latest, socket.latestLocation]);

  const mapStops = useMemo<MapStopPin[]>(() => {
    const stops = data?.job?.stops ?? [];
    return stops
      .filter(
        (s): s is typeof s & { lat: number; lng: number } =>
          typeof s.lat === 'number' && typeof s.lng === 'number',
      )
      .map((s) => ({
        id: s.id,
        sequence: s.sequence,
        stopType: s.stopType,
        suburb: s.suburb,
        lat: s.lat,
        lng: s.lng,
        isNext: Boolean(effectiveNextStopId && s.id === effectiveNextStopId),
      }));
  }, [data?.job?.stops, effectiveNextStopId]);

  const mapTruck = useMemo<MapTruckPosition | null>(() => {
    if (!effectiveLatest || data?.onBreak) return null;
    return {
      lat: effectiveLatest.lat,
      lng: effectiveLatest.lng,
      heading: effectiveLatest.heading,
      paused: Boolean(data?.onBreak),
    };
  }, [effectiveLatest, data?.onBreak]);

  if (role !== AppRole.SENDER) return <Navigate to="/" replace />;
  if (track.isLoading) return <LoadingBlock label={t('track.loading')} />;

  const hasDocs =
    Boolean(data?.podStorageKey) ||
    Boolean(data?.taxInvoiceStorageKey) ||
    Boolean(data?.runSheetStorageKey);

  const hasMapContent =
    Boolean(data?.visible) &&
    (Boolean(data?.route?.encodedPolyline) || mapStops.length > 0 || Boolean(mapTruck));

  return (
    <div>
      <Link to="/jobs" className="text-sm font-semibold text-clox-orange hover:underline">
        ← {t('track.backToJobs')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-clox-ink">{t('track.title')}</h1>
        {data?.visible ? (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${
                data.onBreak
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : socket.connected
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-clox-border bg-clox-surface text-clox-mute'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  data.onBreak
                    ? 'bg-amber-500'
                    : socket.connected
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                }`}
              />
              {data.onBreak
                ? t('track.driverOnBreak')
                : socket.connected
                  ? t('track.liveConnected', { defaultValue: 'Live' })
                  : t('track.pollingFallback', { defaultValue: 'Updating every 5s' })}
            </span>
          </div>
        ) : null}
      </div>

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

      {data?.visible ? (
        <div className="mt-4 space-y-3">
          {data.onBreak ? (
            <Notice tone="warn">
              {t('track.onBreakPausedHint', {
                defaultValue:
                  'Driver is currently on a rest break. Live location and ETA updates are paused until the break ends.',
              })}
            </Notice>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-clox-mute">
            <span>{t('track.statusLabel', { status: data.tripStatus })}</span>
            {effectiveEtaMinutes != null && !data.onBreak ? (
              <span className="font-semibold text-clox-ink">
                {t('track.etaSummary', {
                  defaultValue: 'ETA ~{{min}} min',
                  min: effectiveEtaMinutes,
                })}
                {data.distanceKmRemaining != null
                  ? ` (${data.distanceKmRemaining} km)`
                  : ''}
              </span>
            ) : null}
          </div>

          {hasMapContent ? (
            <RouteMap
              encodedPolyline={data.onBreak ? null : (data.route?.encodedPolyline ?? null)}
              stops={mapStops}
              truck={mapTruck}
              followTruck={!data.onBreak}
              className="h-80 sm:h-96"
              ariaLabel={t('track.title')}
            />
          ) : null}

          {!data.onBreak && effectiveLatest ? (
            <Notice tone="success">
              {t('track.latest', {
                lat: effectiveLatest.lat.toFixed(5),
                lng: effectiveLatest.lng.toFixed(5),
                time: new Date(effectiveLatest.recordedAt).toLocaleTimeString(),
              })}
            </Notice>
          ) : !data.onBreak ? (
            <p className="text-sm text-clox-faint">{t('track.noPingsYet')}</p>
          ) : null}
        </div>
      ) : null}

      {data?.stopsProgress && data.stopsProgress.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-display font-semibold text-clox-ink">{t('trips.stopsProgressTitle')}</h2>
          <ul className="mt-2 space-y-1.5">
            {data.stopsProgress.map((row) => {
              const stop = row.stop;
              const overage = row.waitOverageMinutes > 0;
              const isDropoff = stop?.stopType === 'DROPOFF';
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
                  {isDropoff && row.podStatus ? (
                    <span className="ml-2 font-mono text-clox-ink">
                      {t('trips.podStatus')}: {row.podStatus}
                      {row.signerName ? ` · ${row.signerName}` : ''}
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

      {data?.stopsProgress?.some((r) => r.podStatus === 'FINALIZED') || hasDocs ? (
        <Notice tone="success" className="mt-4" title={t('trips.podFinalized')}>
          {data?.tripId && hasDocs ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.podStorageKey ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={downloadDoc.isPending}
                  onClick={() => downloadDoc.mutate('pod')}
                >
                  {t('trips.downloadPod')}
                </Button>
              ) : null}
              {data.taxInvoiceStorageKey ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={downloadDoc.isPending}
                  onClick={() => downloadDoc.mutate('tax-invoice')}
                >
                  {t('trips.downloadTaxInvoice')}
                </Button>
              ) : null}
              {data.runSheetStorageKey ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={downloadDoc.isPending}
                  onClick={() => downloadDoc.mutate('run-sheet')}
                >
                  {t('trips.downloadRunSheet')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Notice>
      ) : null}

      {data?.surcharges && data.surcharges.some((s) => s.status === 'PENDING_PAYMENT') ? (
        <Notice tone="warn" className="mt-4" title={t('trips.pendingSurchargesTitle')}>
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {data.surcharges
              .filter((s) => s.status === 'PENDING_PAYMENT')
              .map((s) => (
                <li key={s.id}>
                  {s.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass')} —{' '}
                  {formatDollars(s.amountIncGstCents)} inc GST
                </li>
              ))}
          </ul>
          <Link to="/surcharges" className="mt-2 inline-block text-xs font-semibold text-clox-orange hover:underline">
            {t('nav.surcharges')} →
          </Link>
        </Notice>
      ) : null}

      {data?.visible && !data.onBreak && (data.locations?.length ?? 0) > 0 ? (
        <details className="mt-4 rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2 text-xs text-clox-mute">
          <summary className="cursor-pointer font-medium text-clox-ink">
            {t('track.recentPings', {
              defaultValue: 'Recent GPS pings ({{count}})',
              count: Math.min(8, data.locations?.length ?? 0),
            })}
          </summary>
          <ul className="mt-2 space-y-0.5 font-mono text-clox-faint">
            {(data.locations ?? []).slice(0, 8).map((l, i) => (
              <li key={`${l.recordedAt}-${i}`}>
                {l.lat.toFixed(4)}, {l.lng.toFixed(4)} ·{' '}
                {new Date(l.recordedAt).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </details>
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
