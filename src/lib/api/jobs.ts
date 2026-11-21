import { http } from '@/lib/http';

export type JobEditMode = 'FULL' | 'RECEIVER' | 'NONE';

export type JobSummary = {
  id: string;
  status: string;
  pricingModel: string;
  title: string | null;
  receiverName?: string | null;
  receiverEmail?: string | null;
  receiverPhone?: string | null;
  receiverAltEmail?: string | null;
  receiverAltPhone?: string | null;
  deadWeightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  loadTypes?: string[];
  loadTypeSubtypes?: string[];
  hourlyPattern?: string | null;
  minVehicleClass: string | null;
  recommendedVehicleClass: string | null;
  pricingVehicleClass?: string | null;
  chargeableWeightKg: number | null;
  siteManeuverability?: string | null;
  siteFacility?: string | null;
  siteDisclaimerAcceptedAt?: string | null;
  requiresDg: boolean;
  requiresReefer?: boolean;
  isBackhaul?: boolean;
  dgDocumentId?: string | null;
  dgDocumentFilename?: string | null;
  createdAt?: string;
  publishedAt?: string | null;
  /** Set when sender asked to go live but Ops/invoice still blocking. */
  publishRequestedAt?: string | null;
  pickupAt?: string | null;
  /** Trip completion time when the job finished. */
  completedAt?: string | null;
  route: {
    distanceKm: number | null;
    durationMinutes: number | null;
    fatigueBreakMinutes: number;
    billableHours: number | null;
    mock: boolean;
  };
  estimate: {
    exGstCents: number | null;
    gstCents: number | null;
    incGstCents: number | null;
  };
  /** Sender-facing hard floor snapshot (Wave 1+). */
  rateFloor?: {
    versionId: string | null;
    exGstCents: number | null;
    incGstCents: number | null;
    breakdown?: Record<string, unknown> | null;
  } | null;
  openProposalCount?: number;
  editability?: { mode: JobEditMode; reason: string };
  /** Present on sender list + detail — used for Pending payment vs Paid & locked chips. */
  assignment?: {
    id: string;
    status: string;
    lockedAt: string | null;
    paidAndConfirmed: boolean;
  } | null;
  trip?: { id: string; status: string; completedAt?: string | null } | null;
  proposals?: Array<{
    id: string;
    status: string;
    amountIncGstCents: number;
    etaMinutes: number | null;
    carrierLabel: string;
    carrierCompanyId?: string;
    carrierCompanyIdMasked?: boolean;
    /** Present when identity is masked (pre-completion). */
    reliabilityScore?: number | null;
    carrierCompany?: {
      id: string;
      legalName: string;
      tradingName?: string | null;
      email?: string | null;
      phone?: string | null;
      abn?: string | null;
      reliabilityScore?: number | null;
    } | null;
    vehicleClass: string | null;
    vehicleLabel?: string | null;
    vehicleRegistration?: string | null;
    driver?: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      licenceClass?: string | null;
    } | null;
    dgDocumentId?: string | null;
    dgDocumentFilename?: string | null;
    dgVerified?: boolean;
    /** Omitted on sender job detail (split math hidden). */
    netToCarrierCents?: number;
  }>;
  payment?: {
    id: string;
    status: string;
    amountIncGstCents: number;
    stripePaymentIntentId: string | null;
    type?: string;
  } | null;
  openException?: {
    id: string;
    kind: string;
    phase: string;
    status: string;
    note: string | null;
    openedAt: string;
    escalatedAt: string | null;
    proposedVehicleId?: string | null;
    proposedDriverId?: string | null;
    proposedAt?: string | null;
    proposedVehicle?: {
      id: string;
      registration: string | null;
      label: string | null;
      vehicleClass: string | null;
    } | null;
    proposedDriver?: { id: string; email: string | null; name: string | null } | null;
  } | null;
  loadProfile?: {
    peakOnboardKg: number;
    totalPickupKg: number;
    segments: Array<{
      sequence: number;
      stopType: string;
      weightKg: number | null;
      onboardKgAfter: number;
    }>;
  } | null;
  stops: Array<{
    id?: string;
    sequence: number;
    stopType: string;
    label?: string | null;
    addressLine?: string | null;
    suburb: string | null;
    state: string | null;
    postcode?: string | null;
    lat?: number | null;
    lng?: number | null;
    receiverName?: string | null;
    receiverEmail?: string | null;
    weightKg?: number | null;
  }>;
};

