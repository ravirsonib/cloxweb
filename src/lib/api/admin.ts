import type {
  AdminAuditQuery,
  AdminCompanyListQuery,
  AdminLeadExportQuery,
  AdminLeadListQuery,
  CreateLeadNoteInput,
  UpdateLeadInput,
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

export function getDashboardStats(options?: { signal?: AbortSignal }) {
  return http
    .get<DashboardStats>('/admin/dashboard/stats', { signal: options?.signal })
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
  createdAt: string;
  updatedAt: string;
  homeRegion: { code: string; name: string } | null;
  openCase: { id: string; status: string; caseType: string } | null;
  counts: { users: number; vehicles: number; drivers: number };
};

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
  } | null;
  trip: { id: string; status: string; startedAt: string | null; completedAt: string | null } | null;
  proposalCount: number;
  canHardDelete: boolean;
  canSoftDelete: boolean;
};

export type AdminJobDetail = AdminJobListItem & {
  stops: Array<{
    id: string;
    sequence: number;
    stopType: string;
    suburb: string | null;
    state: string | null;
    addressLine: string | null;
    receiverName: string | null;
    receiverEmail: string | null;
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
