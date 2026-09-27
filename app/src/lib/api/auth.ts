import type { AuthTokens, OtpRequestInput, OtpVerifyInput } from '@/shared/types';
import { createHttpClient, toApiError } from '@/lib/http/client';

/** Unauthenticated calls use a bare client (no bearer / refresh loop). */
const publicHttp = createHttpClient();
publicHttp.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

export function requestOtp(payload: OtpRequestInput, options?: { signal?: AbortSignal }) {
  return publicHttp
    .post<{ ok: boolean; message: string; debugCode?: string }>(
      '/auth/otp/request',
      payload,
      {
        signal: options?.signal,
        timeout: 60_000,
      },
    )
    .then((res) => res.data);
}

export function verifyOtp(payload: OtpVerifyInput, options?: { signal?: AbortSignal }) {
  return publicHttp
    .post<AuthTokens>('/auth/otp/verify', payload, {
      signal: options?.signal,
    })
    .then((res) => res.data);
}

export function refreshSession(refreshToken: string, options?: { signal?: AbortSignal }) {
  return publicHttp
    .post<AuthTokens>('/auth/refresh', { refreshToken }, { signal: options?.signal })
    .then((res) => res.data);
}
