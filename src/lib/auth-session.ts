import type { AuthTokens, AppRole } from '@/shared/types';
import { useAuthStore, type PrincipalKind } from '@/stores/auth-store';

export function applyAuthTokensToStore(tokens: AuthTokens) {
  const principal = tokens.principal;
  const admin = tokens.admin;
  const kind: PrincipalKind = principal?.kind ?? 'admin';
  const role = (principal?.role ?? admin?.role ?? 'SUPER_ADMIN') as AppRole;
  const email = principal?.email ?? admin?.email ?? '';
  const principalId = principal?.id ?? admin?.id ?? '';
  const displayName = principal?.name ?? admin?.name ?? null;

  useAuthStore.getState().setSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId ?? null,
    email,
    principalId,
    displayName,
    role,
    kind,
  });
}
