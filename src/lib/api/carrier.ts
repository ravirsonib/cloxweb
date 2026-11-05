import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type CarrierOnboarding = {
  step: string;
  /** BID_ELIGIBLE company sent back to Connect after mock→live clear. */
  payoutRepairRequired?: boolean;
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
    reliabilityScore?: number;
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
    /** True when an RWC is uploaded for this vehicleId. */
    hasRwc?: boolean;
    /** Latest RWC document id for this vehicle (for View). */
    rwcDocumentId?: string | null;
    /** True when a DG_LICENCE document is uploaded for this vehicleId. */
    hasDg?: boolean;
    /** Latest DG_LICENCE document id for this vehicle (for View / Bid auto-attach). */
    dgDocumentId?: string | null;
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
  uploadedDocs?: Array<{
    id: string;
    docType: string;
    status: string;
    vehicleId?: string | null;
  }>;
};

export function registerCarrier(payload: {
  email: string;
  name: string;
  phone?: string;
  alternateEmail?: string;
  alternatePhone?: string;
  acceptedTerms: boolean;
  inviteToken?: string;
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

export type FleetDisableReasonInput = {
  reason: string;
  note?: string;
};

export type FleetRwcCompliance = {
  state: 'OK' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'MISSING';
  expiresAt: string | null;
  documentId: string | null;
  documentStatus: string | null;
};

export type FleetCommittedJob = {
  id: string;
  title: string | null;
};

export type CarrierVehicleListItem = {
  id: string;
  status: string;
  /** Live trip / bid commitment label (ON_BREAK, IN_TRANSIT, BID_COMMITTED, …). */
  activityStatus?: string | null;
  /** False when on trip, pending assignment, or open bid on another job. */
  bidAvailable?: boolean;
  /** True when vehicle has a DG_LICENCE document eligible for DG jobs. */
  hasDg?: boolean;
  /** Latest DG_LICENCE document id for this vehicle (auto-attached on DG bids). */
  dgDocumentId?: string | null;
  dgDocumentFilename?: string | null;
  committedJob?: FleetCommittedJob | null;
  currentTrip?: {
    id: string;
    status: string;
    onBreak: boolean;
    breakStartedAt: string | null;
    jobId: string;
    jobTitle: string | null;
  } | null;
  label: string | null;
  registration: string | null;
  vehicleClass: string | null;
  tareKg: number | null;
  gvmKg: number | null;
  gcmKg: number | null;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledNote: string | null;
  createdAt: string;
  updatedAt: string;
  compliance?: {
    rwc: FleetRwcCompliance;
  };
};

export type CarrierDriverListItem = {
  id: string;
  status: string;
  /** Live trip / bid commitment label (ON_BREAK, IN_TRANSIT, BID_COMMITTED, …). */
  activityStatus?: string | null;
  /** False when on trip, pending assignment, or open bid on another job. */
  bidAvailable?: boolean;
  /** True when vehicle has a DG_LICENCE document eligible for DG jobs. */
  hasDg?: boolean;
  /** Latest DG_LICENCE document id for this vehicle (auto-attached on DG bids). */
  dgDocumentId?: string | null;
  dgDocumentFilename?: string | null;
  committedJob?: FleetCommittedJob | null;
  currentTrip?: {
    id: string;
    status: string;
    onBreak: boolean;
    breakStartedAt: string | null;
    jobId: string;
    jobTitle: string | null;
  } | null;
  licenceNo: string | null;
  licenceClass: string | null;
  licenceExpiry: string | null;
  reliabilityScore?: number;
  inviteAcceptedAt: string | null;
  inviteExpiresAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    status: string;
  };
};

export function listCarrierVehicles(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: CarrierVehicleListItem[] }>('/carrier/vehicles', {
      signal: options?.signal,
    })
    .then((r) => r.data);
}

export function listCarrierDrivers(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: CarrierDriverListItem[] }>('/carrier/drivers', {
      signal: options?.signal,
    })
    .then((r) => r.data);
}

export function addCarrierVehicle(payload: Record<string, unknown>) {
  return http.post<CarrierOnboarding>('/carrier/vehicles', payload).then((r) => r.data);
}

