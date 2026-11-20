import type {
  AdminAuditQuery,
  AdminCompanyListQuery,
  AdminDashboardQuery,
  AdminLeadExportQuery,
  AdminLeadListQuery,
  CompanyStatus,
  CompanyType,
  CreateLeadNoteInput,
  FinanceQuery,
  UpdateLeadInput,
  VehicleClassCreateInput,
  VehicleClassDto,
  VehicleClassUpdateInput,
} from '@/shared/types';
import { http } from '@/lib/http';
import type { AdminRef, LeadDetail, LeadListItem } from '@/lib/leads';

export type DashboardActivityItem = {
  id: string;
  leadId: string | null;
  actorId: string | null;
  action: string;
  metadata: unknown;
  createdAt: string;
  actor: AdminRef | null;
  lead: {
    id: string;
    type: string;
    email: string;
    companyName: string | null;
  } | null;
};

export type TimelinePoint = {
  date: string;
  label: string;
  jobs: number;
  trips: number;
  exceptions: number;
  senders: number;
  carriers: number;
  volumeCents: number;
};

export type DashboardStats = {
  totals: {
    all: number;
    today: number;
    week: number;
    registrySenders: number;
    registryCarriers: number;
    eoiStateMasters: number;
    eoiLocalBdes: number;
    investors: number;
  };
  byStatus: Record<string, number>;
  recentLeads: LeadListItem[];
  recentActivity: DashboardActivityItem[];

  period?: string;
  from?: string;
  to?: string;

  analytics?: {
    senders: {
      total: number;
      active: number;
      pending: number;
      inPeriod: number;
    };
    carriers: {
      total: number;
      active: number;
      pending: number;
      inPeriod: number;
    };
    trucks: {
      total: number;
      active: number;
      inTransit: number;
      pending: number;
      inPeriod: number;
      byClass: Record<string, number>;
    };
    drivers: {
      total: number;
      active: number;
      onTrip: number;
      pending: number;
      inPeriod: number;
    };
    receivers: {
      total: number;
      inPeriod: number;
      recent: Array<{
        name: string | null;
        email: string | null;
        phone: string | null;
        jobTitle?: string | null;
      }>;
    };
    breakdowns: {
      total: number;
      inPeriod: number;
      open: number;
      resolved: number;
      byKind: {
        breakdown: number;
        accident: number;
        traffic: number;
        driverUnavailable: number;
        other: number;
      };
      recent: Array<{
        id: string;
        tripId: string;
        kind: string;
        status: string;
        createdAt: string;
        note?: string | null;
        companyName: string;
      }>;
    };
    jobs: {
      total: number;
      inPeriod: number;
      active: number;
      assigned: number;
      inTransit: number;
      completed: number;
      cancelled: number;
      draft: number;
      totalEstimateCents: number;
      recent: Array<{
        id: string;
        title: string;
        status: string;
        pricingModel: string;
        estimateIncGstCents: number;
        receiverName: string | null;
        createdAt: string;
        companyName: string;
      }>;
    };
    trips: {
      total: number;
      inPeriod: number;
      active: number;
      completed: number;
      cancelled: number;
      breakdown: number;
    };
    timeline: TimelinePoint[];
  };
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditListItem = {
  id: string;
  leadId: string | null;
  actorId: string | null;
  action: string;
  metadata: unknown;
  createdAt: string;
  actor: AdminRef | null;
  lead: {
    id: string;
    type: string;
    email: string;
    companyName: string | null;
    status: string;
  } | null;
};

export function getDashboardStats(
  query?: AdminDashboardQuery,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<DashboardStats>('/admin/dashboard/stats', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}


export function listLeads(
  query: Partial<AdminLeadListQuery> = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<Paginated<LeadListItem>>('/admin/leads', {
      params: query,
      signal: options?.signal,
      paramsSerializer: {
        indexes: null,
      },
    })
    .then((res) => res.data);
}

export type CompanyRevenuePolicySummary = {
  hasCustomPolicy: boolean;
  nationalCarrierPercent: number;
  nationalFeePercent: number;
  minPlatformPercent: number;
  bonusPercent?: number;
  effectiveCarrierPercent?: number;
  feePercent?: number;
  inheritNational?: boolean;
};

export type CompanyListItem = {
  id: string;
  type: 'SENDER' | 'CARRIER';
  status: string;
  legalName: string;
  tradingName: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  suspendedNote: string | null;
  statusBeforeSuspend: string | null;
  reliabilityScore?: number;
  createdAt: string;
  updatedAt: string;
  homeRegion: { code: string; name: string } | null;
  openCase: { id: string; status: string; caseType: string } | null;
  counts: { users: number; vehicles: number; drivers: number };
  revenuePolicy?: CompanyRevenuePolicySummary;
};

export type PlatformSettings = {
  id: string;
  rescueDiscountPercent: number;
  marketplaceRelistSlaMs: number;
  driverUnavailableScoreDelta: number;
  carrierMarketplaceReleaseScoreDelta: number;
  carrierClearingDays: number;
  gstPercent: number;
  perKmRateCents?: number;
  perKmMinBaseCents?: number;
  hourlyRateCents?: number;
  hourlyMinFloorHours?: number;
  hourlyMinBaseCents?: number;
  settlementCycleCadenceDays?: number;
  settlementCutoffHour?: number;
  enableStateMasterTier?: boolean;
  senderPlatformFeePercent?: number;
  senderPlatformFeeMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  minPlatformPercent?: number;
  updatedAt: string;
};

export type PlatformSettingsPatch = {
  rescueDiscountPercent?: number;
  marketplaceRelistSlaMs?: number;
  driverUnavailableScoreDelta?: number;
  carrierMarketplaceReleaseScoreDelta?: number;
  carrierClearingDays?: number;
  gstPercent?: number;
  perKmRateCents?: number;
  perKmMinBaseCents?: number;
  hourlyRateCents?: number;
  hourlyMinFloorHours?: number;
  hourlyMinBaseCents?: number;
  settlementCycleCadenceDays?: number;
  settlementCutoffHour?: number;
  enableStateMasterTier?: boolean;
  senderPlatformFeePercent?: number;
  senderPlatformFeeMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  minPlatformPercent?: number;
};

export function getPlatformSettings(options?: { signal?: AbortSignal }) {
  return http
    .get<PlatformSettings>('/admin/platform-settings', { signal: options?.signal })
    .then((res) => res.data);
}

export function patchPlatformSettings(
  input: PlatformSettingsPatch,
  options?: { signal?: AbortSignal },
) {
  return http
    .patch<PlatformSettings>('/admin/platform-settings', input, { signal: options?.signal })
    .then((res) => res.data);
}

export function listAdminVehicleClasses(options?: { signal?: AbortSignal }) {
  return http
    .get<VehicleClassDto[]>('/admin/vehicle-classes', { signal: options?.signal })
    .then((res) => res.data);
}

export function createAdminVehicleClass(input: VehicleClassCreateInput) {
  return http.post<VehicleClassDto>('/admin/vehicle-classes', input).then((res) => res.data);
}

export function updateAdminVehicleClass(id: string, input: VehicleClassUpdateInput) {
  return http.patch<VehicleClassDto>(`/admin/vehicle-classes/${id}`, input).then((res) => res.data);
}

export function deleteAdminVehicleClass(id: string) {
  return http
    .delete<{ success: boolean; deletedCode: string }>(`/admin/vehicle-classes/${id}`)
    .then((res) => res.data);
}

export type RateFloorLineDto = {
  id: string;
  vehicleClassCode: string;
  hourlyFloorCents: number;
  kmFloorCents: number;
  variableKmCents: number;
  litresPerKm: number;
  basis: string;
};

export type RateFloorLabourMultiplierDto = {
  id: string;
  periodCode: string;
  multiplier: number;
};

export type RateFloorVersionDto = {
  id: string;
  label: string;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  effectiveFrom: string | null;
  referenceDieselCpl: number;
  labourRateHrCents: number;
  minHours: number;
  minKmChargeKm: number;
  backhaulFactor: number;
  createdByAdminId?: string | null;
  approvalSubmittedAt?: string | null;
  approvedByAdminId?: string | null;
  publishedByAdminId?: string | null;
  lines?: RateFloorLineDto[];
  labourMultipliers?: RateFloorLabourMultiplierDto[];
  bodyLoadings?: Array<{
    id: string;
    bodyCode: string;
    loadingPct: number;
    minHours: number | null;
  }>;
  _count?: { lines: number };
  createdAt: string;
  updatedAt: string;
};

export type RateFloorBodyLoadingDto = {
  id: string;
  bodyCode: string;
  loadingPct: number;
  minHours: number | null;
};

export type RateFloorOverrideDto = {
  id: string;
  jobId: string;
  approvedByAdminId: string;
  approvedByAdmin?: { id: string; email: string; name: string | null } | null;
  reason: string;
  expiresAt: string;
  floorExGstCentsOverride: number;
  createdAt: string;
};

export type RateFloorCheckDto = {
  id: string;
  jobId: string | null;
  actorUserId: string | null;
  actorAdminId: string | null;
  versionId: string;
  floorExGstCents: number;
  floorIncGstCents: number;
  offeredIncGstCents: number | null;
  result: 'PASS' | 'REJECT' | 'OVERRIDE';
  createdAt: string;
};

export type PublicHolidayDto = {
  id: string;
  state: string;
  holidayDate: string;
  name: string;
  createdAt: string;
};

export function listAdminRateFloorVersions(options?: { signal?: AbortSignal }) {
  return http
    .get<RateFloorVersionDto[]>('/admin/rate-floor/versions', { signal: options?.signal })
    .then((res) => res.data);
}

export function getAdminRateFloorVersion(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<RateFloorVersionDto>(`/admin/rate-floor/versions/${id}`, { signal: options?.signal })
    .then((res) => res.data);
}

export function createAdminRateFloorDraft(input?: { label?: string }) {
  return http
    .post<RateFloorVersionDto>('/admin/rate-floor/versions', input ?? {})
    .then((res) => res.data);
}

export function patchAdminRateFloorLine(
  versionId: string,
  code: string,
  input: {
    hourlyFloorCents?: number;
    kmFloorCents?: number;
    variableKmCents?: number;
    litresPerKm?: number;
    basis?: 'V' | 'W' | 'D';
  },
) {
  return http
    .patch<RateFloorLineDto>(
      `/admin/rate-floor/versions/${versionId}/lines/${encodeURIComponent(code)}`,
      input,
    )
    .then((res) => res.data);
}

export function patchAdminRateFloorBody(
  versionId: string,
  code: string,
  input: { loadingPct?: number; minHours?: number | null },
) {
  return http
    .patch<RateFloorBodyLoadingDto>(
      `/admin/rate-floor/versions/${versionId}/body/${encodeURIComponent(code)}`,
      input,
    )
    .then((res) => res.data);
}

export function listAdminRateFloorChecks(options?: {
  signal?: AbortSignal;
  jobId?: string;
  result?: 'PASS' | 'REJECT' | 'OVERRIDE';
  from?: string;
  to?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.jobId) params.set('jobId', options.jobId);
  if (options?.result) params.set('result', options.result);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.limit != null) params.set('limit', String(options.limit));
  const qs = params.toString();
  return http
    .get<RateFloorCheckDto[]>(`/admin/rate-floor/checks${qs ? `?${qs}` : ''}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export async function exportAdminRateFloorChecksCsv(
  query: {
    jobId?: string;
    result?: 'PASS' | 'REJECT' | 'OVERRIDE';
    from?: string;
    to?: string;
  } = {},
  options?: { signal?: AbortSignal },
) {
  const response = await http.get<Blob>('/admin/rate-floor/checks/export', {
    params: query,
    signal: options?.signal,
    responseType: 'blob',
  });
  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  anchor.href = url;
  anchor.download = match?.[1] ?? 'clox-rate-floor-checks.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  return blob;
}

export function expireAdminRateFloorOverride(id: string) {
  return http
    .post<RateFloorOverrideDto>(`/admin/rate-floor/overrides/${id}/expire`)
    .then((res) => res.data);
}

export function listAdminPublicHolidays(options?: {
  signal?: AbortSignal;
  state?: string;
}) {
  const params = new URLSearchParams();
  if (options?.state) params.set('state', options.state);
  const qs = params.toString();
  return http
    .get<PublicHolidayDto[]>(`/admin/public-holidays${qs ? `?${qs}` : ''}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function upsertAdminPublicHoliday(input: {
  state: string;
  holidayDate: string;
  name: string;
}) {
  return http
    .post<PublicHolidayDto>('/admin/public-holidays', input)
    .then((res) => res.data);
}

export function deleteAdminPublicHoliday(id: string) {
  return http
    .delete<{ success: boolean }>(`/admin/public-holidays/${id}`)
    .then((res) => res.data);
}

export function submitAdminRateFloorApproval(id: string) {
  return http
    .post<RateFloorVersionDto>(`/admin/rate-floor/versions/${id}/submit-approval`)
    .then((res) => res.data);
}

export function withdrawAdminRateFloorApproval(id: string) {
  return http
    .post<RateFloorVersionDto>(`/admin/rate-floor/versions/${id}/withdraw-approval`)
    .then((res) => res.data);
}

export function publishAdminRateFloorVersion(id: string) {
  return http
    .post<RateFloorVersionDto>(`/admin/rate-floor/versions/${id}/publish`)
    .then((res) => res.data);
}

export function listAdminRateFloorOverrides(options?: {
  signal?: AbortSignal;
  jobId?: string;
  activeOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.jobId) params.set('jobId', options.jobId);
  if (options?.activeOnly) params.set('activeOnly', 'true');
  const qs = params.toString();
  return http
    .get<RateFloorOverrideDto[]>(`/admin/rate-floor/overrides${qs ? `?${qs}` : ''}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function createAdminRateFloorOverride(input: {
  jobId: string;
  reason: string;
  expiresAt: string;
  floorExGstCentsOverride: number;
}) {
  return http
    .post<RateFloorOverrideDto>('/admin/rate-floor/overrides', input)
    .then((res) => res.data);
}

export type FuelIndexDto = {
  id: string;
  weekStart: string;
  dieselCpl: number;
  note: string | null;
  enteredByAdminId?: string | null;
  confirmedByAdminId?: string | null;
  createdAt: string;
  movePercent?: number;
  confirmed?: boolean;
};

export type FuelIndexStatusDto = {
  latest: {
    id: string;
    weekStart: string;
    dieselCpl: number;
    note: string | null;
    createdAt: string;
  } | null;
  ageDays: number | null;
  isStale: boolean;
  fuelStaleDays: number;
  fuelMoveConfirmPercent: number;
  fuelWeeklyChangeCapPercent: number;
};

export function getAdminFuelIndexStatus(options?: { signal?: AbortSignal }) {
  return http
    .get<FuelIndexStatusDto>('/admin/fuel-index/status', { signal: options?.signal })
    .then((res) => res.data);
}

export function listAdminFuelIndexes(options?: { signal?: AbortSignal }) {
  return http
    .get<FuelIndexDto[]>('/admin/fuel-index', { signal: options?.signal })
    .then((res) => res.data);
}

export function createAdminFuelIndex(input: {
  weekStart?: string;
  dieselCpl: number;
  note?: string;
  confirm?: boolean;
}) {
  return http.post<FuelIndexDto>('/admin/fuel-index', input).then((res) => res.data);
}

export type DisableCompanyInput = {
  reason: string;
  note?: string;
};

export type CompanyDisableResult = {
  id: string;
  status: string;
  statusBeforeSuspend: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  suspendedNote: string | null;
  cascade: {
    usersSuspended: number;
    driversSuspended: number;
    vehiclesSuspended: number;
    sessionsRevoked: number;
  };
};

export function listCompanies(
  query: Partial<AdminCompanyListQuery> = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<Paginated<CompanyListItem>>('/admin/companies', {
      params: query,
      signal: options?.signal,
      paramsSerializer: {
        indexes: null,
      },
    })
    .then((res) => res.data);
}

export function disableCompany(
  id: string,
  payload: DisableCompanyInput,
  options?: { signal?: AbortSignal },
) {
  return http
    .post<CompanyDisableResult>(`/admin/companies/${id}/disable`, payload, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function reactivateCompany(id: string, options?: { signal?: AbortSignal }) {
  return http
    .post<Omit<CompanyDisableResult, 'cascade'>>(`/admin/companies/${id}/reactivate`, undefined, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function deleteCompany(id: string, options?: { signal?: AbortSignal }) {
  return http
    .delete<{ ok: true; id: string }>(`/admin/companies/${id}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type CompanyComplianceDoc = {
  id: string;
  docType: string;
  status: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export type CompanyDetailVehicle = {
  id: string;
  label: string | null;
  registration: string;
  vehicleClass: string;
  tareKg: number;
  gvmKg: number;
  gcmKg: number | null;
  status: string;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledNote: string | null;
  createdAt: string;
  documents: CompanyComplianceDoc[];
};

export type CompanyDetailDriver = {
  id: string;
  status: string;
  licenceNo: string | null;
  licenceClass: string | null;
  licenceExpiry: string | null;
  reliabilityScore: number;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledNote: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    status: string;
  };
  documents: CompanyComplianceDoc[];
};

export type CompanyDetail = {
  company: {
    id: string;
    type: CompanyType;
    status: CompanyStatus;
    legalName: string;
    tradingName: string | null;
    abn: string | null;
    acn: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    homeRegion: { code: string; name: string } | null;
    serviceRegionCodes: string[];
    capabilities: string[];
    stripeConnectAccountId: string | null;
    stripeConnectPayoutsEnabled: boolean;
    reliabilityScore: number;
    suspendedAt: string | null;
    suspendedReason: string | null;
    suspendedNote: string | null;
    statusBeforeSuspend: CompanyStatus | null;
    referredAt: string | null;
    referredByAdminUser: { id: string; name: string | null; email: string; role: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  documents: CompanyComplianceDoc[];
  vehicles: CompanyDetailVehicle[];
  drivers: CompanyDetailDriver[];
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt: string;
  }>;
  complianceCases: Array<{
    id: string;
    caseType: string;
    status: string;
    decisionNote: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export function getCompany(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<CompanyDetail>(`/admin/companies/${id}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function getLead(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<LeadDetail>(`/admin/leads/${id}`, { signal: options?.signal })
    .then((res) => res.data);
}

export function updateLead(
  id: string,
  payload: UpdateLeadInput,
  options?: { signal?: AbortSignal },
) {
  return http
    .patch<LeadListItem>(`/admin/leads/${id}`, payload, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function deleteLead(id: string, options?: { signal?: AbortSignal }) {
  return http
    .delete<{ ok: true; id: string }>(`/admin/leads/${id}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function addLeadNote(
  id: string,
  payload: CreateLeadNoteInput,
  options?: { signal?: AbortSignal },
) {
  return http
    .post(`/admin/leads/${id}/notes`, payload, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function listAudit(
  query: Partial<AdminAuditQuery> = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<Paginated<AuditListItem>>('/admin/audit', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

/** Uses Axios blob responseType for CSV download. */
export async function exportLeadsCsv(
  query: Partial<AdminLeadExportQuery> = {},
  options?: { signal?: AbortSignal },
) {
  const response = await http.get<Blob>('/admin/leads/export', {
    params: query,
    signal: options?.signal,
    responseType: 'blob',
  });

  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  anchor.href = url;
  anchor.download = match?.[1] ?? 'clox-leads.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  return blob;
}

export type AdminJobListItem = {
  id: string;
  status: string;
  title: string | null;
  pricingModel: string;
  receiverName: string | null;
  receiverEmail: string | null;
  estimateIncGstCents: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  senderCompany: {
    id: string;
    legalName: string;
    email: string | null;
    type: string;
  };
  assignment: {
    id: string;
    status: string;
    lockedAt: string | null;
    carrierCompany: { id: string; legalName: string } | null;
    vehicle?: { id: string; registration: string; vehicleClass: string } | null;
    driver?: {
      id: string;
      user?: { email?: string | null; name?: string | null } | null;
    } | null;
  } | null;
  trip: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    /** Every dropoff POD FINALIZED; trip not COMPLETED yet (awaiting driver exit). */
    podAwaitingExit?: boolean;
  } | null;
  proposalCount: number;
  canHardDelete: boolean;
  canSoftDelete: boolean;
};

export type AdminJobDocMeta = {
  id: string;
  docType: string;
  status: string;
  originalFilename: string | null;
};

export type AdminJobDetail = AdminJobListItem & {
  minVehicleClass?: string | null;
  receiverPhone?: string | null;
  requiresDg?: boolean;
  requiresReefer?: boolean;
  requiresOversize?: boolean;
  deadWeightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  chargeableWeightKg?: number | null;
  routeDistanceKm?: number | null;
  billableHours?: number | null;
  dgDocument?: AdminJobDocMeta | null;
  senderCompany: AdminJobListItem['senderCompany'] & {
    tradingName?: string | null;
    phone?: string | null;
    status?: string;
  };
  assignment: (NonNullable<AdminJobListItem['assignment']> & {
    carrierCompany: {
      id: string;
      legalName: string;
      tradingName?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: string;
    } | null;
    vehicle?: {
      id: string;
      registration: string | null;
      label?: string | null;
      vehicleClass: string | null;
      status?: string;
    } | null;
    driver?: {
      id: string;
      status?: string;
      licenceClass?: string | null;
      user?: {
        email?: string | null;
        name?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    proposal?: {
      id: string;
      amountIncGstCents: number;
      etaMinutes: number | null;
      dgDocument?: AdminJobDocMeta | null;
    } | null;
  }) | null;
  trip: (NonNullable<AdminJobListItem['trip']> & {
    safetyPassedAt?: string | null;
    massCheckOk?: boolean | null;
    podStorageKey?: string | null;
    taxInvoiceStorageKey?: string | null;
    runSheetStorageKey?: string | null;
    dropoffs?: Array<{
      jobStopId: string;
      sequence: number;
      suburb: string | null;
      podStatus: string;
      signedAt: string | null;
      signerName: string | null;
      podFinalizedAt: string | null;
      goodsPhotoCount: number;
      hasPodPackage: boolean;
      hasSignaturePdf: boolean;
    }>;
  }) | null;
  stops: Array<{
    id: string;
    sequence: number;
    stopType: string;
    suburb: string | null;
    state: string | null;
    postcode?: string | null;
    addressLine: string | null;
    receiverName: string | null;
    receiverEmail: string | null;
    receiverPhone?: string | null;
    notes?: string | null;
    windowStart?: string | null;
    windowEnd?: string | null;
  }>;
  proposals: Array<{
    id: string;
    status: string;
    amountIncGstCents: number;
    etaMinutes: number | null;
    createdAt: string;
    carrierCompany: {
      id: string;
      legalName: string;
      tradingName?: string | null;
      email?: string | null;
    };
    vehicle?: {
      id: string;
      registration: string | null;
      label?: string | null;
      vehicleClass: string | null;
    } | null;
    driver?: {
      id: string;
      user?: {
        email?: string | null;
        name?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    dgDocument?: AdminJobDocMeta | null;
  }>;
  paymentEvents: Array<{
    id: string;
    type?: string;
    status: string;
    amountIncGstCents: number;
    stripePaymentIntentId: string | null;
    createdAt: string;
  }>;
};

export type AdminJobListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
};

export function listAdminJobs(
  query: AdminJobListQuery = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<Paginated<AdminJobListItem>>('/admin/jobs', {
      params: query,
      signal: options?.signal,
      paramsSerializer: { indexes: null },
    })
    .then((res) => res.data);
}

export function getAdminJob(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<AdminJobDetail>(`/admin/jobs/${id}`, { signal: options?.signal })
    .then((res) => res.data);
}

export function hardDeleteAdminJob(id: string, options?: { signal?: AbortSignal }) {
  return http
    .delete<{ id: string; deleted: true; mode: 'hard' }>(`/admin/jobs/${id}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function softDeleteAdminJob(id: string, options?: { signal?: AbortSignal }) {
  return http
    .post<{ id: string; deleted: false; mode: 'soft'; status: string }>(
      `/admin/jobs/${id}/soft-delete`,
      undefined,
      { signal: options?.signal },
    )
    .then((res) => res.data);
}

export type RevenueSplitPercents = {
  carrierPercent: number;
  superPercent: number;
  statePercent: number;
  localPercent: number;
  cloxSuperPercent?: number;
  cloxStatePercent?: number;
  cloxLocalPercent?: number;
};

export type CloxPoolPercents = {
  cloxSuperPercent: number;
  cloxStatePercent: number;
  cloxLocalPercent: number;
};

export type RevenueSplitSettings = {
  carrierPercentFixed: number;
  carrierPercent?: number;
  platformPercentFixed: number;
  platformPercent?: number;
  cloxPool?: CloxPoolPercents;
  effective: {
    policyVersionId: string | null;
    percents: RevenueSplitPercents;
    cloxPool?: CloxPoolPercents;
    payload: unknown;
    publishedAt: string | null;
    version: number | null;
  };
  draft: {
    id: string;
    version: number;
    payload: unknown;
    createdAt: string;
  } | null;
};

export type RevenueSplitVersionItem = {
  id: string;
  version: number;
  payload: unknown;
  publishedAt: string | null;
  publishedBy: { id: string; email: string; name: string | null } | null;
  createdAt: string;
};

export type RevenueSplitOverrideItem = {
  id: string;
  scopeType: 'REGION' | 'TERRITORY';
  scopeId: string;
  superPercent: number;
  statePercent: number;
  localPercent: number;
  effectiveFrom: string;
  publishedAt: string | null;
  notes: string | null;
  publisher: { id: string; email: string; name: string | null } | null;
};

export type RevenueSplitScopes = {
  regions: Array<{ id: string; code: string; name: string; enabled: boolean }>;
  territories: Array<{
    id: string;
    code: string;
    name: string;
    enabled: boolean;
    regionId: string;
    region: { code: string; name: string };
  }>;
};

export function getRevenueSplitSettings(options?: { signal?: AbortSignal }) {
  return http
    .get<RevenueSplitSettings>('/admin/settings/revenue-split', {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function listRevenueSplitVersions(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: RevenueSplitVersionItem[] }>('/admin/settings/revenue-split/versions', {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function listRevenueSplitOverrides(options?: { signal?: AbortSignal }) {
  return http
    .get<{ items: RevenueSplitOverrideItem[] }>('/admin/settings/revenue-split/overrides', {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function listRevenueSplitScopes(options?: { signal?: AbortSignal }) {
  return http
    .get<RevenueSplitScopes>('/admin/settings/revenue-split/scopes', {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function draftRevenueSplit(
  input: {
    carrierPercent?: number;
    superPercent?: number;
    statePercent?: number;
    localPercent?: number;
    cloxSuperPercent?: number;
    cloxStatePercent?: number;
    cloxLocalPercent?: number;
    notes?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/draft', input, { signal: options?.signal })
    .then((res) => res.data);
}

export function publishRevenueSplit(
  input: {
    draftId?: string;
    carrierPercent?: number;
    superPercent?: number;
    statePercent?: number;
    localPercent?: number;
    cloxSuperPercent?: number;
    cloxStatePercent?: number;
    cloxLocalPercent?: number;
    notes?: string;
    effectiveFrom?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/publish', input, { signal: options?.signal })
    .then((res) => res.data);
}

export function publishRevenueSplitOverride(
  input: {
    scopeType: 'REGION' | 'TERRITORY';
    scopeId: string;
    superPercent: number;
    statePercent: number;
    localPercent: number;
    notes?: string;
    effectiveFrom?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/overrides', input, { signal: options?.signal })
    .then((res) => res.data);
}

export type AdminRevenueSplitPackageItem = {
  id: string;
  adminUserId: string;
  superPercent: number;
  statePercent: number;
  localPercent: number;
  effectiveFrom: string;
  publishedAt: string | null;
  notes: string | null;
  adminUser?: { id: string; email: string; name: string | null; role: string };
  publisher?: { id: string; email: string; name: string | null } | null;
};

export function listAdminRevenueSplitPackages(
  query: { adminUserId?: string } = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<{ items: AdminRevenueSplitPackageItem[] }>(
      '/admin/settings/revenue-split/admin-packages',
      { params: query, signal: options?.signal },
    )
    .then((res) => res.data);
}

export function publishAdminRevenueSplitPackage(
  input: {
    adminUserId: string;
    superPercent: number;
    statePercent: number;
    localPercent: number;
    notes?: string;
    effectiveFrom?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/admin-packages', input, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type CompanyRevenueUpliftItem = {
  id: string;
  companyId: string;
  bonusPercent: number;
  effectiveFrom: string;
  publishedAt: string | null;
  notes: string | null;
  publisher?: { id: string; email: string; name: string | null } | null;
};

export type CompanySenderFeeOverrideItem = {
  id: string;
  companyId: string;
  feePercent: number;
  inheritNational?: boolean;
  effectiveFrom: string;
  publishedAt: string | null;
  notes: string | null;
  publisher?: { id: string; email: string; name: string | null } | null;
};

export function listCarrierRevenueUplifts(
  companyId: string,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<{ items: CompanyRevenueUpliftItem[] }>(
      `/admin/settings/revenue-split/carrier-uplifts/${companyId}`,
      { signal: options?.signal },
    )
    .then((res) => res.data);
}

export function publishCarrierRevenueUplift(
  input: {
    companyId: string;
    bonusPercent: number;
    notes?: string;
    effectiveFrom?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/carrier-uplifts', input, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function listSenderFeeOverrides(
  companyId: string,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<{ items: CompanySenderFeeOverrideItem[] }>(
      `/admin/settings/revenue-split/sender-fee-overrides/${companyId}`,
      { signal: options?.signal },
    )
    .then((res) => res.data);
}

export function publishSenderFeeOverride(
  input: {
    companyId: string;
    feePercent?: number;
    inheritNational?: boolean;
    notes?: string;
    effectiveFrom?: string;
  },
  options?: { signal?: AbortSignal },
) {
  return http
    .post('/admin/settings/revenue-split/sender-fee-overrides', input, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type PartnerPerformanceHint =
  | 'above_median_bob'
  | 'below_median_bob'
  | 'near_default';

export type PartnerPerformanceItem = {
  id: string;
  email: string;
  name: string | null;
  /** Same label source as Admin partners (`company.legalName`). */
  companyLegalName?: string | null;
  role: 'STATE_MASTER' | 'LOCAL_BDE';
  status: string;
  scopes: Array<{
    scopeType: string;
    regionId: string | null;
    regionCode: string | null;
    territoryId: string | null;
    territoryCode: string | null;
  }>;
  primaryScope: {
    scopeType: 'REGION' | 'TERRITORY';
    scopeId: string;
    label: string;
  } | null;
  bob: {
    sendersReferred: number;
    carriersReferred: number;
    activeCompanies: number;
  };
  seat: {
    jobs90d: number;
    grossIncGstCents90d: number;
    accruedAdminCents90d: number;
    peersOnSameTerritory: number;
  };
  split: {
    national: RevenueSplitPercents;
    package: {
      id: string;
      superPercent: number;
      statePercent: number;
      localPercent: number;
      effectiveFrom: string;
    } | null;
    effectiveSuperPercent: number;
    effectiveLocalPercent: number;
    effectiveStatePercent: number;
  };
  hint: PartnerPerformanceHint;
};

export type PartnerPerformanceResponse = {
  windowDays: number;
  windowStart: string;
  national: RevenueSplitPercents;
  bobMedianActiveCompanies: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PartnerPerformanceItem[];
};

export function getPartnerPerformance(
  query: {
    role?: 'STATE_MASTER' | 'LOCAL_BDE';
    status?: string;
    regionId?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
  options?: { signal?: AbortSignal },
) {
  return http
    .get<PartnerPerformanceResponse>('/admin/settings/revenue-split/partner-performance', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type SuperFinanceOverview = {
  clearingDays?: number;
  summary: {
    gmvCents: number;
    platformRevenueCents: number;
    hqShareCents: number;
    hqHoldingCents: number;
    carrierPayoutsCents: number;
    carrierPaidCents: number;
    carrierPendingCents: number;
    partnerCommissionsCents: number;
    stateCommissionsCents: number;
    localCommissionsCents: number;
    netMarginPercent: number;
    activeJobsCount: number;
    completedJobsCount: number;
  };
  surcharges: {
    totalCount: number;
    totalAmountCents: number;
    paidCount: number;
    paidAmountCents: number;
    pendingCount: number;
    pendingAmountCents: number;
    waivedCount: number;
    waivedAmountCents: number;
    byKind: {
      mass: { count: number; amountCents: number; paidCents: number };
      waiting: { count: number; amountCents: number; paidCents: number };
    };
  };
  cashflowPipeline: {
    escrowCents: number;
    clearingCents: number;
    disbursedCents: number;
    refundedCents: number;
  };
  companies: {
    topSenders: Array<{
      id: string;
      name: string;
      spendCents: number;
      jobsCount: number;
      surchargesCents: number;
    }>;
    topCarriers: Array<{
      id: string;
      name: string;
      tripsCount: number;
      earningsCents: number;
      paidCents: number;
      clearingCents: number;
    }>;
  };
  regionalBreakdown: Array<{
    regionCode: string;
    regionName: string;
    gmvCents: number;
    platformRevenueCents: number;
    stateShareCents: number;
    localShareCents: number;
    jobsCount: number;
  }>;
  timeline: Array<{
    date: string;
    label: string;
    gmvCents: number;
    platformRevenueCents: number;
    carrierPayoutsCents: number;
    partnerCommissionsCents: number;
  }>;
};

export function getSuperFinance(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<SuperFinanceOverview>('/settlements/finance/super', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type CarrierFinanceOverview = {
  companyName: string;
  payoutsEnabled: boolean;
  carrierPercent?: number;
  clearingDays?: number;
  summary: {
    totalEarnedCents: number;
    clearingCents: number;
    paidOutCents: number;
    inProgressCents: number;
    surchargesEarnedCents: number;
    completedTripsCount: number;
    activeTripsCount: number;
  };
  recentTransfers: Array<{
    id: string;
    amountCents: number;
    status: string;
    stripeTransferId: string | null;
    createdAt: string;
  }>;
  tripLedger: Array<{
    tripId: string;
    jobId: string;
    jobTitle: string;
    completedAt: string | null;
    grossFareCents: number;
    carrierNetCents: number;
    surchargesCents: number;
    status: 'PAID' | 'ACCRUED';
  }>;
};

export function getCarrierFinance(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<CarrierFinanceOverview>('/settlements/finance/carrier', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type SenderFinanceOverview = {
  companyName: string;
  summary: {
    totalSpendIncGstCents: number;
    totalSpendExGstCents: number;
    totalGstCents: number;
    surchargesSpendCents: number;
    inEscrowCents: number;
    completedJobsCount: number;
    activeJobsCount: number;
  };
  surchargesBreakdown: {
    massCents: number;
    waitingCents: number;
    pendingCents: number;
  };
  jobSpendHistory: Array<{
    jobId: string;
    jobTitle: string;
    createdAt: string;
    status: string;
    baseFareIncGstCents: number;
    surchargesIncGstCents: number;
    totalPaidCents: number;
    paymentStatus: string;
  }>;
};

export function getSenderFinance(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<SenderFinanceOverview>('/settlements/finance/sender', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export type PartnerFinanceOverview = {
  role: 'STATE_MASTER' | 'LOCAL_BDE';
  adminName: string;
  adminEmail: string;
  scopeLabel: string;
  summary: {
    attributedGmvCents: number;
    grossCommissionCents: number;
    accruedCents: number;
    settledCents: number;
    activeJobsCount: number;
    completedJobsCount: number;
  };
  bookOfBusiness: {
    sendersCount: number;
    carriersCount: number;
    referredSpendCents: number;
  };
  recentSettlements: Array<{
    id: string;
    jobId: string;
    jobTitle: string;
    amountCents: number;
    sharePercent: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
};

export function getPartnerFinance(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<PartnerFinanceOverview>('/settlements/finance/partner', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

async function downloadFinanceCsvBlob(
  path: string,
  query: FinanceQuery | undefined,
  fallbackFilename: string,
  options?: { signal?: AbortSignal },
) {
  const response = await http.get<Blob>(path, {
    params: query,
    signal: options?.signal,
    responseType: 'blob',
  });
  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackFilename;
  anchor.click();
  URL.revokeObjectURL(url);
  return blob;
}

/** Period-filtered Super finance ledger CSV (AUD cents). */
export function exportSuperFinanceCsv(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return downloadFinanceCsvBlob(
    '/settlements/finance/super/export',
    query,
    'clox-finance-super.csv',
    options,
  );
}

/** Period-filtered partner commission ledger CSV. */
export function exportPartnerFinanceCsv(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return downloadFinanceCsvBlob(
    '/settlements/finance/partner/export',
    query,
    'clox-finance-partner.csv',
    options,
  );
}

/** Period-filtered carrier earnings ledger CSV. */
export function exportCarrierFinanceCsv(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return downloadFinanceCsvBlob(
    '/settlements/finance/carrier/export',
    query,
    'clox-finance-carrier.csv',
    options,
  );
}

/** Period-filtered sender spend ledger CSV. */
export function exportSenderFinanceCsv(
  query?: FinanceQuery,
  options?: { signal?: AbortSignal },
) {
  return downloadFinanceCsvBlob(
    '/settlements/finance/sender/export',
    query,
    'clox-finance-sender.csv',
    options,
  );
}

// ─── M12: Fortnightly Settlement Cycles & Reconciliation ────────────────────

export type SettlementCycleStatus = 'OPEN' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SettlementCycleSummary {
  id: string;
  cycleNumber: string;
  periodStart: string;
  periodEnd: string;
  scheduledDisburseAt: string;
  status: SettlementCycleStatus;
  disbursedAt: string | null;
  totalAccruedCents: number;
  totalDisbursedCents: number;
  carrierPayoutCents: number;
  adminPayoutCents: number;
  hqHoldingCents: number;
  lineCount: number;
  notes: string | null;
  createdAt: string;
}

export interface SettlementCycleDetail extends SettlementCycleSummary {
  settlementLines: Array<{
    id: string;
    jobId: string;
    recipientType: string;
    recipientId: string | null;
    grossFareCents: number;
    amountCents: number;
    sharePercent: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
    job: {
      id: string;
      title: string;
      assignment: {
        carrierCompany: {
          id: string;
          legalName: string;
          stripeConnectAccountId: string | null;
        } | null;
      } | null;
    };
    adminUser: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
}

export interface RunDisbursementResult {
  success: boolean;
  dryRun?: boolean;
  cycleId: string;
  cycleNumber: string;
  disbursedAt?: string;
  lineCount: number;
  totalAccruedCents: number;
  totalDisbursedCents?: number;
  carrierPayoutCents: number;
  adminPayoutCents: number;
  hqHoldingCents: number;
  details?: {
    carrierPayoutCents: number;
    adminPayoutCents: number;
    hqHoldingCents: number;
  };
}

export interface DiscrepancyItem {
  id: string;
  kind:
    | 'LEDGER_MISMATCH'
    | 'UNTRANSFERRED_CLEARING'
    | 'ORPHAN_CHARGE'
    | 'SURCHARGE_SPIKE'
    | 'UNMAPPED_DESTINATION';
  severity: 'CRITICAL' | 'WARN' | 'INFO';
  message: string;
  expectedCents?: number;
  actualCents?: number;
  entityId: string;
  entityType: 'Job' | 'PaymentEvent' | 'SettlementLine' | 'Company';
  createdAt: string;
}

export interface ReconciliationReport {
  status: 'HEALTHY' | 'MISMATCH_DETECTED' | 'WARNING';
  generatedAt: string;
  period: { from: string; to: string };
  metrics: {
    totalGmvCents: number;
    totalCollectedCents: number;
    totalDisbursedCents: number;
    totalPendingClearingCents: number;
    totalHqHoldingCents: number;
    matchedTransactionsCount: number;
    discrepancyCount: number;
  };
  discrepancies: DiscrepancyItem[];
}

export function listSettlementCycles(
  query?: { page?: number; limit?: number },
  options?: { signal?: AbortSignal },
) {
  return http
    .get<{
      items: SettlementCycleSummary[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/settlements/cycles', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function getActiveSettlementCycle(options?: { signal?: AbortSignal }) {
  return http
    .get<SettlementCycleSummary>('/settlements/cycles/active', {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function getSettlementCycleDetail(
  id: string,
  options?: { signal?: AbortSignal },
) {
  return http
    .get<SettlementCycleDetail>(`/settlements/cycles/${id}`, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function runSettlementDisbursement(payload?: {
  cycleId?: string;
  dryRun?: boolean;
  notes?: string;
}) {
  return http
    .post<RunDisbursementResult>('/settlements/cycles/run', payload)
    .then((res) => res.data);
}

export function getReconciliationReport(
  query?: { from?: string; to?: string },
  options?: { signal?: AbortSignal },
) {
  return http
    .get<ReconciliationReport>('/settlements/reconcile', {
      params: query,
      signal: options?.signal,
    })
    .then((res) => res.data);
}