export type SenderFeeBreakdown = {
  mode: 'EXCLUSIVE' | 'INCLUSIVE';
  feePercent: number;
  baseIncGstCents: number;
  feeIncGstCents: number;
  chargeIncGstCents: number;
};

export type AcceptProposalResult = {
  paymentEventId: string;
  paymentStatus: string;
  amountIncGstCents: number;
  stripePaymentIntentId: string | null;
  jobId: string | null;
  assignmentId: string | null;
  assignmentStatus: string | null;
  lockedAt: string | null;
  paidAndConfirmed: boolean;
  idempotentReplay: boolean;
  clientSecret?: string | null;
  publishableKey?: string | null;
  stripeStatus?: string;
  mock?: boolean;
  message?: string;
  senderFee?: SenderFeeBreakdown;
};

export type ProposalChargePreview = {
  proposalId: string;
  jobId: string;
  baseIncGstCents: number;
  feeIncGstCents: number;
  chargeIncGstCents: number;
  feePercent: number;
  mode: 'EXCLUSIVE' | 'INCLUSIVE';
  senderFeeOverrideId: string | null;
};

export type CarrierAssignment = {
  id: string;
  status: string;
  lockedAt: string | null;
  paidAndConfirmed: boolean;
  tripBlockedUntilPaid: boolean;
  canReassign: boolean;
  /** Present when a trip exception blocks direct reassign (use Exceptions → sender approve). */
  openTripExceptionId?: string | null;
  openTripExceptionStatus?: string | null;
  openTripExceptionKind?: string | null;
  amountIncGstCents: number;
  /** Expected carrier net from accepted bid. */
  netToCarrierCents?: number;
  carrierPercent?: number;
  etaMinutes: number | null;
  job: {
    id: string;
    title: string | null;
    status: string;
    pricingModel: string;
    estimateIncGstCents: number | null;
    minVehicleClass: string | null;
  };
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
};

export type MarketBoardJob = {
  id: string;
  title: string | null;
  status: string;
  pricingModel: string;
  minVehicleClass: string | null;
  requiresDg: boolean;
  dgDocumentId?: string | null;
  dgDocumentFilename?: string | null;
  requiresReefer: boolean;
  requiresOversize?: boolean;
  deadWeightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  chargeableWeightKg?: number | null;
  estimateIncGstCents: number | null;
  /** Guide net from sender estimate (pre-bid). */
  estimateNetToCarrierCents: number | null;
  /** Submitted bid gross when alreadyBid. */
  myBidIncGstCents?: number | null;
  /** Net from submitted bid when alreadyBid. */
  myNetToCarrierCents?: number | null;
  /** Prefer bid net when present; else estimate net. */
  displayNetToCarrierCents?: number | null;
  routeDistanceKm: number | null;
  routeDurationMinutes?: number | null;
  routeFatigueBreakMinutes: number;
  billableHours: number | null;
  marketplacePriority?: boolean;
  rescueDiscountPercent?: number | null;
  /** Gross settlement floor (internal). Prefer minBidNetToCarrierCents in carrier UI. */
  minBidIncGstCents?: number | null;
  /** Carrier-facing minimum payout (net inc GST). */
  minBidNetToCarrierCents?: number | null;
  rateFloorVersionId?: string | null;
  rateFloorVersionLabel?: string | null;
  siteManeuverability?: string | null;
  siteFacility?: string | null;
  pickupAt: string | null;
  publishedAt: string | null;
  alreadyBid: boolean;
  loadProfile?: {
    peakOnboardKg: number;
    totalPickupKg: number;
    segments: Array<{
      sequence: number;
      stopType: string;
      weightKg: number | null;
      onboardKgAfter: number;
    }>;
  } | null;
  stops?: Array<{
    sequence: number;
    stopType: string;
    addressLine?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    weightKg?: number | null;
  }>;
  stopsSummary: string;
};

