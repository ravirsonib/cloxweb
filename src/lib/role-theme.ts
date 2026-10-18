import { AdminRole, AppRole } from '@/shared/types';

/** Role accent slots mapped from CLOX HTML kits. */
export type RoleTheme =
  | 'super'
  | 'state'
  | 'local'
  | 'sender'
  | 'carrier'
  | 'driver'
  | 'default';

export function roleThemeFromRole(role: string | null | undefined): RoleTheme {
  switch (role) {
    case AdminRole.SUPER_ADMIN:
      return 'super';
    case AdminRole.STATE_MASTER:
      return 'state';
    case AdminRole.LOCAL_BDE:
      return 'local';
    case AppRole.SENDER:
      return 'sender';
    case AppRole.TRANSPORT_COMPANY:
      return 'carrier';
    case AppRole.DRIVER:
      return 'driver';
    default:
      return 'default';
  }
}

export function isCabTheme(theme: RoleTheme): boolean {
  return theme === 'driver';
}

/** Short badge label for topbar / scope chip. */
export function roleBadgeLabel(role: string | null | undefined): string {
  switch (role) {
    case AdminRole.SUPER_ADMIN:
      return 'Super · National';
    case AdminRole.STATE_MASTER:
      return 'State scope';
    case AdminRole.LOCAL_BDE:
      return 'Local scope';
    case AppRole.SENDER:
      return 'Sender';
    case AppRole.TRANSPORT_COMPANY:
      return 'Carrier';
    case AppRole.DRIVER:
      return 'Driver · Cab';
    default:
      return role || 'CLOX';
  }
}

export function prefersCabShell(role: string | null | undefined): boolean {
  return role === AppRole.DRIVER;
}
