import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { RoleThemeProvider } from '@/components/role-theme-provider';
import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { i18n } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth-store';

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
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </RoleThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