export type MarketBoard = {
  netPayoutHint: string;
  /** Effective carrier % for this company (national ± uplift). */
  carrierPercent?: number;
  nationalCarrierPercent?: number;
  carrierReliabilityScore?: number;
  carrierReliabilityTier?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'CRITICAL';
  jobs: MarketBoardJob[];
};

export function listSenderJobs() {
  return http.get<JobSummary[]>('/jobs').then((r) => r.data);
}

export function getSenderJob(id: string) {
  return http.get<JobSummary>(`/jobs/${id}`).then((r) => r.data);
}

export function createJob(payload: Record<string, unknown>) {
  return http.post<JobSummary>('/jobs', payload).then((r) => r.data);
}

export function updateJob(id: string, payload: Record<string, unknown>) {
  return http.patch<JobSummary>(`/jobs/${id}`, payload).then((r) => r.data);
}

export function updateJobReceiver(
  id: string,
  payload: {
    receiverName: string;
    receiverEmail: string;
    receiverPhone?: string | null;
    receiverAltEmail?: string | null;
    receiverAltPhone?: string | null;
    stops?: Array<{
      id: string;
      receiverName?: string | null;
      receiverEmail?: string | null;
    }>;
  },
) {
  return http.patch<JobSummary>(`/jobs/${id}/receiver`, payload).then((r) => r.data);
}

export function publishJob(id: string) {
  return http.post<JobSummary>(`/jobs/${id}/publish`, {}).then((r) => r.data);
}

export type RequestPublishResult = {
  status: 'READY' | 'BLOCKED';
  next: 'publish' | 'onboarding' | 'waiting_ops';
  href: string | null;
  goNoGo: {
    opsApproved: boolean;
    invoiceComplete: boolean;
    paymentReady: boolean;
    accountActive: boolean;
    canDraft: boolean;
    canPublishLive: boolean;
    canBook: boolean;
  };
  blockers?: string[];
  job: JobSummary;
};

/** Publishes when eligible; otherwise stamps publishRequestedAt and returns onboarding next. */
export function requestPublishJob(id: string) {
  return http
    .post<RequestPublishResult>(`/jobs/${id}/request-publish`, {})
    .then((r) => r.data);
}

export function cancelJob(id: string) {
  return http.post<{ id: string; status: string }>(`/jobs/${id}/cancel`, {}).then((r) => r.data);
}

export function withdrawProposal(proposalId: string) {
  return http
    .post<{ id: string; jobId: string; status: string }>(`/matching/proposals/${proposalId}/withdraw`, {})
    .then((r) => r.data);
}

export function withdrawProposalByJobId(jobId: string) {
  return http
    .post<{ id: string; jobId: string; status: string }>(`/matching/jobs/${jobId}/withdraw`, {})
    .then((r) => r.data);
}

export function previewProposalCharge(jobId: string, proposalId: string) {
  return http
    .get<ProposalChargePreview>(`/jobs/${jobId}/proposals/${proposalId}/charge-preview`)
    .then((r) => r.data);
}

export function acceptProposal(jobId: string, proposalId: string) {
  return http
    .post<AcceptProposalResult>(`/jobs/${jobId}/proposals/${proposalId}/accept`, {})
    .then((r) => r.data);
}

/** After SCA / webhook lag — re-read PaymentIntent from Stripe and lock if succeeded. */
export function syncJobPayment(jobId: string) {
  return http
    .post<AcceptProposalResult>(`/payments/jobs/${jobId}/sync`, {})
    .then((r) => r.data);
}

export function getCarrierAssignments() {
  return http.get<CarrierAssignment[]>('/payments/assignments').then((r) => r.data);
}

export function getJobPayment(jobId: string) {
  return http.get(`/payments/jobs/${jobId}`).then((r) => r.data);
}

