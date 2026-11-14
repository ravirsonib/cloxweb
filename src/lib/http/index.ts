import type { AuthTokens } from '@/shared/types';
import { applyAuthTokensToStore } from '@/lib/auth-session';
import { readPersistedAuthSession, useAuthStore } from '@/stores/auth-store';
import { LOCALE_STORAGE_KEY } from '@/locales';
import {
  createHttpClient,
  isAxiosError,
  toApiError,
  type AxiosInstance,
} from '@/lib/http/client';
import type { InternalAxiosRequestConfig } from 'axios';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

function waitForAuthHydration(timeoutMs = 2_000): Promise<void> {
  if (useAuthStore.getState().hasHydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (useAuthStore.getState().hasHydrated || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, 20);
  });
}

function isRefreshNetworkFailure(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  if (error.response) return false;
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    /timeout|Network Error/i.test(error.message)
  );
}

function adoptPersistedSessionIfNewer(previousRefresh: string | null): string | null {
  const persisted = readPersistedAuthSession();
  if (
    !persisted?.accessToken ||
    !persisted.refreshToken ||
    !persisted.role ||
    !persisted.kind
  ) {
    return null;
  }
  if (previousRefresh && persisted.refreshToken === previousRefresh) {
    return null;
  }
  useAuthStore.getState().setSession({
    accessToken: persisted.accessToken,
    refreshToken: persisted.refreshToken,
    sessionId: persisted.sessionId,
    email: persisted.email ?? '',
    principalId: persisted.principalId ?? '',
    displayName: persisted.displayName,
    role: persisted.role,
    kind: persisted.kind,
  });
  return persisted.accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  await waitForAuthHydration();

  const { refreshToken, clearSession } = useAuthStore.getState();
  const tokenFromStore = refreshToken;
  const tokenFromStorage = readPersistedAuthSession()?.refreshToken ?? null;
  const refreshTokenToUse = tokenFromStore || tokenFromStorage;

  if (!refreshTokenToUse) {
    // Only clear after hydration — otherwise we wipe tokens mid-rehydrate.
    if (useAuthStore.getState().hasHydrated) {
      clearSession();
    }
    return null;
  }

  try {
    const bare = createHttpClient();
    const { data } = await bare.post<AuthTokens>('/auth/refresh', {
      refreshToken: refreshTokenToUse,
    });
    applyAuthTokensToStore(data);
    return data.accessToken;
  } catch (error) {
    // Transient network / timeout must not force logout (common on mobile).
    if (isRefreshNetworkFailure(error)) {
      return null;
    }

    // Another tab may have rotated successfully — adopt its tokens instead of
    // treating reuse-detection 401 as a hard logout for this tab.
    const adopted = adoptPersistedSessionIfNewer(refreshTokenToUse);
    if (adopted) {
      return adopted;
    }

    if (useAuthStore.getState().hasHydrated) {
      clearSession();
    }
    return null;
  }
}

function queueRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const http: AxiosInstance = createHttpClient();

http.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  const locale =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LOCALE_STORAGE_KEY)) ||
    import.meta.env.VITE_DEFAULT_LOCALE ||
    'en';

  config.headers.set('Accept-Language', locale);
  config.headers.set('X-Client-App', 'clox-admin');
  config.headers.set('X-Request-Id', crypto.randomUUID());

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Let browser set multipart boundary when FormData is used
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }

  return config;
});

function problemCode(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'code' in data) {
    const code = (data as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function problemReason(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'reason' in data) {
    const reason = (data as { reason?: unknown }).reason;
    return typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
  }
  return undefined;
}

function forceLogoutSuspended(apiError: ReturnType<typeof toApiError>) {
  const code = problemCode(apiError.data);
  if (
    apiError.status !== 403 ||
    (code !== 'ACCOUNT_SUSPENDED' && code !== 'ACCOUNT_DISABLED')
  ) {
    return false;
  }

  const { clearSession } = useAuthStore.getState();
  clearSession();

  if (typeof window === 'undefined') return true;
  const path = window.location.pathname;
  if (path === '/login' || path.startsWith('/login/')) return true;

  const params = new URLSearchParams();
  params.set('accountStatus', code === 'ACCOUNT_DISABLED' ? 'disabled' : 'suspended');
  const reason = problemReason(apiError.data) || apiError.detail;
  if (reason) params.set('reason', reason.slice(0, 500));
  window.location.assign(`/login?${params.toString()}`);
  return true;
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const apiError = toApiError(error);
    const original = error.config as RetryConfig | undefined;

    if (forceLogoutSuspended(apiError)) {
      return Promise.reject(apiError);
    }

    if (
      apiError.status === 401 &&
      original &&
      !original._retry &&
      !String(original.url ?? '').includes('/auth/otp') &&
      !String(original.url ?? '').includes('/auth/refresh')
    ) {
      original._retry = true;
      const nextToken = await queueRefresh();
      if (nextToken) {
        original.headers.set('Authorization', `Bearer ${nextToken}`);
        return http.request(original);
      }
    }

    return Promise.reject(apiError);
  },
);
