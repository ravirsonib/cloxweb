import { http } from '@/lib/http';

export type CompanyProfileResponse = {
  company: {
    id: string;
    type: 'SENDER' | 'CARRIER';
    status: string;
    legalName: string;
    tradingName: string | null;
    abn: string | null;
    acn: string | null;
    email: string | null;
    phone: string | null;
    homeRegionCode: string | null;
    serviceRegionCodes: string[];
    capabilities: string[];
    senderAccountType: string | null;
    invoiceLegalName: string | null;
    invoiceAddressLine1: string | null;
    invoiceSuburb: string | null;
    invoiceState: string | null;
    invoicePostcode: string | null;
    gstRegistered: boolean;
  };
  fieldTiers: {
    selfServe: string[];
    opsGated: string[];
  };
  pendingChange: {
    id: string;
    status: string;
    proposedChanges: Record<string, unknown> | null;
    note: string | null;
    createdAt: string;
  } | null;
};

export function getCarrierCompanyProfile() {
  return http.get<CompanyProfileResponse>('/carrier/company-profile').then((r) => r.data);
}

export function updateCarrierCompanyProfileSelf(payload: {
  tradingName?: string | null;
  phone?: string | null;
  serviceRegionCodes?: string[];
}) {
  return http
    .patch<CompanyProfileResponse>('/carrier/company-profile', payload)
    .then((r) => r.data);
}

export function requestCarrierCompanyProfileChange(payload: Record<string, unknown>) {
  return http
    .post<CompanyProfileResponse>('/carrier/company-profile/change-request', payload)
    .then((r) => r.data);
}

export function getSenderCompanyProfile() {
  return http.get<CompanyProfileResponse>('/sender/company-profile').then((r) => r.data);
}

export function updateSenderCompanyProfileSelf(payload: {
  tradingName?: string | null;
  phone?: string | null;
}) {
  return http
    .patch<CompanyProfileResponse>('/sender/company-profile', payload)
    .then((r) => r.data);
}

export function requestSenderCompanyProfileChange(payload: Record<string, unknown>) {
  return http
    .post<CompanyProfileResponse>('/sender/company-profile/change-request', payload)
    .then((r) => r.data);
}
