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
};

export type PlatformSettings = {
  id: string;
  rescueDiscountPercent: number;
  marketplaceRelistSlaMs: number;
  driverUnavailableScoreDelta: number;
  carrierMarketplaceReleaseScoreDelta: number;
  carrierClearingDays: number;
  updatedAt: string;
};

export type PlatformSettingsPatch = {
  rescueDiscountPercent?: number;
  marketplaceRelistSlaMs?: number;
  driverUnavailableScoreDelta?: number;
  carrierMarketplaceReleaseScoreDelta?: number;
  carrierClearingDays?: number;
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

export type AdminJobDetail = AdminJobListItem & {
  minVehicleClass?: string | null;
  receiverPhone?: string | null;
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
    carrierCompany: { id: string; legalName: string };
  }>;
  paymentEvents: Array<{
    id: string;
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
};

export type RevenueSplitSettings = {
  carrierPercentFixed: number;
  carrierPercent?: number;
  platformPercentFixed: number;
  platformPercent?: number;
  effective: {
    policyVersionId: string | null;
    percents: RevenueSplitPercents;
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
    superPercent: number;
    statePercent: number;
    localPercent: number;
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

export type PartnerPerformanceHint =
  | 'above_median_bob'
  | 'below_median_bob'
  | 'near_default';

export type PartnerPerformanceItem = {
  id: string;
  email: string;
  name: string | null;
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

