import { createHttpClient } from '@/lib/http/client';
import { AdminRole, AppRole, type AuthTokens } from '@/shared/types';
import { useAuthStore, type PrincipalKind } from '@/stores/auth-store';

/** Marks the next unauthenticated redirect as an intentional sign-out (no `?next=`). */
const LOGOUT_REDIRECT_KEY = 'clox.auth.logoutRedirect';

/** In-memory flag survives React Strict Mode double-render (sessionStorage alone can be consumed twice). */
let intentionalLogoutRedirect = false;

export function markIntentionalLogoutRedirect() {
  intentionalLogoutRedirect = true;
  try {
    sessionStorage.setItem(LOGOUT_REDIRECT_KEY, '1');
  } catch {
    // ignore
  }
}

/** Read-only: ProtectedRoute uses this so sign-out lands on clean `/login`. */
export function isIntentionalLogoutRedirect(): boolean {
  if (intentionalLogoutRedirect) return true;
  try {
    return sessionStorage.getItem(LOGOUT_REDIRECT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Clear after LoginPage mounts so later 401s can still use `?next=`. */
export function clearIntentionalLogoutRedirect() {
  intentionalLogoutRedirect = false;
  try {
    sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
  } catch {
    // ignore
  }
}

const SAFE_NEXT_PATHS = new Set([
  '/documents/upload',
  '/carrier/onboarding',
  '/carrier/fleet',
  '/carrier/drivers',
  '/sender/onboarding',
  '/driver/onboarding',
  '/market',
  '/jobs',
  '/assignments',
  '/trips',
  '/account',
]);

const UUID_SEGMENT =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Exact whitelist entries plus dynamic sender job deep-links from email CTAs. */
function isSafeAppPath(pathname: string): boolean {
  if (SAFE_NEXT_PATHS.has(pathname)) return true;
  const jobDetail = new RegExp(`^/jobs/${UUID_SEGMENT}$`, 'i');
  const jobEdit = new RegExp(`^/jobs/${UUID_SEGMENT}/edit$`, 'i');
  const jobTrack = new RegExp(`^/jobs/${UUID_SEGMENT}/track$`, 'i');
  const carrierException = new RegExp(`^/carrier/exceptions/${UUID_SEGMENT}$`, 'i');
  return (
    jobDetail.test(pathname) ||
    jobEdit.test(pathname) ||
    jobTrack.test(pathname) ||
    carrierException.test(pathname)
  );
}

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

/** Drop local (+ server) session so email deep-links can sign in as the intended role. */
export async function clearBrowserSession() {
  const { accessToken, refreshToken, clearSession } = useAuthStore.getState();
  if (!accessToken && !refreshToken) {
    clearSession();
    return;
  }
  try {
    const bare = createHttpClient();
    await bare.post(
      '/auth/logout',
      { refreshToken: refreshToken ?? undefined, allDevices: false },
      accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
    );
  } catch {
    // still clear local session
  }
  clearSession();
}

/** Whitelist relative app paths used in email / login `next` redirects. */
export function safePostLoginPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let path = raw.trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    }
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const pathname = path.split('?')[0] ?? path;
  if (!isSafeAppPath(pathname)) return null;
  return path;
}

export function defaultHomeForRole(role: AppRole | null | undefined): string {
  if (role === AppRole.SENDER) return '/sender/onboarding';
  if (role === AppRole.TRANSPORT_COMPANY) return '/carrier/onboarding';
  if (role === AppRole.DRIVER) return '/driver/onboarding';
  return '/';
}

export function roleCanAccessPath(role: AppRole | null | undefined, path: string): boolean {
  if (!role) return false;
  const pathname = path.split('?')[0] ?? path;
  if (pathname === '/documents/upload') {
    return (
      role === AppRole.SENDER ||
      role === AppRole.TRANSPORT_COMPANY ||
      role === AppRole.DRIVER
    );
  }
  if (
    pathname === '/carrier/onboarding' ||
    pathname === '/carrier/fleet' ||
    pathname === '/carrier/drivers' ||
    pathname === '/market' ||
    pathname === '/assignments'
  ) {
    return role === AppRole.TRANSPORT_COMPANY;
  }
  if (pathname === '/sender/onboarding') {
    return role === AppRole.SENDER;
  }
  if (
    pathname === '/jobs' ||
    /^\/jobs\/[0-9a-f-]{36}$/i.test(pathname) ||
    /^\/jobs\/[0-9a-f-]{36}\/(edit|track)$/i.test(pathname)
  ) {
    return role === AppRole.SENDER;
  }
  if (
    pathname === '/carrier/exceptions' ||
    /^\/carrier\/exceptions\/[0-9a-f-]{36}$/i.test(pathname)
  ) {
    return role === AppRole.TRANSPORT_COMPANY;
  }
  if (pathname === '/driver/onboarding' || pathname === '/trips') {
    return role === AppRole.DRIVER;
  }
  if (pathname === '/account') return true;
  if (
    role === AdminRole.SUPER_ADMIN ||
    role === AdminRole.STATE_MASTER ||
    role === AdminRole.LOCAL_BDE
  ) {
    return true;
  }
  return false;
}
