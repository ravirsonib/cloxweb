import { http } from '@/lib/http';
import type {
  AssignDisputeInput,
  CloseLocalDisputeInput,
  CreateDisputeInput,
  DisputeFinancialAdjustment,
  DisputeRuling,
  DisputeStatus,
  DisputeType,
  EscalateDisputeInput,
  ListDisputesQuery,
  ResolveDisputeInput,
  TriageDisputeInput,
} from '@/shared/types';

export interface DisputeSummaryRow {
  id: string;
  disputeNumber: string;
  type: DisputeType;
  status: DisputeStatus;
  jobId: string;
  reason: string;
  disputedAmountCents: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string | null;
    originRegion?: { id: string; code: string; name: string } | null;
    originTerritory?: { id: string; code: string; name: string } | null;
  };
  company: {
    id: string;
    legalName: string;
    type: string;
  };
  surcharge?: {
    id: string;
    kind: string;
    amountIncGstCents: number;
    status: string;
  } | null;
  assignedAdmin?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

export interface DisputeDetail extends DisputeSummaryRow {
  tripId: string | null;
  surchargeId: string | null;
  description: string;
  evidenceUrls: string[];
  contactedSender: boolean;
  contactedCarrier: boolean;
  evidenceComplete: boolean;
  triageNotes: string | null;
  triagedAt: string | null;
  triagedByAdmin?: { id: string; name: string | null; email: string } | null;
  ruling: DisputeRuling | null;
  rulingNotes: string | null;
  resolvedAt: string | null;
  resolvedByAdmin?: { id: string; name: string | null; email: string } | null;
  financialAdjustment: DisputeFinancialAdjustment | null;
  adjustmentAmountCents: number | null;
  openedByUser?: { id: string; name: string | null; email: string; phone: string | null } | null;
  region?: { id: string; code: string; name: string } | null;
  territory?: { id: string; code: string; name: string } | null;
  job: any;
  trip?: any;
}

export interface ListDisputesResponse {
  items: DisputeSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function createDispute(input: CreateDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>('/disputes', input);
  return res.data;
}

export async function listDisputes(
  query: Partial<ListDisputesQuery> = {},
  options?: { signal?: AbortSignal },
): Promise<ListDisputesResponse> {
  const res = await http.get<ListDisputesResponse>('/disputes', {
    params: query,
    signal: options?.signal,
  });
  return res.data;
}

export async function getDispute(
  id: string,
  options?: { signal?: AbortSignal },
): Promise<DisputeDetail> {
  const res = await http.get<DisputeDetail>(`/disputes/${id}`, {
    signal: options?.signal,
  });
  return res.data;
}

export async function triageDispute(id: string, input: TriageDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>(`/disputes/${id}/triage`, input);
  return res.data;
}

export async function escalateDispute(id: string, input: EscalateDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>(`/disputes/${id}/escalate`, input);
  return res.data;
}

export async function assignDispute(id: string, input: AssignDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>(`/disputes/${id}/assign`, input);
  return res.data;
}

export async function resolveDispute(id: string, input: ResolveDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>(`/disputes/${id}/resolve`, input);
  return res.data;
}

export async function closeLocalDispute(id: string, input: CloseLocalDisputeInput): Promise<DisputeDetail> {
  const res = await http.post<DisputeDetail>(`/disputes/${id}/close-local`, input);
  return res.data;
}
