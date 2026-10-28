import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  confirmDocument,
  createUploadIntent,
  fetchTripPodArtifactBlob,
  getDriverTrip,
  getErrorDetail,
  getIdentityMe,
  listDriverTrips,
  openTripException,
  tripBreak,
  tripLocation,
  tripMassCheck,
  tripNotifyApproaching,
  tripPodFinalize,
  tripPodPhoto,
  tripPodSignature,
  tripSafetyCheck,
  tripStart,
  uploadDocumentContent,
  type TripExceptionKind,
} from '@/lib/api';
import {
  Button,
  DataCardList,
  Field,
  FileInput,
  LockedCta,
  Notice,
  Select,
  StatusPill,
  dataCardClassName,
  useConfirm,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import {
  fileToCompressedJpegDataUrl,
  fileToCompressedJpegFile,
  maxDocumentUploadBytes,
} from '@/lib/image-data-url';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const EXCEPTION_KINDS: TripExceptionKind[] = [
  'DRIVER_UNAVAILABLE',
  'VEHICLE_BREAKDOWN',
  'ACCIDENT',
  'TRAFFIC',
  'OTHER',
];

export function DriverTripsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const trips = useQuery({
    queryKey: ['trips', 'mine'],
    queryFn: () => listDriverTrips(),
    enabled: role === AppRole.DRIVER,
  });

  if (role !== AppRole.DRIVER) return <Navigate to="/" replace />;
  if (trips.isLoading) return <LoadingBlock label={t('trips.loadingList')} />;

  const items = trips.data ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink">{t('trips.listTitle')}</h1>
      <p className="mt-2 text-sm text-clox-mute">{t('trips.subtitle')}</p>
      {trips.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(trips.error)}
        </Notice>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-clox-faint">{t('trips.empty')}</p>
      ) : (
        <DataCardList
          className="mt-6"
          items={items}
          getKey={(tripItem) => tripItem.id}
          renderItem={(tripItem) => (
            <Link to={`/trips/${tripItem.id}`} className={`block h-full ${dataCardClassName}`}>
              <p className="font-semibold text-clox-ink">
                {tripItem.job?.title ?? tripItem.jobId.slice(0, 8)}
              </p>
              <p className="mt-1 font-mono text-xs text-clox-mute">
                {tripItem.status}
                {tripItem.startedAt &&
                tripItem.status !== 'COMPLETED' &&
                tripItem.status !== 'CANCELLED'
                  ? ` ${t('trips.startedSuffix')}`
                  : ''}
                {tripItem.gates.canStart ? ` · ${t('trips.readyToStart')}` : ''}
              </p>
            </Link>
          )}
        />
      )}
    </div>
  );
}

function startLockReason(
  gates: { paid: boolean; safetyOk: boolean; massOk: boolean; complianceOk?: boolean },
  t: (key: string) => string,
): string {
  const missing: string[] = [];
  if (!gates.paid) missing.push(t('trips.gatePaid'));
  if (!gates.safetyOk) missing.push(t('trips.gateSafety'));
  if (!gates.massOk) missing.push(t('trips.gateMass'));
  if (gates.complianceOk === false) missing.push(t('trips.gateCompliance'));
  return missing.join(', ');
}

