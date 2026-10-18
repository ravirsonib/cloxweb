import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

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
  };
  company: { id: string; legalName: string; status: string } | null;
  goNoGo: {
    companyLinked: boolean;
    licenceValid: boolean;
    nhvrAcknowledged: boolean;
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
  licenceNo: string;
  licenceClass: string;
  licenceExpiry: string;
  nhvrAcknowledged: true;
  licenceDocumentId?: string;
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
