import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type CarrierOnboarding = {
  step: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
  company: {
    id: string;
    status: string;
    legalName: string;
    tradingName: string | null;
    abn: string | null;
    acn: string | null;
    phone: string | null;
    homeRegionCode: string | null;
    stripeConnectAccountId: string | null;
    stripeConnectPayoutsEnabled: boolean;
    capabilities: string[];
    serviceRegionCodes: string[];
  };
  vehicles: Array<{
    id: string;
    status: string;
    label: string | null;
    registration: string | null;
    vehicleClass: string | null;
    tareKg: number | null;
    gvmKg: number | null;
    gcmKg: number | null;
  }>;
  drivers: Array<{
    id: string;
    status: string;
    licenceNo: string | null;
    email: string;
    name: string | null;
    phone: string | null;
  }>;
  latestCase: {
    id: string;
    status: string;
    caseType: string;
    decisionNote: string | null;
  } | null;
  goNoGo: {
    profileComplete: boolean;
    connectReady: boolean;
    fleetReady: boolean;
    capabilitiesSet: boolean;
    opsApproved: boolean;
    canBid: boolean;
    netPayoutHint: string;
  };
  stripeMock: boolean;
  uploadedDocs?: Array<{ id: string; docType: string; status: string }>;
};

export function registerCarrier(payload: {
  email: string;
  name: string;
  phone?: string;
  acceptedTerms: boolean;
}) {
  return publicHttp.post('/carrier/register', payload).then((r) => r.data);
}

export function getCarrierOnboarding() {
  return http.get<CarrierOnboarding>('/carrier/onboarding').then((r) => r.data);
}

export function updateCarrierProfile(payload: Record<string, unknown>) {
  return http.put<CarrierOnboarding>('/carrier/profile', payload).then((r) => r.data);
}

export function setupCarrierConnect() {
  return http
    .post<{ accountId: string; url: string; mock: boolean }>('/carrier/connect/setup')
    .then((r) => r.data);
}

export function confirmCarrierConnect() {
  return http.post<CarrierOnboarding>('/carrier/connect/confirm', {}).then((r) => r.data);
}

export function addCarrierVehicle(payload: Record<string, unknown>) {
  return http.post<CarrierOnboarding>('/carrier/vehicles', payload).then((r) => r.data);
}

export function inviteCarrierDriver(payload: Record<string, unknown>) {
  return http
    .post<
      CarrierOnboarding & {
        invite?: {
          driverId: string;
          email: string;
          inviteUrl: string;
          expiresAt: string;
          mailSkipped: boolean;
          debugToken?: string;
        };
      }
    >('/carrier/drivers/invite', payload)
    .then((r) => r.data);
}

export function resendCarrierDriverInvite(driverId: string) {
  return http
    .post<{
      driverId: string;
      email: string;
      inviteUrl: string;
      expiresAt: string;
      mailSkipped: boolean;
      debugToken?: string;
    }>('/carrier/drivers/invite/resend', { driverId })
    .then((r) => r.data);
}

export function updateCarrierCapabilities(payload: Record<string, unknown>) {
  return http.put<CarrierOnboarding>('/carrier/capabilities', payload).then((r) => r.data);
}

export function submitCarrierVerification(documentIds: string[]) {
  return http
    .post<CarrierOnboarding>('/carrier/verification/submit', { documentIds })
    .then((r) => r.data);
}

export function getBidEligibility() {
  return http
    .get<{
      canBid: boolean;
      goNoGo: CarrierOnboarding['goNoGo'];
      companyStatus: string;
    }>('/carrier/bid-eligibility')
    .then((r) => r.data);
}
