import type { InternalAxiosRequestConfig } from 'axios';
import {
  createHttpClient,
  toApiError,
  type AxiosInstance,
} from '@/lib/http/client';
import { useAuthStore } from '@/stores/auth-store';
import { LOCALE_STORAGE_KEY } from '@/locales';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clearSession, email } = useAuthStore.getState();
  if (!refreshToken) {
    clearSession();
    return null;
  }

  try {
    // Bare client — no auth interceptor loop.
    const bare = createHttpClient();
    const { data } = await bare.post<{
      accessToken: string;
      refreshToken: string;
      admin: { email: string; name: string | null; id: string };
    }>('/auth/refresh', { refreshToken });

    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      email: data.admin.email || email || '',
      adminId: data.admin.id,
      adminName: data.admin.name,
    });
    return data.accessToken;
  } catch {
    clearSession();
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
  config.headers.set('X-Client-App', 'clox-app');
  config.headers.set('X-Request-Id', crypto.randomUUID());

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const apiError = toApiError(error);
    const original = error.config as RetryConfig | undefined;

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
