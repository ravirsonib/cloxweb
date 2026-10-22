import { http } from '@/lib/http';

export type TripSummary = {
  id: string;
  jobId: string;
  status: string;
  safetyPassedAt: string | null;
  massCheckOk: boolean;
  massOverDeclared: boolean;
  declaredMassKg: number | null;
  actualMassKg: number | null;
  onBreak: boolean;
  startedAt: string | null;
  taxInvoiceStorageKey?: string | null;
  runSheetStorageKey?: string | null;
  gates: {
    paid: boolean;
    safetyOk: boolean;
    massOk: boolean;
    canStart: boolean;
    /** False while any surcharge is PENDING_PAYMENT (POD blocked). */
    canFinalizePod?: boolean;
    pendingSurcharges?: boolean;
  };
  siteAccess: { maneuverability: string | null; facility: string | null } | null;
  job: {
    title: string | null;
    status: string;
    deadWeightKg: number | null;
    chargeableWeightKg: number | null;
    stops: Array<{
      id?: string;
      sequence: number;
      stopType: string;
      suburb: string | null;
      lat?: number | null;
      lng?: number | null;
    }>;
  } | null;
  vehicle: { label: string | null; registration: string | null; vehicleClass: string | null } | null;
  latestLocation: { lat: number; lng: number; recordedAt: string } | null;
  stopsProgress?: Array<{
    id: string;
    jobStopId: string;
    enteredAt: string | null;
    exitedAt?: string | null;
    freeWaitEndsAt: string | null;
    waitOverageMinutes: number;
    arrivalRecorded: boolean;
    currentlyInside: boolean;
    approachingNotifiedAt?: string | null;
    approachingSource?: string | null;
    atDropoffNotifiedAt?: string | null;
    podStatus?: string;
    signedAt?: string | null;
    signerName?: string | null;
    hasSignature?: boolean;
    receiverPresentAttested?: boolean;
    goodsPhotoCount?: number;
    podFinalizedAt?: string | null;
    podPackageStorageKey?: string | null;
    stop: {
      sequence: number;
      stopType: string;
      suburb: string | null;
    } | null;
  }> | null;
  surcharges?: Array<{
    id: string;
    kind: 'WAITING' | 'MASS';
    status: 'PENDING_PAYMENT' | 'PAID' | 'WAIVED';
    amountIncGstCents: number;
  }> | null;
  openException?: {
    id: string;
    kind: string;
    phase: string;
    status: string;
    reasonCode: string | null;
    note: string | null;
    openedAt: string;
    resolvedAt: string | null;
  } | null;
};

export type SenderTrack = {
  visible: boolean;
  message?: string;
  code?: string;
  onBreak?: boolean;
  etaPaused?: boolean;
  tripStatus?: string;
  startedAt?: string;
  latest?: { lat: number; lng: number; recordedAt: string } | null;
  locations?: Array<{ lat: number; lng: number; recordedAt: string }>;
  job?: {
    id: string;
    title: string | null;
    stops: Array<{ suburb: string | null; stopType: string; sequence?: number }>;
  };
  stopsProgress?: Array<{
    id: string;
    jobStopId?: string;
    enteredAt: string | null;
    freeWaitEndsAt: string | null;
    waitOverageMinutes: number;
    arrivalRecorded: boolean;
    podStatus?: string;
    signerName?: string | null;
    podFinalizedAt?: string | null;
    podPackageStorageKey?: string | null;
    goodsPhotoCount?: number;
    stop: {
      sequence: number;
      stopType: string;
      suburb: string | null;
    } | null;
  }> | null;
  surcharges?: Array<{
    id: string;
    kind: 'WAITING' | 'MASS';
    status: 'PENDING_PAYMENT' | 'PAID' | 'WAIVED';
    amountIncGstCents: number;
  }> | null;
  taxInvoiceStorageKey?: string | null;
  runSheetStorageKey?: string | null;
};

export type TripPodSummary = {
  tripId: string;
  jobId: string;
  tripStatus: string;
  podStorageKey: string | null;
  taxInvoiceStorageKey: string | null;
  runSheetStorageKey: string | null;
  dropoffs: Array<{
    jobStopId: string;
    sequence: number;
    suburb: string | null;
    podStatus: string;
    signedAt: string | null;
    signerName: string | null;
    podFinalizedAt: string | null;
    podPackageStorageKey: string | null;
    signaturePdfStorageKey: string | null;
    goodsPhotoCount: number;
  }>;
};

export function listDriverTrips() {
  return http.get<TripSummary[]>('/trips/mine').then((r) => r.data);
}

export function getDriverTrip(tripId: string) {
  return http.get<TripSummary>(`/trips/${tripId}`).then((r) => r.data);
}

export function tripSafetyCheck(tripId: string, passed: boolean) {
  return http
    .post<TripSummary>(`/trips/${tripId}/safety-check`, { passed, online: true })
    .then((r) => r.data);
}

export function tripMassCheck(tripId: string, actualMassKg: number) {
  return http
    .post<TripSummary>(`/trips/${tripId}/mass-check`, { actualMassKg, online: true })
    .then((r) => r.data);
}

export function tripStart(tripId: string) {
  return http.post<TripSummary>(`/trips/${tripId}/start`, { online: true }).then((r) => r.data);
}

export function tripBreak(tripId: string, onBreak: boolean) {
  return http.post<TripSummary>(`/trips/${tripId}/break`, { onBreak }).then((r) => r.data);
}

export function tripLocation(tripId: string, lat: number, lng: number) {
  return http.post(`/trips/${tripId}/locations`, { lat, lng }).then((r) => r.data);
}

export function tripNotifyApproaching(tripId: string, jobStopId?: string) {
  return http
    .post<TripSummary>(`/trips/${tripId}/notify-approaching`, {
      ...(jobStopId ? { jobStopId } : {}),
    })
    .then((r) => r.data);
}

export function tripPodSignature(
  tripId: string,
  payload: {
    jobStopId: string;
    signerName: string;
    signatureDataUrl: string;
    receiverPresentAttested: boolean;
  },
) {
  return http
    .post<TripSummary>(`/trips/${tripId}/pod/signature`, payload)
    .then((r) => r.data);
}

export function tripPodPhoto(
  tripId: string,
  payload: { jobStopId: string; photoDataUrl: string },
) {
  return http.post<TripSummary>(`/trips/${tripId}/pod/photos`, payload).then((r) => r.data);
}

export function tripPodFinalize(tripId: string, jobStopId: string) {
  return http
    .post<TripSummary>(
      `/trips/${tripId}/pod/finalize`,
      { jobStopId },
      // PDF generation + 3 SMTP sends with attachments often exceeds default 30s.
      { timeout: 120_000 },
    )
    .then((r) => r.data);
}

/** Authenticated blob fetch for POD signature / goods photo preview. */
export async function fetchTripPodArtifactBlob(
  tripId: string,
  jobStopId: string,
  kind: 'signature' | 'photo',
  index = 0,
): Promise<Blob> {
  const path =
    kind === 'signature'
      ? `/trips/${tripId}/pod/artifacts/${jobStopId}/signature`
      : `/trips/${tripId}/pod/artifacts/${jobStopId}/photos/${index}`;
  const response = await http.get<Blob>(path, { responseType: 'blob' });
  return response.data;
}

export function getSenderTrack(jobId: string) {
  return http.get<SenderTrack>(`/trips/jobs/${jobId}/track`).then((r) => r.data);
}

export function getTripPod(tripId: string) {
  return http.get<TripPodSummary>(`/trips/${tripId}/pod`).then((r) => r.data);
}
