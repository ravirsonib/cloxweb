import { useEffect, type ReactNode } from 'react';
import { isCabTheme, roleThemeFromRole } from '@/lib/role-theme';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Mirrors auth role onto <html data-role data-theme> so kit accents / cab
 * tokens apply to body chrome even outside AdminShell.
 */
export function RoleThemeProvider({ children }: { children: ReactNode }) {
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    const root = document.documentElement;
    const theme = roleThemeFromRole(role);
    root.setAttribute('data-role', theme);
    root.setAttribute('data-theme', isCabTheme(theme) ? 'cab' : 'ops');
    return () => {
      root.setAttribute('data-role', 'default');
      root.setAttribute('data-theme', 'ops');
    };
  }, [role]);

  return children;
}