export function disableCarrierVehicle(id: string, payload: FleetDisableReasonInput) {
  return http
    .post<CarrierVehicleListItem>(`/carrier/vehicles/${id}/disable`, payload)
    .then((r) => r.data);
}

export function retireCarrierVehicle(id: string, payload: FleetDisableReasonInput) {
  return http
    .post<CarrierVehicleListItem>(`/carrier/vehicles/${id}/retire`, payload)
    .then((r) => r.data);
}

export function reactivateCarrierVehicle(id: string) {
  return http
    .post<CarrierVehicleListItem>(`/carrier/vehicles/${id}/reactivate`)
    .then((r) => r.data);
}

export function deleteCarrierVehicle(id: string) {
  return http.delete<{ ok: true; id: string }>(`/carrier/vehicles/${id}`).then((r) => r.data);
}

export function disableCarrierDriver(id: string, payload: FleetDisableReasonInput) {
  return http
    .post<CarrierDriverListItem>(`/carrier/drivers/${id}/disable`, payload)
    .then((r) => r.data);
}

export function reactivateCarrierDriver(id: string) {
  return http
    .post<CarrierDriverListItem>(`/carrier/drivers/${id}/reactivate`)
    .then((r) => r.data);
}

export function deleteCarrierDriver(id: string) {
  return http.delete<{ ok: true; id: string }>(`/carrier/drivers/${id}`).then((r) => r.data);
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

export type AssignmentReassignInput = {
  vehicleId: string;
  driverId: string;
  reason: string;
  note?: string;
};

export type AssignmentReassignResult = {
  id: string;
  status: string;
  vehicleId: string;
  driverId: string;
  safetyReset: boolean;
  vehicle: {
    id: string;
    registration: string | null;
    vehicleClass: string | null;
    status: string;
  } | null;
  driver: {
    id: string;
    status: string;
    user: { email: string; name: string | null };
  } | null;
  trip: { id: string; status: string } | null;
  job: {
    id: string;
    title: string | null;
    status: string;
    minVehicleClass: string | null;
  };
};

export function reassignCarrierAssignment(
  assignmentId: string,
  payload: AssignmentReassignInput,
) {
  return http
    .post<AssignmentReassignResult>(
      `/carrier/assignments/${assignmentId}/reassign`,
      payload,
    )
    .then((r) => r.data);
}

export type DriverBidEligibilityItem = {
  id: string;
  name: string;
  email: string | null;
  licenceClass: string | null;
  isEligible: boolean;
  code: string | null;
  reason: string | null;
  conflictingWindow: { startAt: string; endAt: string } | null;
};

export type FleetBidCheckResult = {
  jobId: string;
  jobWindow: {
    startAt: string;
    endAt: string;
    durationMinutes: number;
    fatigueBreakMinutes: number;
    bufferMinutes: number;
  };
  drivers: DriverBidEligibilityItem[];
};

export type DriverScheduleEntryItem = {
  id: string;
  driverId: string;
  companyId: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  reason: string | null;
  notes: string | null;
  rejectionReason: string | null;
  driver?: {
    id: string;
    licenceClass: string | null;
    user?: { name: string | null; email: string };
  };
};

export function checkFleetDriversBid(jobId: string) {
  return http
    .get<FleetBidCheckResult>(`/carrier/fleet/drivers/bid-check/${jobId}`)
    .then((r) => r.data);
}

export function getCarrierFleetSchedule(params?: {
  from?: string;
  to?: string;
  driverId?: string;
}) {
  return http
    .get<DriverScheduleEntryItem[]>('/carrier/fleet/schedule', { params })
    .then((r) => r.data);
}

export function createDriverScheduleByCarrier(payload: {
  driverId: string;
  startAt: string;
  endAt: string;
  type?: string;
  isAllDay?: boolean;
  reason?: string;
  notes?: string;
}) {
  return http
    .post<DriverScheduleEntryItem>('/carrier/fleet/schedule', payload)
    .then((r) => r.data);
}

export function reviewDriverSchedule(
  id: string,
  payload: {
    status: 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
  },
) {
  return http
    .patch<DriverScheduleEntryItem>(`/carrier/fleet/schedule/${id}/review`, payload)
    .then((r) => r.data);
}
