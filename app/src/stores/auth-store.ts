import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  adminId: string | null;
  adminName: string | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    email: string;
    adminId?: string | null;
    adminName?: string | null;
  }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      email: null,
      adminId: null,
      adminName: null,
      setSession: ({ accessToken, refreshToken, email, adminId = null, adminName = null }) =>
        set({ accessToken, refreshToken, email, adminId, adminName }),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          email: null,
          adminId: null,
          adminName: null,
        }),
    }),
    { name: 'clox-app-auth' },
  ),
);
