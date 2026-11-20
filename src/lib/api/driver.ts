import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';
import type { DriverScheduleEntryItem } from './carrier';

// Re-exported so callers can `import { type DriverScheduleEntryItem } from '@/lib/api/driver'`
// without duplicating the shape already defined for the carrier fleet schedule view.
export type { DriverScheduleEntryItem } from './carrier';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type DriverInvitePeek = {
  email: string;
  name: string | null;
  companyName: string;
  status: string;
  expired: boolean;
  consumed: boolean;
  canAccept: boolean;
};

export type DriverOnboarding = {
  step: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
  driver: {
    id: string;
    status: string;
    licenceNo: string | null;
    licenceClass: string | null;
    licenceExpiry: string | null;
    nhvrAcknowledgedAt: string | null;
    inviteAcceptedAt: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    addressLine1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    facePhotoDocumentId?: string | null;
  };
  company: { id: string; legalName: string; status: string } | null;
  goNoGo: {
    companyLinked: boolean;
    licenceValid: boolean;
    licenceDocumentUploaded: boolean;
    nhvrAcknowledged: boolean;
    personalDetailsComplete: boolean;
    active: boolean;
    canBeAssigned: boolean;
    tripApisNote: string;
  };
};

export function peekDriverInvite(token: string) {
  return publicHttp.get<DriverInvitePeek>(`/driver/invite/${encodeURIComponent(token)}`).then((r) => r.data);
}

export function acceptDriverInvite(token: string) {
  return publicHttp.post<{ email: string; companyName: string; message: string }>('/driver/invite/accept', {
    token,
  }).then((r) => r.data);
}

export function getDriverOnboarding() {
  return http.get<DriverOnboarding>('/driver/onboarding').then((r) => r.data);
}

export function submitDriverProfile(payload: {
  name: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  licenceNo: string;
  licenceClass: string;
  licenceExpiry: string;
  nhvrAcknowledged: true;
  licenceDocumentId: string;
  /** Optional face / profile photo (SELFIE) — not the licence scan */
  facePhotoDocumentId?: string | null;
}) {
  return http.put<DriverOnboarding>('/driver/profile', payload).then((r) => r.data);
}

export function getDriverAssignability() {
  return http
    .get<{ canBeAssigned: boolean; reason: string | null; goNoGo: DriverOnboarding['goNoGo'] }>(
      '/driver/assignability',
    )
    .then((r) => r.data);
}

/** Matches `driverScheduleRequestSchema` (api/src/shared/types.ts). */
export type DriverTimeOffType =
  | 'ANNUAL_LEAVE'
  | 'MEDICAL_LEAVE'
  | 'ROSTERED_OFF'
  | 'PERSONAL'
  | 'OVERTIME_AVAILABLE';

export type DriverTimeOffRequestInput = {
  startAt: string;
  endAt: string;
  type?: DriverTimeOffType;
  isAllDay?: boolean;
  reason?: string;
  notes?: string;
};

/** Own schedule / time-off entries for the signed-in driver. */
export function getMyDriverSchedule(from?: string, to?: string) {
  return http
    .get<DriverScheduleEntryItem[]>('/driver/schedule', {
      params: { from, to },
    })
    .then((r) => r.data);
}

/** Request time-off / set an availability window for the signed-in driver. */
export function requestDriverTimeOff(payload: DriverTimeOffRequestInput) {
  return http.post<DriverScheduleEntryItem>('/driver/schedule', payload).then((r) => r.data);
}

/** Cancel a pending or future schedule entry owned by the signed-in driver. */
export function cancelDriverSchedule(id: string) {
  return http
    .delete<DriverScheduleEntryItem>(`/driver/schedule/${id}`)
    .then((r) => r.data);
}
