import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { RoleThemeProvider } from '@/components/role-theme-provider';
import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { getIdentityMe } from '@/lib/api/auth';
import { i18n, setAppLocale } from '@/lib/i18n';
import { normalizeAppLocale } from '@/locales';
import { useAuthStore } from '@/stores/auth-store';

/** Prefer server-persisted locale over localStorage when authenticated. */
function LocaleSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  useEffect(() => {
    const serverLocale = me.data?.locale;
    if (!serverLocale) return;
    const next = normalizeAppLocale(serverLocale);
    if (normalizeAppLocale(i18n.language) !== next) {
      setAppLocale(next);
    }
  }, [me.data?.locale]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const principalId = useAuthStore((s) => s.principalId);
  const prevPrincipalRef = useRef(principalId);

  useEffect(() => {
    if (prevPrincipalRef.current !== principalId) {
      prevPrincipalRef.current = principalId;
      queryClient.clear();
    }
  }, [principalId, queryClient]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RoleThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                <LocaleSync />
                {children}
              </ConfirmProvider>
            </ToastProvider>
          </RoleThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
