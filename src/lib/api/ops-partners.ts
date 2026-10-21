import { createHttpClient, toApiError } from '@/lib/http/client';
import { http } from '@/lib/http';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type AdminPartnerInvitePeek = {
  email: string;
  name: string | null;
  role: string;
  status: string;
  regionCode: string | null;
  territoryCode: string | null;
  companyName: string | null;
  expired: boolean;
  consumed: boolean;
  canAccept: boolean;
};

export type PartnerOnboarding = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  active: boolean;
  companyId: string | null;
  leadId: string | null;
  requiredDocs: string[];
  declarations: { accuracy: boolean; nda: boolean; nonCompete: boolean };
  profile: {
    corporateAddress: string | null;
    networkExperience: string | null;
    executionStrategy: string | null;
  };
  company: {
    id: string;
    legalName: string;
    abn: string | null;
    acn: string | null;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  scopes: Array<{
    scopeType: string;
    regionCode: string | null;
    territoryCode: string | null;
  }>;
  documents: Array<{
    id: string;
    docType: string;
    status: string;
    originalFilename: string | null;
    createdAt: string;
    expiresAt: string | null;
  }>;
  openCase: {
    id: string;
    status: string;
    decisionNote: string | null;
    infoRequestedAt: string | null;
  } | null;
};

export type InviteAdminInput = {
  email: string;
  name?: string;
  phone?: string;
  role: 'STATE_MASTER' | 'LOCAL_BDE';
  regionCode: string;
  territoryCode?: string;
  leadId?: string;
  companyName?: string;
};

export type PartnerAdminListItem = Omit<
  PartnerOnboarding,
  'documents' | 'openCase' | 'requiredDocs'
> & {
  requiredDocs?: string[];
  openCase?: {
    id: string;
    status: string;
    caseType: string;
  } | null;
};

export function peekAdminInvite(token: string) {
  return publicHttp
    .get<AdminPartnerInvitePeek>(`/ops/admins/invite/${encodeURIComponent(token)}`)
    .then((r) => r.data);
}

export function acceptAdminInvite(token: string) {
  return publicHttp
    .post<{ email: string; role: string; status: string; next: string }>(
      '/ops/admins/invite/accept',
      { token },
    )
    .then((r) => r.data);
}

export function inviteAdminPartner(payload: InviteAdminInput) {
  return http.post('/ops/admins/invite', payload).then((r) => r.data);
}

export function resendAdminPartnerInvite(email: string) {
  return http.post('/ops/admins/invite/resend', { email }).then((r) => r.data);
}

export function listAdminPartners() {
  return http
    .get<{ items: PartnerAdminListItem[] }>('/ops/admins/partners')
    .then((r) => r.data);
}

export type GeographyTerritory = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
};

export type GeographyRegion = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  territories: GeographyTerritory[];
};

export function listOpsGeography() {
  return http
    .get<{ regions: GeographyRegion[] }>('/ops/geography')
    .then((r) => r.data);
}

export function getPartnerOnboarding() {
  return http.get<PartnerOnboarding>('/ops/partner/onboarding').then((r) => r.data);
}

export function updatePartnerOnboarding(payload: {
  name?: string;
  phone?: string;
  companyName?: string;
  abn?: string;
  acn?: string;
  corporateAddress?: string;
  networkExperience?: string;
  executionStrategy?: string;
}) {
  return http.patch<PartnerOnboarding>('/ops/partner/onboarding', payload).then((r) => r.data);
}

export function submitPartnerOnboarding(payload: {
  documentIds: string[];
  declarationAccuracy: true;
  declarationNda: true;
  declarationNonCompete: true;
}) {
  return http
    .post<{ caseId: string; status: string; admin: PartnerOnboarding }>(
      '/ops/partner/onboarding/submit',
      payload,
    )
    .then((r) => r.data);
}
