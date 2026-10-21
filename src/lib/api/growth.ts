import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type GrowthCompany = {
  id: string;
  type: 'SENDER' | 'CARRIER';
  status: string;
  legalName: string;
  tradingName: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  referredAt: string | null;
  createdAt: string;
  homeRegion: { code: string; name: string } | null;
};

export type GrowthProspect = {
  id: string;
  companyType: 'SENDER' | 'CARRIER';
  legalName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  notes: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  ownerAdminUser?: { id: string; name: string | null; email: string };
  company?: { id: string; status: string; legalName: string } | null;
};

export type CompanyInviteRow = {
  id: string;
  companyType: 'SENDER' | 'CARRIER';
  email: string;
  legalNameHint: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  companyId: string | null;
  prospectId: string | null;
  createdAt: string;
};

export type LocalBdeOption = {
  id: string;
  name: string | null;
  email: string;
  territoryCode: string | null;
  regionCode: string | null;
};

export function createCompanyInvite(payload: {
  companyType: 'SENDER' | 'CARRIER';
  email: string;
  legalNameHint?: string;
  prospectId?: string;
}) {
  return http.post('/ops/growth/invites', payload).then((r) => r.data as {
    id: string;
    inviteUrl: string;
    expiresAt: string;
    mailSkipped: boolean;
    debugToken?: string;
  });
}

export function resendCompanyInvite(id: string) {
  return http.post(`/ops/growth/invites/${id}/resend`).then((r) => r.data);
}

export function listCompanyInvites() {
  return http.get<{ items: CompanyInviteRow[] }>('/ops/growth/invites').then((r) => r.data);
}

export function listMyGrowthCompanies(params?: {
  type?: 'SENDER' | 'CARRIER';
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  return http
    .get<{
      items: GrowthCompany[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>('/ops/growth/my-companies', { params })
    .then((r) => r.data);
}

export function listProspects(params?: {
  stage?: string;
  companyType?: 'SENDER' | 'CARRIER';
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  return http
    .get<{
      items: GrowthProspect[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>('/ops/growth/prospects', { params })
    .then((r) => r.data);
}

export function createProspect(payload: {
  companyType: 'SENDER' | 'CARRIER';
  legalName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  stage?: string;
}) {
  return http.post<GrowthProspect>('/ops/growth/prospects', payload).then((r) => r.data);
}

export function updateProspect(
  id: string,
  payload: {
    legalName?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    stage?: string;
  },
) {
  return http.patch<GrowthProspect>(`/ops/growth/prospects/${id}`, payload).then((r) => r.data);
}

export function getProspect(id: string) {
  return http.get<GrowthProspect>(`/ops/growth/prospects/${id}`).then((r) => r.data);
}

export function peekCompanyInvite(token: string) {
  return publicHttp
    .get<{
      companyType: string;
      email: string;
      legalNameHint: string | null;
      expiresAt: string;
      inviterName: string | null;
    }>(`/public/company-invite/${encodeURIComponent(token)}`)
    .then((r) => r.data);
}

export function getCompanyReferrer(companyId: string) {
  return http
    .get<{
      id: string;
      legalName: string;
      referredByAdminUserId: string | null;
      referredAt: string | null;
      referredByAdminUser: {
        id: string;
        name: string | null;
        email: string;
        status: string;
      } | null;
    }>(`/ops/growth/companies/${companyId}/referrer`)
    .then((r) => r.data);
}

export function reassignCompanyReferrer(
  companyId: string,
  adminUserId: string | null,
) {
  return http
    .post(`/ops/growth/companies/${companyId}/reassign-referrer`, { adminUserId })
    .then((r) => r.data);
}

export function listLocalBdesForReassign() {
  return http
    .get<{ items: LocalBdeOption[] }>('/ops/growth/local-bdes')
    .then((r) => r.data);
}