export function recommendVehicle(payload: {
  deadWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  peakOnboardKg?: number;
}) {
  return http
    .post<{
      chargeableWeightKg: number;
      peakOnboardKg?: number | null;
      classWeightKg?: number;
      recommendedVehicleClass: string;
    }>('/jobs/meta/recommend', payload)
    .then((r) => r.data);
}

export type JobRouteEstimate = {
  distanceKm: number;
  durationMinutes: number;
  drivingMinutes: number;
  fatigueBreakMinutes: number;
  billableHours: number | null;
  minBillableHours?: number | null;
  hourlyRateCents?: number | null;
  perKmRateCents?: number | null;
  minBaseCents?: number;
  minChargeIncGstCents?: number;
  estimateIncGstCents?: number;
  pricingVehicleClass?: string;
  estimateRange?: {
    minIncGstCents: number;
    maxIncGstCents: number;
    maxClassCode: string | null;
  };
  rateFloorExGstCents?: number | null;
  rateFloorIncGstCents?: number | null;
  rateFloorVersionId?: string | null;
  mock: boolean;
};

export type RateFloorPreview = {
  floorExGstCents: number;
  floorIncGstCents: number;
  versionId: string;
  versionLabel: string;
  currency: string;
  message: string;
  breakdown: Record<string, unknown>;
};

export type RateFloorPreviewInput = {
  vehicleClassCode: string;
  pricingModel: 'PER_KM' | 'HOURLY';
  distanceKm?: number | null;
  billableHours?: number | null;
  at?: string | null;
  pickupState?: string | null;
  bodyCode?: 'DRY' | 'TAILLIFT' | 'REEFER' | 'TIPPER' | 'CRANE' | 'TANKER' | 'DG' | 'LIVESTOCK' | null;
  requiresReefer?: boolean | null;
  requiresDg?: boolean | null;
  backhaul?: boolean | null;
};

export function previewRateFloor(payload: RateFloorPreviewInput) {
  return http.post<RateFloorPreview>('/jobs/pricing/floor', payload).then((r) => r.data);
}

export function previewJobRoute(payload: {
  pricingModel: 'PER_KM' | 'HOURLY';
  stops: Array<Record<string, unknown>>;
  vehicleClass?: string;
}) {
  return http.post<JobRouteEstimate>('/jobs/route-estimate', payload).then((r) => r.data);
}

export function getMarketBoard() {
  return http.get<MarketBoard>('/matching/board').then((r) => r.data);
}

export function submitBid(payload: {
  jobId: string;
  vehicleId: string;
  driverId: string;
  amountIncGstCents: number;
  etaMinutes: number;
  dgDocumentId?: string | null;
}) {
  return http.post('/matching/bids', payload).then((r) => r.data);
}

export type VehicleClassItem = {
  id?: string;
  code: string;
  name?: string;
  rank: number;
  maxChargeableWeightKg: number;
  maxLengthCm: number;
  maxWidthCm: number;
  maxHeightCm: number;
  minLicenceClass: string;
  suggestedGvmKg?: number;
  suggestedTareKg?: number;
  isActive?: boolean;
};

export type VehicleClassesMetaResponse = {
  classes: VehicleClassItem[];
  classCodes: string[];
  ranks: Record<string, number>;
  minLicences: Record<string, string>;
  maxChargeableKg: Record<string, number>;
  maxDimsCm: Record<string, { lengthCm: number; widthCm: number; heightCm: number }>;
  suggestedGvmKg: Record<string, number>;
  suggestedTareKg: Record<string, number>;
  chargeableFormula: string;
};

export function getVehicleClassesMeta() {
  return http.get<VehicleClassesMetaResponse>('/jobs/meta/vehicle-classes').then((r) => r.data);
}

export type RegionMetaItem = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  territories: Array<{
    id: string;
    code: string;
    name: string;
    enabled: boolean;
  }>;
};

export type RegionsMetaResponse = {
  regions: RegionMetaItem[];
  enabledCodes: string[];
};

export function getRegionsMeta() {
  return http.get<RegionsMetaResponse>('/jobs/meta/regions').then((r) => r.data);
}
