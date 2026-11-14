import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppRole } from '@/shared/types';

export type PrincipalKind = 'admin' | 'user';

const AUTH_STORAGE_KEY = 'clox-admin-auth';

type AuthSessionFields = {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  email: string | null;
  principalId: string | null;
  displayName: string | null;
  role: AppRole | null;
  kind: PrincipalKind | null;
};

type AuthState = AuthSessionFields & {
  /** False until zustand-persist finishes reading localStorage (avoids false logouts). */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
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
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
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
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sessionId: state.sessionId,
        email: state.email,
        principalId: state.principalId,
        displayName: state.displayName,
        role: state.role,
        kind: state.kind,
      }),
      /**
       * localStorage rehydrate is sync (before `useAuthStore` is assigned).
       * - Do not call useAuthStore in the sync success path (TDZ → stuck loading).
       * - Defer hasHydrated until after first paint so AppBootScreen can actually show
       *   (otherwise tokens are ready before React mounts and the boot UI never paints).
       */
      onRehydrateStorage: () => (state) => {
        const mark = () => {
          if (state) {
            state.setHasHydrated(true);
            return;
          }
          useAuthStore.getState().setHasHydrated(true);
        };
        scheduleAuthBootReady(mark);
      },
    },
  ),
);

/** After first paint so AppBootScreen can mount once (no artificial delay). */
function scheduleAuthBootReady(mark: () => void) {
  if (typeof window === 'undefined') {
    mark();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!useAuthStore.getState().hasHydrated) mark();
    });
  });
}

/** Safety if finish callback missed (HMR / edge storage failures). */
if (typeof window !== 'undefined') {
  useAuthStore.persist.onFinishHydration(() => {
    scheduleAuthBootReady(() => {
      useAuthStore.getState().setHasHydrated(true);
    });
  });
}

/** Latest refresh token from localStorage (another tab may have rotated). */
export function readPersistedAuthSession(): AuthSessionFields | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<AuthSessionFields> };
    const state = parsed.state;
    if (!state) return null;
    return {
      accessToken: state.accessToken ?? null,
      refreshToken: state.refreshToken ?? null,
      sessionId: state.sessionId ?? null,
      email: state.email ?? null,
      principalId: state.principalId ?? null,
      displayName: state.displayName ?? null,
      role: (state.role as AppRole | null) ?? null,
      kind: (state.kind as PrincipalKind | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Keep in-memory session aligned when another tab rotates or clears tokens. */
export function bindAuthStoreCrossTabSync() {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY) return;
    if (event.newValue == null) {
      useAuthStore.getState().clearSession();
      return;
    }
    const persisted = readPersistedAuthSession();
    if (!persisted) return;
    const current = useAuthStore.getState();
    if (
      persisted.accessToken === current.accessToken &&
      persisted.refreshToken === current.refreshToken &&
      persisted.sessionId === current.sessionId
    ) {
      return;
    }
    if (!persisted.accessToken || !persisted.refreshToken || !persisted.role || !persisted.kind) {
      useAuthStore.getState().clearSession();
      return;
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
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
