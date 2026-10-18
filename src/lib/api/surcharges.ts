import { http } from '@/lib/http';

export type SurchargeRow = {
  id: string;
  jobId: string;
  tripId: string;
  kind: 'WAITING' | 'MASS';
  status: 'PENDING_PAYMENT' | 'PAID' | 'WAIVED';
  amountIncGstCents: number;
  paidAt?: string | null;
  waivedAt?: string | null;
  job?: { id: string; title: string | null; status: string };
  payment?: { id: string; status: string; stripePaymentIntentId: string | null } | null;
  readOnly?: boolean;
};

export function listSenderSurcharges() {
  return http.get<SurchargeRow[]>('/payments/surcharges').then((r) => r.data);
}

export function paySurcharge(id: string) {
  return http.post(`/payments/surcharges/${id}/pay`).then((r) => r.data);
}

export function waiveSurcharge(id: string) {
  return http.post(`/payments/surcharges/${id}/waive`).then((r) => r.data);
}

export function listCarrierExceptions() {
  return http.get<SurchargeRow[]>('/payments/exceptions').then((r) => r.data);
}
