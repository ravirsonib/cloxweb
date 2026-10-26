import { http } from '@/lib/http';

export type TripExceptionKind =
  | 'DRIVER_UNAVAILABLE'
  | 'VEHICLE_BREAKDOWN'
  | 'ACCIDENT'
  | 'TRAFFIC'
  | 'OTHER';

export type TripExceptionRow = {
  id: string;
  jobId: string;
  assignmentId: string;
  tripId: string | null;
  companyId: string;
  reportedByUserId: string;
  kind: TripExceptionKind;
  phase: 'PRE_TRIP' | 'MID_TRIP';
  status: string;
  reasonCode: string | null;
  note: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  photoDocumentId: string | null;
  openedAt: string;
  company?: { id: string; legalName: string } | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  job: {
    id: string;
    title: string | null;
    rescueDiscountPercent?: number | null;
    marketplacePriority?: boolean;
  } | null;
  vehicle: { id: string; registration: string | null; vehicleClass: string | null } | null;
  driver: { id: string; email: string | null; name: string | null } | null;
  marketplaceRelistSlaMs?: number;
};

export function openTripException(payload: {
  tripId: string;
  kind: TripExceptionKind;
  reasonCode?: string;
  note: string;
  gpsLat?: number;
  gpsLng?: number;
  photoDocumentId?: string;
}) {
  return http
    .post<
      TripExceptionRow & {
        forceOffline: boolean;
        tripStatus: string;
        notified: { carrier: boolean; sender: boolean; driver: boolean };
      }
    >('/exceptions', payload)
    .then((r) => r.data);
}

export function listTripExceptions(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: TripExceptionRow[]; marketplaceRelistSlaMs?: number }>('/exceptions', {
      signal: options?.signal,
    })
    .then((r) => r.data);
}

export function getTripException(id: string) {
  return http.get<TripExceptionRow>(`/exceptions/${id}`).then((r) => r.data);
}

export function reassignTripException(
  id: string,
  payload: { vehicleId: string; driverId: string; note?: string },
) {
  return http
    .post<{ exception: TripExceptionRow; reassignment: unknown }>(
      `/exceptions/${id}/reassign`,
      payload,
    )
    .then((r) => r.data);
}

export function continueTripException(
  id: string,
  payload: { note: string; etaNote?: string },
) {
  return http
    .post<{ exception: TripExceptionRow }>(`/exceptions/${id}/continue`, payload)
    .then((r) => r.data);
}

export function escalateTripException(id: string, payload?: { note?: string }) {
  return http
    .post<{ exception: TripExceptionRow; alreadyEscalated: boolean }>(
      `/exceptions/${id}/escalate`,
      payload ?? {},
    )
    .then((r) => r.data);
}

export function listOpsTripExceptions(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: TripExceptionRow[] }>('/exceptions/ops', {
      signal: options?.signal,
    })
    .then((r) => r.data);
}

export type RescueCandidate = {
  vehicleId: string;
  driverId: string;
  score: number;
  classScore: number;
  proximityScore: number;
  vehicle: {
    id: string;
    registration: string | null;
    vehicleClass: string | null;
  };
  driver: {
    id: string;
    name: string | null;
    email: string | null;
    licenceClass: string | null;
  };
  reasons: string[];
};

export function listExceptionCandidates(id: string) {
  return http
    .get<{
      items: RescueCandidate[];
      recommended: RescueCandidate | null;
      unambiguous: boolean;
      minVehicleClass: string | null;
    }>(`/exceptions/${id}/candidates`)
    .then((r) => r.data);
}

export function releaseTripException(id: string, payload: { note: string }) {
  return http
    .post<{
      exception: TripExceptionRow;
      marketplaceRelease: {
        status: string;
        reListJob: boolean;
        marketplacePriority?: boolean;
        discountPercent?: number;
        message: string;
      };
      stripeAdjustment: { status: string; amountCents: number | null };
    }>(`/exceptions/${id}/release`, payload)
    .then((r) => r.data);
}
