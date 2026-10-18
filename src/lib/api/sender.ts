import { http } from '@/lib/http';
import { createHttpClient, toApiError } from '@/lib/http/client';

const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(toApiError(e)),
);

export type SenderOnboarding = {
  step: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
  company: {
    id: string;
    status: string;
    legalName: string;
    tradingName: string | null;
    abn: string | null;
    acn: string | null;
    senderAccountType: 'BUSINESS' | 'INDIVIDUAL' | null;
    invoiceLegalName: string | null;
    invoiceAddressLine1: string | null;
    invoiceSuburb: string | null;
    invoiceState: string | null;
    invoicePostcode: string | null;
    gstRegistered: boolean;
    paymentReady: boolean;
    stripeCustomerId: string | null;
    homeRegionCode: string | null;
  };
  latestCase: {
    id: string;
    status: string;
    caseType: string;
    decisionNote: string | null;
  } | null;
  goNoGo: {
    opsApproved: boolean;
    invoiceComplete: boolean;
    paymentReady: boolean;
    accountActive: boolean;
    canBook: boolean;
  };
  stripeMock: boolean;
};

export function registerSender(payload: {
  email: string;
  name: string;
  phone?: string;
  acceptedTerms: boolean;
}) {
  return publicHttp.post('/sender/register', payload).then((r) => r.data);
}

export function getSenderOnboarding() {
  return http.get<SenderOnboarding>('/sender/onboarding').then((r) => r.data);
}

export function updateSenderProfile(payload: Record<string, unknown>) {
  return http.put<SenderOnboarding>('/sender/profile', payload).then((r) => r.data);
}

export function submitSenderVerification(documentIds: string[]) {
  return http
    .post<SenderOnboarding>('/sender/verification/submit', { documentIds })
    .then((r) => r.data);
}

export function setupSenderPayment() {
  return http
    .post<{
      customerId: string;
      setupIntentId: string;
      clientSecret: string;
      mock: boolean;
      publishableKey: string | null;
    }>('/sender/payment/setup')
    .then((r) => r.data);
}

export function confirmSenderPayment(paymentMethodId?: string) {
  return http
    .post<SenderOnboarding>('/sender/payment/confirm', { paymentMethodId })
    .then((r) => r.data);
}

export function getBookingEligibility() {
  return http
    .get<{
      canBook: boolean;
      goNoGo: SenderOnboarding['goNoGo'];
      companyStatus: string;
    }>('/sender/booking-eligibility')
    .then((r) => r.data);
}
