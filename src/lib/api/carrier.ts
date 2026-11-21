import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type CarrierOnboarding = {
  step: string;
  /** Set by POST /carrier/vehicles — prefer over registration lookup. */
  vehicleId?: string;
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
    combinationConfig?: 'NONE' | 'SEMI' | 'BDOUBLE' | 'RT_DOUBLE' | 'RT_TRIPLE';
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
    compliance?: FleetVehicleUnitCompliance;
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

export type FleetVehicleUnitCompliance = {
  combinationConfig: 'NONE' | 'SEMI' | 'BDOUBLE' | 'RT_DOUBLE' | 'RT_TRIPLE';
  requiredRoles: Array<'POWERED' | 'TRAILER_1' | 'TRAILER_2' | 'TRAILER_3'>;
  units: Array<{
    id: string | null;
    role: 'POWERED' | 'TRAILER_1' | 'TRAILER_2' | 'TRAILER_3';
    label: string;
    registration: string | null;
    rwc: FleetRwcCompliance;
  }>;
  aggregate: {
    state: 'OK' | 'EXPIRING' | 'EXPIRED' | 'PENDING' | 'MISSING';
    label: string;
  };
  rwc: FleetRwcCompliance;
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
  combinationConfig?: 'NONE' | 'SEMI' | 'BDOUBLE' | 'RT_DOUBLE' | 'RT_TRIPLE';
  tareKg: number | null;
  gvmKg: number | null;
  gcmKg: number | null;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Fleet+ AC5 — set when status === 'MAINTENANCE' (RWC expired / service interval / safety fail / manual). */
  maintenanceCause?: 'RWC_EXPIRED' | 'SERVICE_INTERVAL' | 'SAFETY_FAIL' | 'MANUAL' | null;
  maintenanceStartedAt?: string | null;
  /** Fleet+ cost / service profile — only meaningful once entitled (editable via updateVehicleCostProfile). */
  fuelType?: string | null;
  serviceIntervalKm?: number | null;
  lastServiceOdometerKm?: number | null;
  maintenanceRatePerKm?: number | null;
  costProfileUnit?: 'PER_KM' | 'PER_HR' | null;
  costProfileRate?: number | null;
  purchasePriceAud?: number | null;
  residualValueAud?: number | null;
  lifecycleMonths?: number | null;
  units?: Array<{
    id: string;
    role: 'POWERED' | 'TRAILER_1' | 'TRAILER_2' | 'TRAILER_3';
    registration: string | null;
    label: string | null;
  }>;
  compliance?: FleetVehicleUnitCompliance & {
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

export function getCarrierVehicle(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<CarrierVehicleListItem>(`/carrier/vehicles/${id}`, {
      signal: options?.signal,
    })
    .then((r) => r.data);
}

export function updateCarrierVehicle(id: string, payload: Record<string, unknown>) {
  return http
    .patch<CarrierVehicleListItem>(`/carrier/vehicles/${id}`, payload)
    .then((r) => r.data);
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
  /** Vehicle class used for licence gate (selected vehicle or job min class). */
  vehicleClass?: string | null;
  isEligible: boolean;
  code: string | null;
  reason: string | null;
  conflictingWindow: { startAt: string; endAt: string } | null;
};

export type FleetBidCheckResult = {
  jobId: string;
  vehicleId?: string | null;
  vehicleClass?: string | null;
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

export function checkFleetDriversBid(jobId: string, vehicleId?: string | null) {
  return http
    .get<FleetBidCheckResult>(`/carrier/fleet/drivers/bid-check/${jobId}`, {
      params: vehicleId ? { vehicleId } : undefined,
    })
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

// ─── Fleet+ (Wave 2-5): entitlement, profit analytics, cost profile, maintenance, smart allocation ───

export type FleetPlusTier = 'FREE_TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type FleetPlusStatus = 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export type FleetPlusEntitlement = {
  companyId: string;
  entitled: boolean;
  /** false = platform giveaway; trial/upgrade UI hidden. true = enforce SaaS billing. */
  billingEnabled: boolean;
  tier: FleetPlusTier | null;
  status: FleetPlusStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
};

export function getFleetPlus() {
  return http.get<FleetPlusEntitlement>('/carrier/fleet-plus').then((r) => r.data);
}

export function startFleetPlusTrial() {
  return http
    .post<FleetPlusEntitlement>('/carrier/fleet-plus/start-trial')
    .then((r) => r.data);
}

export function upgradeFleetPlus(tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE') {
  return http
    .post<FleetPlusEntitlement>('/carrier/fleet-plus/upgrade', { tier })
    .then((r) => r.data);
}

export type VehicleProfitRow = {
  vehicleId: string;
  registration: string | null;
  label: string | null;
  status: string;
  revenueNetAud: number;
  fuelAud: number;
  wagesAud: number;
  tollsAud: number;
  maintenanceAud: number;
  depreciationAud: number;
  distanceKm: number;
  profitAud: number;
  marginPct: number | null;
  idlePct: number;
  flaggedLowMargin: boolean;
  flaggedHighIdle: boolean;
  maintenanceCause: string | null;
};

export type FleetAnalytics = {
  entitled: boolean;
  tier: FleetPlusTier | null;
  window: { from: string; to: string };
  summary: {
    vehicleCount: number;
    flaggedCount: number;
    totalRevenueNetAud: number;
    totalProfitAud: number;
    avgUtilisationPct: number;
  };
  vehicles: VehicleProfitRow[];
};

export function getFleetAnalytics(params?: { from?: string; to?: string }) {
  return http.get<FleetAnalytics>('/carrier/fleet/analytics', { params }).then((r) => r.data);
}

export type VehicleCostProfileInput = {
  fuelType?: string | null;
  serviceIntervalKm?: number | null;
  lastServiceOdometerKm?: number | null;
  maintenanceRatePerKm?: number | null;
  costProfileUnit?: 'PER_KM' | 'PER_HR' | null;
  costProfileRate?: number | null;
  purchasePriceAud?: number | null;
  residualValueAud?: number | null;
  lifecycleMonths?: number | null;
};

export function updateVehicleCostProfile(vehicleId: string, payload: VehicleCostProfileInput) {
  return http
    .patch<CarrierVehicleListItem>(`/carrier/vehicles/${vehicleId}/cost-profile`, payload)
    .then((r) => r.data);
}

export type VehicleFuelLogInput = {
  liters: number;
  amountAud: number;
  odometerKm?: number;
  notes?: string;
  loggedAt?: string;
};

export function addVehicleFuelLog(vehicleId: string, payload: VehicleFuelLogInput) {
  return http
    .post(`/carrier/vehicles/${vehicleId}/fuel-logs`, payload)
    .then((r) => r.data);
}

export type VehicleCostEntryInput = {
  kind: 'FUEL' | 'WAGE' | 'TOLL' | 'MAINTENANCE' | 'OTHER';
  amountAud: number;
  tripId?: string;
  notes?: string;
  loggedAt?: string;
};

export function addVehicleCostEntry(vehicleId: string, payload: VehicleCostEntryInput) {
  return http
    .post(`/carrier/vehicles/${vehicleId}/cost-entries`, payload)
    .then((r) => r.data);
}

export type VehicleServiceLogInput = {
  odometerKm: number;
  notes?: string;
  clearMaintenance?: boolean;
};

export function logVehicleService(vehicleId: string, payload: VehicleServiceLogInput) {
  return http
    .post<CarrierVehicleListItem>(`/carrier/vehicles/${vehicleId}/service-log`, payload)
    .then((r) => r.data);
}

export type VehicleMaintenanceWorkOrder = {
  id: string;
  vehicleId: string;
  companyId: string;
  cause: 'RWC_EXPIRED' | 'SERVICE_INTERVAL' | 'SAFETY_FAIL' | 'MANUAL';
  notes: string | null;
  tripId: string | null;
  openedAt: string;
  clearedAt: string | null;
  clearedNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listVehicleMaintenanceOrders(vehicleId: string) {
  return http
    .get<VehicleMaintenanceWorkOrder[]>(`/carrier/vehicles/${vehicleId}/maintenance-orders`)
    .then((r) => r.data);
}

export type FleetAssetSuggestion = {
  vehicleId: string;
  registration: string | null;
  label: string | null;
  vehicleClass: string | null;
  undersized: boolean;
  classDelta: number;
  idleScore: number;
  profitScore: number;
  busy: boolean;
  reason: string;
};

export type FleetAssetSuggestions = {
  jobId: string;
  minVehicleClass: string | null;
  suggestions: {
    closest: FleetAssetSuggestion | null;
    leastIdle: FleetAssetSuggestion | null;
    mostProfitable: FleetAssetSuggestion | null;
  };
  eligibleCount: number;
};

export function suggestFleetAssetsForJob(jobId: string) {
  return http
    .get<FleetAssetSuggestions>(`/carrier/fleet/suggest/${jobId}`)
    .then((r) => r.data);
}