export function DriverTripDetailPage() {
  const { t } = useTranslation('common');
  const { tripId = '' } = useParams();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [msg, setMsg] = useState<string | null>(null);
  const [massKg, setMassKg] = useState('');
  const [odometerStartKm, setOdometerStartKm] = useState('');
  const [odometerEndKm, setOdometerEndKm] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportKind, setReportKind] = useState<TripExceptionKind>('DRIVER_UNAVAILABLE');
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [photoDocumentId, setPhotoDocumentId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [attestPresent, setAttestPresent] = useState(false);
  const [podStopId, setPodStopId] = useState<string | null>(null);
  const [localSignaturePreview, setLocalSignaturePreview] = useState<string | null>(null);
  const [localPhotoPreviews, setLocalPhotoPreviews] = useState<string[]>([]);
  const [remoteSignatureUrl, setRemoteSignatureUrl] = useState<string | null>(null);
  const [remotePhotoUrls, setRemotePhotoUrls] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => getDriverTrip(tripId),
    enabled: role === AppRole.DRIVER && Boolean(tripId),
    refetchInterval: (q) => (q.state.data?.onBreak ? 15_000 : false),
  });

  const [breakNowMs, setBreakNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!tripQuery.data?.onBreak) return;
    setBreakNowMs(Date.now());
    const id = window.setInterval(() => setBreakNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tripQuery.data?.onBreak, tripQuery.data?.breakStartedAt]);

  const me = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
    enabled: role === AppRole.DRIVER && showReport,
  });

  const previewStopId =
    podStopId ||
    tripQuery.data?.stopsProgress?.find((p) => p.podStatus !== 'FINALIZED')?.jobStopId ||
    tripQuery.data?.stopsProgress?.[0]?.jobStopId ||
    tripQuery.data?.job?.stops?.find((s) => String(s.stopType).toUpperCase() === 'DROPOFF')?.id ||
    null;
  const previewStopProgress = previewStopId
    ? tripQuery.data?.stopsProgress?.find((p) => p.jobStopId === previewStopId) ?? null
    : null;
  const previewHasSignature = Boolean(
    previewStopProgress?.hasSignature || previewStopProgress?.signedAt,
  );
  const previewPhotoCount = previewStopProgress?.goodsPhotoCount ?? 0;

  useEffect(() => {
    setLocalSignaturePreview(null);
    setLocalPhotoPreviews([]);
  }, [previewStopId]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadPreviews() {
      if (!tripId || !previewStopId) {
        setRemoteSignatureUrl(null);
        setRemotePhotoUrls([]);
        return;
      }

      // Prefer local optimistic previews while remote blobs load.
      setRemoteSignatureUrl(null);
      setRemotePhotoUrls([]);

      if (previewHasSignature) {
        try {
          const blob = await fetchTripPodArtifactBlob(tripId, previewStopId, 'signature');
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          setRemoteSignatureUrl(url);
        } catch {
          // Keep local signature preview if remote fetch fails.
        }
      }

      if (previewPhotoCount < 1) return;

      const urls: string[] = [];
      for (let i = 0; i < previewPhotoCount; i += 1) {
        try {
          const blob = await fetchTripPodArtifactBlob(tripId, previewStopId, 'photo', i);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          urls.push(url);
        } catch {
          // Skip missing individual photos; keep ones that loaded.
        }
      }
      if (!cancelled && urls.length > 0) setRemotePhotoUrls(urls);
    }

    void loadPreviews();
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [tripId, previewStopId, previewHasSignature, previewPhotoCount]);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['trips', tripId] });
    await qc.invalidateQueries({ queryKey: ['trips', 'mine'] });
  }

  async function uploadBreakdownPhoto(file: File) {
    const companyId = me.data?.company?.id;
    if (!companyId) {
      setPhotoError(t('documentsUpload.errorNoCompany'));
      return;
    }
    if (file.type === 'application/pdf') {
      setPhotoError(t('trips.reportPhotoHint'));
      return;
    }
    setPhotoUploading(true);
    setPhotoError(null);
    setPhotoDocumentId(null);
    try {
      // Compress first so phone camera shots do not hit the 10 MB multer ceiling as Network Error.
      const compressed = await fileToCompressedJpegFile(file, {
        maxBytes: maxDocumentUploadBytes(),
      });
      const intent = await createUploadIntent({
        companyId,
        docType: 'OTHER',
        originalFilename: compressed.name,
        mimeType: 'image/jpeg',
        sizeBytes: compressed.size,
      });
      const uploadedRes = await uploadDocumentContent(intent.id, compressed);
      await confirmDocument(intent.id, uploadedRes.contentHash);
      setPhotoDocumentId(intent.id);
    } catch (err) {
      setPhotoError(getErrorDetail(err));
    } finally {
      setPhotoUploading(false);
    }
  }

  const report = useMutation({
    mutationFn: () =>
      openTripException({
        tripId,
        kind: reportKind,
        reasonCode: reportReason.trim() || undefined,
        note: reportNote.trim(),
        gpsLat: tripQuery.data?.latestLocation?.lat,
        gpsLng: tripQuery.data?.latestLocation?.lng,
        photoDocumentId: photoDocumentId ?? undefined,
      }),
    onSuccess: async (res) => {
      setShowReport(false);
      setReportNote('');
      setReportReason('');
      setPhotoDocumentId(null);
      setPhotoError(null);
      setMsg(
        res.forceOffline
          ? t('trips.reportSuccessOffline')
          : t('trips.reportSuccess'),
      );
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const safety = useMutation({
    mutationFn: (passed: boolean) => tripSafetyCheck(tripId, passed),
    onSuccess: async () => {
      setMsg(t('trips.msgSafetyUpdated'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const mass = useMutation({
    mutationFn: () => tripMassCheck(tripId, Number(massKg)),
    onSuccess: async () => {
      setMsg(t('trips.msgMassOk'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const start = useMutation({
    mutationFn: () => tripStart(tripId, Number(odometerStartKm)),
    onSuccess: async () => {
      setMsg(t('trips.msgTripStarted'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const brk = useMutation({
    mutationFn: (onBreak: boolean) => tripBreak(tripId, onBreak),
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const loc = useMutation({
    mutationFn: async () => {
      const stops = tripQuery.data?.job?.stops ?? [];
      const progress = tripQuery.data?.stopsProgress ?? [];
      // Match server evaluateGeofence active-stop rules (dwell until exit).
      const active =
        stops.find((s) => {
          const p = progress.find(
            (sp) => sp.jobStopId === s.id || sp.stop?.sequence === s.sequence,
          );
          if (!p?.arrivalRecorded) return true;
          if (p.enteredAt && !p.exitedAt) return true;
          return false;
        }) ??
        stops.find((s) => s.lat != null && s.lng != null) ??
        stops[0];
      const lat = active?.lat ?? -37.82;
      const lng = active?.lng ?? 144.97;
      const progressRow = active?.id
        ? progress.find((sp) => sp.jobStopId === active.id)
        : undefined;
      const isDropoff = String(active?.stopType ?? '').toUpperCase() === 'DROPOFF';
      const dwelling = Boolean(progressRow?.enteredAt && !progressRow?.exitedAt);
      // Still at pickup/drop dwell → mock "drive away" (outside) so the next stop unlocks.
      if (dwelling) {
        return tripLocation(tripId, lat + 0.01, lng + 0.01); // ~1km outside
      }
      // Dropoff before approaching notify: stay outside so Notify approaching stays available.
      const keepOutsideForNotify =
        isDropoff && !progressRow?.approachingNotifiedAt && !progressRow?.enteredAt;
      if (keepOutsideForNotify) {
        return tripLocation(tripId, lat + 0.006, lng + 0.006); // ~600m outside
      }
      // Enter geofence: antiBounceSamples default is 2 — send two inside samples in one tap.
      const insideLat = lat + 0.00005;
      const insideLng = lng + 0.00005;
      await tripLocation(tripId, insideLat, insideLng);
      return tripLocation(tripId, insideLat, insideLng);
    },
    onSuccess: async (result) => {
      const geofence = (result as { geofence?: { entered?: boolean; stopType?: string } })
        ?.geofence;
      setMsg(
        geofence?.entered && String(geofence.stopType ?? '').toUpperCase() === 'DROPOFF'
          ? t('trips.msgLocationAtDropoff')
          : t('trips.msgLocationPingSent'),
      );
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const notifyApproaching = useMutation({
    mutationFn: (jobStopId?: string) => tripNotifyApproaching(tripId, jobStopId),
    onSuccess: async () => {
      setMsg(t('trips.notifyApproachingDone'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const podSign = useMutation({
    mutationFn: (payload: {
      jobStopId: string;
      signerName: string;
      signatureDataUrl: string;
      receiverPresentAttested: boolean;
    }) => tripPodSignature(tripId, payload),
    onSuccess: async (_data, payload) => {
      setLocalSignaturePreview(payload.signatureDataUrl);
      setMsg(t('trips.podSignatureSaved'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const podPhoto = useMutation({
    mutationFn: (payload: { jobStopId: string; photoDataUrl: string }) =>
      tripPodPhoto(tripId, payload),
    onSuccess: async (_data, payload) => {
      setLocalPhotoPreviews((prev) => [...prev, payload.photoDataUrl]);
      setMsg(t('trips.podPhotoUploaded'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  const podFinalize = useMutation({
    mutationFn: (payload: { jobStopId: string; odometerEndKm?: number }) =>
      tripPodFinalize(tripId, payload.jobStopId, {
        odometerEndKm: payload.odometerEndKm,
      }),
    onSuccess: async () => {
      setMsg(t('trips.podFinalized'));
      await refresh();
    },
    onError: (e) => setMsg(getErrorDetail(e)),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#10192b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [podStopId]);

  if (role !== AppRole.DRIVER) return <Navigate to="/" replace />;
  if (tripQuery.isLoading) return <LoadingBlock label={t('trips.loadingDetail')} />;
  if (tripQuery.isError || !tripQuery.data) {
    return <Notice tone="error">{getErrorDetail(tripQuery.error)}</Notice>;
  }

  const tripData = tripQuery.data;
  const declared =
    tripData.declaredMassKg ?? tripData.job?.chargeableWeightKg ?? tripData.job?.deadWeightKg ?? 0;
  const startLocked = !tripData.gates.canStart;
  const dropoffStops = (tripData.job?.stops ?? []).filter(
    (s) => String(s.stopType).toUpperCase() === 'DROPOFF',
  );
  const progressByStop = new Map(
    (tripData.stopsProgress ?? []).map((p) => [p.jobStopId, p] as const),
  );
  const dropoffProgress = (tripData.stopsProgress ?? []).filter(
    (p) =>
      String(p.stop?.stopType ?? '').toUpperCase() === 'DROPOFF' ||
      dropoffStops.some((s) => s.id === p.jobStopId),
  );
  /** Match API: pick next dropoff that is not yet notified and not yet arrived. */
  const eligibleNotifyStop = dropoffStops.find((s) => {
    const p = s.id
      ? progressByStop.get(s.id)
      : dropoffProgress.find((sp) => sp.stop?.sequence === s.sequence);
    if (p?.approachingNotifiedAt) return false;
    if (p?.enteredAt || p?.exitedAt) return false;
    return true;
  });
  const notifyDisabledReason = !tripData.startedAt
    ? 'not_started'
    : tripData.status === 'COMPLETED' || tripData.status === 'CANCELLED'
      ? 'finished'
      : dropoffStops.length === 0
        ? 'no_dropoff'
        : dropoffStops.every((s) => {
              const p = s.id
                ? progressByStop.get(s.id)
                : dropoffProgress.find((sp) => sp.stop?.sequence === s.sequence);
              return Boolean(p?.approachingNotifiedAt);
            })
          ? 'already_sent'
          : dropoffStops.every((s) => {
                const p = s.id
                  ? progressByStop.get(s.id)
                  : dropoffProgress.find((sp) => sp.stop?.sequence === s.sequence);
                return Boolean(p?.enteredAt || p?.exitedAt);
              })
            ? 'already_at_drop'
            : eligibleNotifyStop
              ? null
              : 'unavailable';
  const canNotifyApproaching = notifyDisabledReason === null;

  const showPodCapture =
    Boolean(tripData.startedAt) &&
    (tripData.status === 'AT_DROPOFF' ||
      tripData.status === 'COMPLETED' ||
      dropoffProgress.some((p) => Boolean(p.enteredAt) || p.podStatus !== 'PENDING'));

  const activePodStopIdResolved =
    podStopId ||
    dropoffProgress.find((p) => p.podStatus !== 'FINALIZED')?.jobStopId ||
    dropoffProgress[0]?.jobStopId ||
    dropoffStops.find((s) => {
      if (!s.id) return false;
      const p = progressByStop.get(s.id);
      return !p || p.podStatus !== 'FINALIZED';
    })?.id ||
    dropoffStops[0]?.id ||
    null;
  const activePodStop =
    (activePodStopIdResolved
      ? progressByStop.get(activePodStopIdResolved) ?? null
      : null) ??
    dropoffProgress.find((p) => p.podStatus !== 'FINALIZED') ??
    dropoffProgress[0] ??
    null;
  const activePodStopId = activePodStopIdResolved;
  const activePodStatus = activePodStop?.podStatus ?? 'PENDING';
  const activePhotoCount = activePodStop?.goodsPhotoCount ?? 0;
  const hasPendingSurcharges =
    Boolean(tripData.gates.pendingSurcharges) ||
    (tripData.surcharges ?? []).some((s) => s.status === 'PENDING_PAYMENT');
  const podBlockedBySurcharge = hasPendingSurcharges;
  const isLastDropoffToFinalize =
    Boolean(activePodStopId) &&
    dropoffStops.every((s) => {
      if (!s.id || s.id === activePodStopId) return true;
      return progressByStop.get(s.id)?.podStatus === 'FINALIZED';
    });
  const endOdoOk =
    !isLastDropoffToFinalize ||
    (Boolean(odometerEndKm) && Number(odometerEndKm) > 0);
  const canFinalizePod =
    Boolean(activePodStopId) &&
    !podBlockedBySurcharge &&
    (activePodStatus === 'SIGNED' || Boolean(activePodStop?.signedAt)) &&
    activePhotoCount >= 1 &&
    endOdoOk;
  /**
   * Lock break / location / notify / report / POD capture while finalize is in
   * flight, and after POD finalize (or trip end).
   */
  const tripActionsLocked =
    podFinalize.isPending ||
    activePodStatus === 'FINALIZED' ||
    tripData.status === 'COMPLETED' ||
    tripData.status === 'CANCELLED';
  const podCaptureLocked = tripActionsLocked || podBlockedBySurcharge;
  const signaturePreviewUrl = remoteSignatureUrl ?? localSignaturePreview;
  const photoPreviewUrls =
    remotePhotoUrls.length > 0 ? remotePhotoUrls : localPhotoPreviews;

  return (
    <div>
      <Link to="/trips" className="text-sm font-semibold text-clox-orange hover:underline">
        ← {t('trips.backToTrips')}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-clox-ink">
        {tripData.job?.title ?? t('trips.fallbackTitle')}
      </h1>
      <p className="mt-1 font-mono text-sm text-clox-mute">{tripData.status}</p>

      {tripData.openException ? (
        <Notice tone="warn" className="mt-4" title={t('trips.exceptionOpenTitle')}>
          <p className="text-sm">
            {tripData.openException.kind} · {tripData.openException.phase} ·{' '}
            <StatusPill tone="warn">{tripData.openException.status}</StatusPill>
          </p>
          {tripData.openException.note ? (
            <p className="mt-1 text-xs text-clox-mute">{tripData.openException.note}</p>
          ) : null}
        </Notice>
      ) : null}

      <ul className="mt-4 space-y-1 text-sm text-clox-mute">
        <li>
          {t('trips.gatesLine', {
            paid: String(tripData.gates.paid),
            safetyOk: String(tripData.gates.safetyOk),
            massOk: String(tripData.gates.massOk),
          })}
        </li>
        <li>
          {t('trips.siteLine', {
            maneuverability: tripData.siteAccess?.maneuverability ?? t('dash'),
            facility: tripData.siteAccess?.facility ?? t('dash'),
          })}
        </li>
        <li>
          {t('trips.vehicleLine', {
            registration: tripData.vehicle?.registration ?? t('dash'),
            vehicleClass: tripData.vehicle?.vehicleClass,
          })}
        </li>
        <li>{t('trips.declaredMass', { kg: declared })}</li>
        {tripData.latestLocation ? (
          <li className="font-mono text-xs">
            {t('trips.lastPing', {
              lat: tripData.latestLocation.lat.toFixed(4),
              lng: tripData.latestLocation.lng.toFixed(4),
            })}
          </li>
        ) : null}
      </ul>

      {tripData.stopsProgress && tripData.stopsProgress.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-display font-semibold text-clox-ink">{t('trips.stopsProgressTitle')}</h2>
          <ul className="mt-2 space-y-1.5">
            {tripData.stopsProgress.map((row) => {
              const stop = row.stop;
              const seq = stop?.sequence ?? 0;
              const overage = row.waitOverageMinutes > 0;
              return (
                <li
                  key={row.id}
                  className="rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2 text-xs text-clox-mute"
                >
                  <span className="font-medium text-clox-ink">
                    #{seq} {stop?.stopType ?? '—'}
                    {stop?.suburb ? ` · ${stop.suburb}` : ''}
                  </span>
                  {row.enteredAt ? (
                    <span className="ml-2">
                      {t('trips.stopEntered', {
                        time: new Date(row.enteredAt).toLocaleTimeString(),
                      })}
                    </span>
                  ) : null}
                  {row.freeWaitEndsAt && !overage ? (
                    <span className="ml-2 font-medium text-[var(--status-warn)]">
                      {t('trips.stopFreeWaitEnds', {
                        time: new Date(row.freeWaitEndsAt).toLocaleTimeString(),
                      })}
                    </span>
                  ) : null}
                  {overage ? (
                    <span className="ml-2 font-medium text-[var(--status-danger)]">
                      {t('trips.stopOverage', { min: row.waitOverageMinutes })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tripData.surcharges && tripData.surcharges.some((s) => s.status === 'PENDING_PAYMENT') ? (
        <Notice tone="warn" className="mt-4" title={t('trips.pendingSurchargesTitle')}>
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {tripData.surcharges
              .filter((s) => s.status === 'PENDING_PAYMENT')
              .map((s) => (
                <li key={s.id}>
                  {s.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass')} — $
                  {(s.amountIncGstCents / 100).toFixed(2)} inc GST
                </li>
              ))}
          </ul>
        </Notice>
      ) : null}

      {!tripData.startedAt ? (
        <div className="mt-6 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-clox-ink">
              1. {t('trips.safetyChecklist')}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="cta"
                disabled={safety.isPending}
                onClick={() => safety.mutate(true)}
              >
                {t('trips.passSafety')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={safety.isPending}
                onClick={() => {
                  void (async () => {
                    const ok = await confirm({
                      title: t('confirm.safetyFailTitle'),
                      description: t('confirm.safetyFailBody'),
                      confirmLabel: t('trips.failLockVehicle'),
                      tone: 'destructive',
                    });
                    if (ok) safety.mutate(false);
                  })();
                }}
              >
                {t('trips.failLockVehicle')}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="font-display font-semibold text-clox-ink">2. {t('trips.massCheck')}</h2>
            <Field
              type="number"
              label={t('trips.placeholderActualKg', { declared })}
              value={massKg}
              onChange={(e) => setMassKg(e.target.value)}
            />
            <Button
              type="button"
              variant="cta"
              disabled={mass.isPending || !massKg}
              onClick={() => mass.mutate()}
            >
              {t('trips.submitMass')}
            </Button>
          </div>

          <div className="space-y-3">
            <h2 className="mb-2 font-display font-semibold text-clox-ink">
              3. {t('trips.startTripHeading')}
            </h2>
            <Field
              type="number"
              label={t('trips.odometerStartLabel')}
              hint={t('trips.odometerStartHint')}
              value={odometerStartKm}
              onChange={(e) => setOdometerStartKm(e.target.value)}
            />
            <LockedCta
              locked={startLocked || !odometerStartKm || Number(odometerStartKm) <= 0}
              reason={
                startLocked
                  ? t('trips.startLockedReason', {
                      missing: startLockReason(tripData.gates, t),
                    })
                  : !odometerStartKm || Number(odometerStartKm) <= 0
                    ? t('trips.odometerStartRequired')
                    : undefined
              }
              variant="cta"
              size="block"
              disabled={start.isPending}
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: t('confirm.startTripTitle'),
                    description: t('confirm.startTripBody'),
                    confirmLabel: t('trips.startTrip'),
                  });
                  if (ok) start.mutate();
                })();
              }}
            >
              {start.isPending ? t('loading') : t('trips.startTrip')}
            </LockedCta>
          </div>
        </div>
      ) : tripData.status === 'COMPLETED' || tripData.status === 'CANCELLED' ? (
        <Notice
          tone={tripData.status === 'COMPLETED' ? 'success' : 'warn'}
          className="mt-6"
        >
          {tripData.status === 'COMPLETED'
            ? t('trips.completedNotice')
            : t('trips.cancelledNotice')}
        </Notice>
      ) : (
        <div className="mt-6 space-y-3">
          <Notice tone="success">
            {t('trips.inTransit')}
            {tripData.onBreak ? ` · ${t('trips.onBreakEtaPaused')}` : ''}
          </Notice>
          {tripData.onBreak ? (
            <div className="clox-card space-y-2 p-4">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('trips.breakPanelTitle')}
              </h2>
              <p className="text-sm text-clox-mute">
                {t('trips.breakGuidance', {
                  minutes: tripData.suggestedBreakMinutes ?? 15,
                })}
              </p>
              {(() => {
                const suggested = tripData.suggestedBreakMinutes ?? 15;
                const started = tripData.breakStartedAt
                  ? new Date(tripData.breakStartedAt).getTime()
                  : breakNowMs;
                const elapsedSec = Math.max(0, Math.floor((breakNowMs - started) / 1000));
                const targetSec = suggested * 60;
                const remainingSec = Math.max(0, targetSec - elapsedSec);
                const fmt = (sec: number) => {
                  const m = Math.floor(sec / 60);
                  const s = sec % 60;
                  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                };
                const met = remainingSec === 0;
                return (
                  <>
                    <p className="font-mono text-sm text-clox-ink">
                      {t('trips.breakElapsed', { elapsed: fmt(elapsedSec) })}
                      {' · '}
                      {met
                        ? t('trips.breakMinimumMet')
                        : t('trips.breakRemaining', { remaining: fmt(remainingSec) })}
                    </p>
                    <p className="text-xs text-clox-faint">{t('trips.breakEndEarlyHint')}</p>
                  </>
                );
              })()}
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="block"
            disabled={tripActionsLocked || brk.isPending}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: t('confirm.breakTitle'),
                  description: t('confirm.breakBody'),
                  confirmLabel: tripData.onBreak ? t('trips.endBreak') : t('trips.takingBreak'),
                });
                if (ok) brk.mutate(!tripData.onBreak);
              })();
            }}
          >
            {tripData.onBreak ? t('trips.endBreak') : t('trips.takingBreak')}
          </Button>
          <Button
            type="button"
            variant="cta"
            size="block"
            disabled={tripActionsLocked || loc.isPending}
            onClick={() => loc.mutate()}
          >
            {t('trips.sendMockLocation')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="block"
            disabled={
              tripActionsLocked || !canNotifyApproaching || notifyApproaching.isPending
            }
            onClick={() => notifyApproaching.mutate(eligibleNotifyStop?.id)}
          >
            {canNotifyApproaching
              ? t('trips.notifyApproaching')
              : notifyDisabledReason === 'already_sent'
                ? t('trips.notifyApproachingDone')
                : t('trips.notifyApproaching')}
          </Button>
          <p className="text-xs text-clox-mute">
            {canNotifyApproaching
              ? t('trips.notifyApproachingHint')
              : notifyDisabledReason === 'already_sent'
                ? t('trips.notifyApproachingDoneHint')
                : notifyDisabledReason === 'already_at_drop'
                  ? t('trips.notifyApproachingAtDropHint')
                  : notifyDisabledReason === 'no_dropoff'
                    ? t('trips.notifyApproachingNoDropHint')
                    : t('trips.notifyApproachingHint')}
          </p>
          {notifyDisabledReason === 'already_sent' &&
          tripData.status !== 'AT_DROPOFF' &&
          tripData.status !== 'COMPLETED' ? (
            <Notice tone="info" title={t('trips.notifyApproachingNextTitle')}>
              {t('trips.notifyApproachingNextBody')}
            </Notice>
          ) : null}

          {showPodCapture && activePodStopId ? (
            <div className="clox-card space-y-3 p-4">
              <h2 className="font-display font-semibold text-clox-ink">{t('trips.podTitle')}</h2>
              <p className="text-sm text-clox-mute">{t('trips.podHint')}</p>
              <p className="text-xs text-clox-mute">
                {t('trips.podStatus')}:{' '}
                <span className="font-mono text-clox-ink">{activePodStatus}</span>
                {' · '}
                {t('trips.podPhotosCount', { count: activePhotoCount })}
                {activePodStop?.stop?.suburb
                  ? ` · ${activePodStop.stop.suburb}`
                  : dropoffStops.find((s) => s.id === activePodStopId)?.suburb
                    ? ` · ${dropoffStops.find((s) => s.id === activePodStopId)?.suburb}`
                    : ''}
              </p>

              {podBlockedBySurcharge ? (
                <Notice tone="warn" title={t('trips.podBlockedPendingTitle')}>
                  {t('trips.podBlockedPendingBody')}
                </Notice>
              ) : null}

              {activePodStatus !== 'FINALIZED' ? (
                <>
                  <Field
                    label={t('trips.podSignerName')}
                    placeholder={t('trips.podSignerPlaceholder')}
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    disabled={podCaptureLocked}
                  />
                  <label className="flex items-start gap-2 text-sm text-clox-ink">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={attestPresent}
                      disabled={podCaptureLocked}
                      onChange={(e) => setAttestPresent(e.target.checked)}
                    />
                    <span>{t('trips.podAttestPresent')}</span>
                  </label>
                  <p className="text-xs text-clox-mute">{t('trips.podDrawHint')}</p>
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={140}
                    className={cn(
                      'w-full rounded-clox-sm border border-clox-border bg-white touch-none',
                      podCaptureLocked ? 'pointer-events-none opacity-50' : '',
                    )}
                    onPointerDown={(e) => {
                      if (podCaptureLocked) return;
                      drawingRef.current = true;
                      const canvas = canvasRef.current;
                      const ctx = canvas?.getContext('2d');
                      if (!canvas || !ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.beginPath();
                      ctx.moveTo(
                        ((e.clientX - rect.left) / rect.width) * canvas.width,
                        ((e.clientY - rect.top) / rect.height) * canvas.height,
                      );
                    }}
                    onPointerMove={(e) => {
                      if (!drawingRef.current) return;
                      const canvas = canvasRef.current;
                      const ctx = canvas?.getContext('2d');
                      if (!canvas || !ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.lineTo(
                        ((e.clientX - rect.left) / rect.width) * canvas.width,
                        ((e.clientY - rect.top) / rect.height) * canvas.height,
                      );
                      ctx.stroke();
                    }}
                    onPointerUp={() => {
                      drawingRef.current = false;
                    }}
                    onPointerLeave={() => {
                      drawingRef.current = false;
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={podCaptureLocked}
                      onClick={() => {
                        const canvas = canvasRef.current;
                        const ctx = canvas?.getContext('2d');
                        if (!canvas || !ctx) return;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                      }}
                    >
                      {t('trips.podClearSignature')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={
                        podCaptureLocked ||
                        podSign.isPending ||
                        !attestPresent ||
                        signerName.trim().length < 2 ||
                        !activePodStopId
                      }
                      onClick={() => {
                        if (!activePodStopId || !canvasRef.current) return;
                        setPodStopId(activePodStopId);
                        podSign.mutate({
                          jobStopId: activePodStopId,
                          signerName: signerName.trim(),
                          signatureDataUrl: canvasRef.current.toDataURL('image/png'),
                          receiverPresentAttested: attestPresent,
                        });
                      }}
                    >
                      {t('trips.podCaptureSignature')}
                    </Button>
                    <label
                      className={cn(
                        'clox-btn clox-btn-secondary cursor-pointer px-3 py-1.5 text-[12.5px]',
                        podCaptureLocked || podPhoto.isPending
                          ? 'pointer-events-none opacity-60'
                          : '',
                      )}
                    >
                      {podPhoto.isPending ? t('trips.podPhotoUploading') : t('trips.podAddPhoto')}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={
                          podCaptureLocked || podPhoto.isPending || !activePodStopId
                        }
                        onChange={(e) => {
                          const input = e.currentTarget;
                          const file = input.files?.[0];
                          input.value = '';
                          if (!file || !activePodStopId) return;
                          setPodStopId(activePodStopId);
                          void (async () => {
                            try {
                              const photoDataUrl = await fileToCompressedJpegDataUrl(file);
                              podPhoto.mutate({
                                jobStopId: activePodStopId,
                                photoDataUrl,
                              });
                            } catch (err) {
                              setMsg(
                                getErrorDetail(err) || t('trips.podPhotoCompressFailed'),
                              );
                            }
                          })();
                        }}
                      />
                    </label>
                    <p className="basis-full text-xs text-clox-mute">{t('trips.podPhotoHint')}</p>
                    {isLastDropoffToFinalize ? (
                      <Field
                        className="basis-full"
                        type="number"
                        label={t('trips.odometerEndLabel')}
                        hint={t('trips.odometerEndHint')}
                        value={odometerEndKm}
                        onChange={(e) => setOdometerEndKm(e.target.value)}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="cta"
                      size="sm"
                      disabled={podFinalize.isPending || !canFinalizePod}
                      onClick={() => {
                        if (!activePodStopId || podFinalize.isPending) return;
                        podFinalize.mutate({
                          jobStopId: activePodStopId,
                          odometerEndKm: isLastDropoffToFinalize
                            ? Number(odometerEndKm)
                            : undefined,
                        });
                      }}
                    >
                      {podFinalize.isPending ? t('loading') : t('trips.podFinalize')}
                    </Button>
                  </div>
                </>
              ) : (
                <Notice tone="success">{t('trips.podFinalized')}</Notice>
              )}

              {signaturePreviewUrl ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-clox-ink">
                    {t('trips.podSignaturePreview')}
                    {activePodStop?.signerName ? ` — ${activePodStop.signerName}` : ''}
                  </p>
                  <img
                    src={signaturePreviewUrl}
                    alt={t('trips.podSignaturePreview')}
                    className="max-h-36 w-full rounded-clox-sm border border-clox-border bg-white object-contain"
                  />
                </div>
              ) : null}

              {photoPreviewUrls.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-clox-ink">
                    {t('trips.podPhotosPreview')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photoPreviewUrls.map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={url}
                        alt={t('trips.podPhotoPreviewAlt', { index: index + 1 })}
                        className="aspect-square w-full rounded-clox-sm border border-clox-border object-cover"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        </div>
      )}

      {tripData.taxInvoiceStorageKey || tripData.runSheetStorageKey ? (
        <Notice tone="info" className="mt-6" title={t('trips.completionDocsTitle')}>
          <ul className="mt-1 space-y-1 font-mono text-xs text-clox-ink">
            {tripData.taxInvoiceStorageKey ? (
              <li>{t('trips.taxInvoiceKey', { key: tripData.taxInvoiceStorageKey })}</li>
            ) : null}
            {tripData.runSheetStorageKey ? (
              <li>{t('trips.runSheetKey', { key: tripData.runSheetStorageKey })}</li>
            ) : null}
          </ul>
        </Notice>
      ) : null}

      {tripData.status !== 'COMPLETED' && tripData.status !== 'CANCELLED' ? (
        <div className="mt-8 border-t border-clox-border-soft pt-6">
          <h2 className="font-display font-semibold text-clox-ink">{t('trips.reportIssueTitle')}</h2>
          <p className="mt-1 text-sm text-clox-mute">{t('trips.reportIssueHint')}</p>
          {!tripData.openException && !showReport ? (
            <Button
              type="button"
              variant="destructive"
              className="mt-3"
              disabled={tripActionsLocked}
              onClick={() => setShowReport(true)}
            >
              {t('trips.reportIssue')}
            </Button>
          ) : null}
          {showReport && !tripData.openException ? (
            <form
              className="clox-card mt-4 space-y-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (reportNote.trim().length < 3 || report.isPending) return;
                report.mutate();
              }}
              noValidate
            >
              <Select
                label={t('trips.reportKind')}
                value={reportKind}
                disabled={tripActionsLocked || report.isPending}
                onChange={(event) => {
                  const next = event.target.value as TripExceptionKind;
                  setReportKind(next);
                  if (next !== 'VEHICLE_BREAKDOWN') {
                    setPhotoDocumentId(null);
                    setPhotoError(null);
                  }
                }}
              >
                {EXCEPTION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`trips.exceptionKinds.${kind}`, { defaultValue: kind })}
                  </option>
                ))}
              </Select>
              <Field
                label={t('trips.reportReasonCode')}
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder={t('trips.reportReasonPlaceholder')}
                disabled={tripActionsLocked || report.isPending}
              />
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                  {t('trips.reportNote')}
                </span>
                <textarea
                  className="clox-field-control min-h-[4.5rem]"
                  value={reportNote}
                  onChange={(event) => setReportNote(event.target.value)}
                  placeholder={t('trips.reportNotePlaceholder')}
                  maxLength={2000}
                  required
                  disabled={tripActionsLocked || report.isPending}
                />
              </label>
              {reportKind === 'VEHICLE_BREAKDOWN' ? (
                <div className="mb-0 space-y-2">
                  <Notice tone="warn">{t('trips.reportPhotoRequired')}</Notice>
                  <p className="text-xs text-clox-mute">{t('trips.reportPhotoHint')}</p>
                  <FileInput
                    className="mb-0"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={tripActionsLocked || photoUploading || report.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadBreakdownPhoto(file);
                    }}
                  />
                  {photoUploading ? (
                    <p className="text-xs text-clox-mute">{t('trips.reportPhotoUploading')}</p>
                  ) : null}
                  {photoDocumentId ? (
                    <Notice tone="success">{t('trips.reportPhotoReady')}</Notice>
                  ) : null}
                  {photoError ? <Notice tone="error">{photoError}</Notice> : null}
                </div>
              ) : null}
              {reportKind === 'DRIVER_UNAVAILABLE' ? (
                <Notice tone="warn">{t('trips.reportOfflineHint')}</Notice>
              ) : null}
              {report.isError ? (
                <Notice tone="error">{getErrorDetail(report.error)}</Notice>
              ) : null}
              <div className="clox-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={tripActionsLocked || report.isPending || photoUploading}
                  onClick={() => setShowReport(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    tripActionsLocked ||
                    report.isPending ||
                    photoUploading ||
                    reportNote.trim().length < 3 ||
                    (reportKind === 'VEHICLE_BREAKDOWN' && !photoDocumentId)
                  }
                >
                  {report.isPending ? t('loading') : t('trips.reportSubmit')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {msg ? (
        <Notice tone="info" className="mt-4">
          {msg}
        </Notice>
      ) : null}
    </div>
  );
}
