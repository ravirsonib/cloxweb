import { http } from '@/lib/http';

export type ComplianceCaseListItem = {
  id: string;
  caseType: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    legalName: string;
    type: string;
    abn: string | null;
    status: string;
  };
  region: { code: string; name: string } | null;
  documents: Array<{
    id: string;
    docType: string;
    status: string;
    expiresAt: string | null;
    originalFilename: string | null;
  }>;
};

export type ComplianceCaseDetail = ComplianceCaseListItem & {
  decisionNote: string | null;
  abrAssist?: {
    configured: boolean;
    abn: string;
    active: boolean | null;
    entityName: string | null;
    abnStatus: string | null;
    message: string;
  } | null;
};

export function listComplianceCases(params?: {
  status?: string;
  caseType?: string;
  regionCode?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}) {
  return http
    .get<{
      success: boolean;
      data: ComplianceCaseListItem[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>('/ops/compliance/cases', {
      params: {
        status: params?.status,
        caseType: params?.caseType,
        regionCode: params?.regionCode,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
      signal: params?.signal,
    })
    .then((r) => r.data);
}

export function getComplianceCase(id: string, options?: { signal?: AbortSignal }) {
  return http
    .get<ComplianceCaseDetail>(`/ops/compliance/cases/${id}`, { signal: options?.signal })
    .then((r) => r.data);
}

export function decideCompliance(
  id: string,
  action: 'approve' | 'reject' | 'request-info' | 'escalate',
  note?: string,
) {
  return http
    .post(`/ops/compliance/cases/${id}/${action}`, { note })
    .then((r) => r.data);
}

export function createUploadIntent(payload: {
  companyId: string;
  docType: string;
  originalFilename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  expiresAt?: string;
  vehicleId?: string;
  driverId?: string;
}) {
  return http.post<{
    id: string;
    uploadUrl: string;
    uploadField: string;
    status: string;
  }>('/documents/upload-intent', payload).then((r) => r.data);
}

export function uploadDocumentContent(documentId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return http
    .put<{ id: string; status: string; contentHash: string; sizeBytes: number }>(
      `/documents/${documentId}/content`,
      form,
    )
    .then((r) => r.data);
}

export function confirmDocument(documentId: string, contentHash: string) {
  return http
    .post<{ id: string; status: string }>(`/documents/${documentId}/confirm`, { contentHash })
    .then((r) => r.data);
}

export function submitCompliance(payload: {
  companyId: string;
  caseType: 'SENDER_KYB' | 'SENDER_KYC' | 'CARRIER_KYB';
  documentIds: string[];
}) {
  return http
    .post<{ id: string; status: string; caseType: string; companyStatus: string }>(
      '/compliance/submit',
      payload,
    )
    .then((r) => r.data);
}
