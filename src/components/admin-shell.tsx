import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button, RoleBadge } from '@/components/ui';
import { logout } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isCabTheme, prefersCabShell, roleThemeFromRole } from '@/lib/role-theme';
import { AdminRole, AppRole, isAdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 border-l-[3px] border-transparent px-5 py-2.5 text-[13.5px] transition',
    isActive
      ? 'border-clox-accent font-medium text-white [background:color-mix(in_srgb,var(--clox-accent)_28%,transparent)]'
      : 'text-[#b9c4da] hover:bg-white/5 hover:text-white',
  );

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const isSuper = role === AdminRole.SUPER_ADMIN;
  const isOpsAdmin =
    role === AdminRole.SUPER_ADMIN ||
    role === AdminRole.STATE_MASTER ||
    role === AdminRole.LOCAL_BDE;
  const isMarketplace =
    role === AppRole.SENDER ||
    role === AppRole.TRANSPORT_COMPANY ||
    role === AppRole.DRIVER;

  return (
    <nav className="flex flex-col" aria-label={t('nav.main')}>
      <NavLink to="/" end className={navItemClass} onClick={onNavigate}>
        {t('nav.home')}
      </NavLink>
      {role === AppRole.SENDER ? (
        <NavLink to="/sender/onboarding" className={navItemClass} onClick={onNavigate}>
          {t('nav.senderOnboarding')}
        </NavLink>
      ) : null}
      {role === AppRole.SENDER ? (
        <NavLink to="/jobs" className={navItemClass} onClick={onNavigate}>
          {t('nav.jobs')}
        </NavLink>
      ) : null}
      {role === AppRole.SENDER || isSuper ? (
        <NavLink to="/surcharges" className={navItemClass} onClick={onNavigate}>
          {t('nav.surcharges')}
        </NavLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <NavLink to="/carrier/onboarding" className={navItemClass} onClick={onNavigate}>
          {t('nav.carrierOnboarding')}
        </NavLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <NavLink to="/market" className={navItemClass} onClick={onNavigate}>
          {t('nav.jobBoard')}
        </NavLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <NavLink to="/assignments" className={navItemClass} onClick={onNavigate}>
          {t('nav.assignments')}
        </NavLink>
      ) : null}
      {role === AppRole.DRIVER ? (
        <NavLink to="/driver/onboarding" className={navItemClass} onClick={onNavigate}>
          {t('nav.driverOnboarding')}
        </NavLink>
      ) : null}
      {role === AppRole.DRIVER ? (
        <NavLink to="/trips" className={navItemClass} onClick={onNavigate}>
          {t('nav.myTrips')}
        </NavLink>
      ) : null}
      {isSuper ? (
        <>
          <NavLink to="/leads" className={navItemClass} onClick={onNavigate}>
            {t('nav.leads')}
          </NavLink>
          <NavLink to="/audit" className={navItemClass} onClick={onNavigate}>
            {t('nav.audit')}
          </NavLink>
        </>
      ) : null}
      {isOpsAdmin ? (
        <NavLink to="/compliance" className={navItemClass} onClick={onNavigate}>
          {t('nav.compliance')}
        </NavLink>
      ) : null}
      {isMarketplace ? (
        <NavLink to="/qa/upload" className={navItemClass} onClick={onNavigate}>
          {t('nav.qaUpload')}
        </NavLink>
      ) : null}
      <NavLink to="/account" className={navItemClass} onClick={onNavigate}>
        {t('nav.account')}
      </NavLink>
    </nav>
  );
}

function CabTab({
  to,
  end,
  label,
  icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn('cab-tab', isActive && 'is-active')}
    >
      <span className="text-base leading-none" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

function DriverCabShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clearSession);
  const theme = roleThemeFromRole(role);
  const title = displayName || email || t('userFallback');

  async function signOut() {
    try {
      await logout({ allDevices: false });
    } catch {
      // still clear local session
    }
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="cab-shell flex min-h-dvh flex-col" data-role={theme} data-theme="cab">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-clox-border bg-clox-surface px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo variant="light" markOnly className="h-7 w-7 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-clox-ink">CLOX Cab</p>
            <p className="truncate font-mono text-[10px] text-clox-mute">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <RoleBadge role={role} className="hidden sm:inline-flex" />
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            {t('signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {children ?? <Outlet />}
      </main>

      <nav
        className="cab-tabbar fixed inset-x-0 bottom-0 z-40 flex"
        aria-label={t('nav.main')}
      >
        <CabTab to="/" end label={t('nav.home')} icon="⌂" />
        <CabTab to="/trips" label={t('nav.myTrips')} icon="▶" />
        <CabTab to="/driver/onboarding" label={t('nav.driverOnboarding')} icon="✓" />
        <CabTab to="/account" label={t('nav.account')} icon="◉" />
      </nav>
    </div>
  );
}

function OpsShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const role = useAuthStore((state) => state.role);
  const kind = useAuthStore((state) => state.kind);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = roleThemeFromRole(role);

  async function signOut() {
    try {
      await logout({ allDevices: false });
    } catch {
      // still clear local session
    }
    clearSession();
    navigate('/login', { replace: true });
  }

  const title = displayName || email || t('userFallback');
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className="min-h-screen bg-clox-bg text-clox-text"
      data-role={theme}
      data-theme="ops"
    >
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[rgba(16,25,43,0.55)] lg:hidden"
          aria-label={t('nav.closeMenu')}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[222px] flex-col bg-clox-navy-ink text-[#c9d3e4] transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-4">
          <BrandLogo
            variant="light"
            markOnly
            className="h-[26px] w-[26px] rounded-[7px] object-contain"
          />
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-wide text-white">CLOX</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[#5a6c8c]">
              {t('nav.platformPwa')}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="px-5 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5a6c8c]">
            {t('nav.navigate')}
          </p>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-clox-accent font-display text-xs font-semibold text-white">
              {initials || 'C'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-white">{title}</p>
              <p className="truncate font-mono text-[10.5px] text-[#8fa0bc]">
                {kind}/{role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[222px]">
        <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between gap-3 border-b border-clox-border bg-clox-surface px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-clox-surface-alt text-clox-mute lg:hidden"
              aria-label={t('nav.openMenu')}
              onClick={() => setMobileOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate font-mono text-[12.5px] text-clox-faint">
                <b className="font-semibold text-clox-navy">{t('nav.platformTitle')}</b>
              </p>
              <p className="truncate text-xs text-clox-mute">
                {isAdminRole(role ?? '')
                  ? t('nav.opsLiveApi')
                  : t('nav.marketplaceLiveApi')}
              </p>
            </div>
            <RoleBadge role={role} className="hidden sm:inline-flex" />
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              {t('signOut')}
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children?: ReactNode }) {
  const role = useAuthStore((state) => state.role);
  const theme = roleThemeFromRole(role);

  if (prefersCabShell(role) || isCabTheme(theme)) {
    return <DriverCabShell>{children}</DriverCabShell>;
  }

  return <OpsShell>{children}</OpsShell>;
}

/** @deprecated Prefer `<Field>` / `clox-field-control` */
export const fieldClassName = 'clox-field-control';

/** @deprecated Prefer `<Button variant="primary|cta">` */
export const primaryButtonClassName = 'clox-btn clox-btn-cta';

/** @deprecated Prefer `<Button variant="secondary">` */
export const secondaryButtonClassName = 'clox-btn clox-btn-secondary';
