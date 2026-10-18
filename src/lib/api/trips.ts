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
  gates: {
    paid: boolean;
    safetyOk: boolean;
    massOk: boolean;
    canStart: boolean;
  };
  siteAccess: { maneuverability: string | null; facility: string | null } | null;
  job: {
    title: string | null;
    status: string;
    deadWeightKg: number | null;
    chargeableWeightKg: number | null;
    stops: Array<{
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
    freeWaitEndsAt: string | null;
    waitOverageMinutes: number;
    arrivalRecorded: boolean;
    currentlyInside: boolean;
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
    enteredAt: string | null;
    freeWaitEndsAt: string | null;
    waitOverageMinutes: number;
    arrivalRecorded: boolean;
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

export function getSenderTrack(jobId: string) {
  return http.get<SenderTrack>(`/trips/jobs/${jobId}/track`).then((r) => r.data);
}
