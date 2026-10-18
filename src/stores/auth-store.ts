import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '@/shared/types';

export type PrincipalKind = 'admin' | 'user';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  email: string | null;
  principalId: string | null;
  displayName: string | null;
  role: AppRole | null;
  kind: PrincipalKind | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    sessionId?: string | null;
    email: string;
    principalId: string;
    displayName?: string | null;
    role: AppRole;
    kind: PrincipalKind;
  }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      email: null,
      principalId: null,
      displayName: null,
      role: null,
      kind: null,
      setSession: ({
        accessToken,
        refreshToken,
        sessionId = null,
        email,
        principalId,
        displayName = null,
        role,
        kind,
      }) =>
        set({
          accessToken,
          refreshToken,
          sessionId,
          email,
          principalId,
          displayName,
          role,
          kind,
        }),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          sessionId: null,
          email: null,
          principalId: null,
          displayName: null,
          role: null,
          kind: null,
        }),
    }),
    { name: 'clox-admin-auth' },
  ),
);
