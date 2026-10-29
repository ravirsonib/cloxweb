import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notification-bell';
import { Button, RoleBadge, useConfirm } from '@/components/ui';
import { getIdentityMe, logout } from '@/lib/api';
import { markIntentionalLogoutRedirect } from '@/lib/auth-session';
import { cn } from '@/lib/cn';
import { DRIVER_DOCS_ICON, navIconForPath } from '@/lib/nav-icons';
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

function SidebarLink({
  to,
  end,
  icon: Icon,
  children,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <NavLink to={to} end={end} className={navItemClass} onClick={onNavigate}>
      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden strokeWidth={1.85} />
      <span className="min-w-0 truncate">{children}</span>
    </NavLink>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const isSuper = role === AdminRole.SUPER_ADMIN;
  const isPartnerRole = role === AdminRole.STATE_MASTER || role === AdminRole.LOCAL_BDE;
  const isOpsAdmin =
    role === AdminRole.SUPER_ADMIN ||
    role === AdminRole.STATE_MASTER ||
    role === AdminRole.LOCAL_BDE;
  const isMarketplace =
    role === AppRole.SENDER ||
    role === AppRole.TRANSPORT_COMPANY ||
    role === AppRole.DRIVER;

  // Partner onboarding is only for pre-approval KYB. ACTIVE partners are redirected
  // home from that route — hide the dead nav item once opsEligible.
  const identityQuery = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
    enabled: isPartnerRole,
    staleTime: 30_000,
  });
  const showPartnerOnboarding =
    isPartnerRole &&
    identityQuery.data?.kind === 'admin' &&
    identityQuery.data.opsEligible === false;

  return (
    <nav className="flex flex-col" aria-label={t('nav.main')}>
      <SidebarLink to="/" end icon={navIconForPath('/')} onNavigate={onNavigate}>
        {t('nav.home')}
      </SidebarLink>

      {/* Sender */}
      {role === AppRole.SENDER ? (
        <SidebarLink
          to="/sender/onboarding"
          icon={navIconForPath('/sender/onboarding')}
          onNavigate={onNavigate}
        >
          {t('nav.senderOnboarding')}
        </SidebarLink>
      ) : null}
      {role === AppRole.SENDER ? (
        <SidebarLink to="/jobs" icon={navIconForPath('/jobs')} onNavigate={onNavigate}>
          {t('nav.jobs')}
        </SidebarLink>
      ) : null}
      {role === AppRole.SENDER || isSuper ? (
        <SidebarLink to="/surcharges" icon={navIconForPath('/surcharges')} onNavigate={onNavigate}>
          {t('nav.surcharges')}
        </SidebarLink>
      ) : null}
      {isSuper ? (
        <SidebarLink
          to="/platform-settings"
          icon={navIconForPath('/platform-settings')}
          onNavigate={onNavigate}
        >
          {t('nav.platformSettings')}
        </SidebarLink>
      ) : null}
      {isSuper ? (
        <SidebarLink
          to="/revenue-split"
          icon={navIconForPath('/revenue-split')}
          onNavigate={onNavigate}
        >
          {t('nav.revenueSplit')}
        </SidebarLink>
      ) : null}
      {isSuper ? (
        <SidebarLink
          to="/partner-performance"
          icon={navIconForPath('/partner-performance')}
          onNavigate={onNavigate}
        >
          {t('nav.partnerPerformance')}
        </SidebarLink>
      ) : null}

      {/* Carrier */}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink
          to="/carrier/onboarding"
          icon={navIconForPath('/carrier/onboarding')}
          onNavigate={onNavigate}
        >
          {t('nav.carrierOnboarding')}
        </SidebarLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink
          to="/carrier/fleet"
          icon={navIconForPath('/carrier/fleet')}
          onNavigate={onNavigate}
        >
          {t('nav.fleet')}
        </SidebarLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink
          to="/carrier/drivers"
          icon={navIconForPath('/carrier/drivers')}
          onNavigate={onNavigate}
        >
          {t('nav.drivers')}
        </SidebarLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink to="/market" icon={navIconForPath('/market')} onNavigate={onNavigate}>
          {t('nav.jobBoard')}
        </SidebarLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink
          to="/assignments"
          icon={navIconForPath('/assignments')}
          onNavigate={onNavigate}
        >
          {t('nav.assignments')}
        </SidebarLink>
      ) : null}
      {role === AppRole.TRANSPORT_COMPANY ? (
        <SidebarLink
          to="/carrier/exceptions"
          icon={navIconForPath('/carrier/exceptions')}
          onNavigate={onNavigate}
        >
          {t('nav.exceptions')}
        </SidebarLink>
      ) : null}

      {/* Driver (ops shell — cab uses bottom navbar) */}
      {role === AppRole.DRIVER ? (
        <SidebarLink
          to="/driver/onboarding"
          icon={navIconForPath('/driver/onboarding')}
          onNavigate={onNavigate}
        >
          {t('nav.driverOnboarding')}
        </SidebarLink>
      ) : null}
      {role === AppRole.DRIVER ? (
        <SidebarLink to="/trips" icon={navIconForPath('/trips')} onNavigate={onNavigate}>
          {t('nav.myTrips')}
        </SidebarLink>
      ) : null}

      {/* Super admin */}
      {isSuper ? (
        <>
          <SidebarLink to="/leads" icon={navIconForPath('/leads')} onNavigate={onNavigate}>
            {t('nav.leads')}
          </SidebarLink>
          <SidebarLink
            to="/ops/partners"
            icon={navIconForPath('/ops/partners')}
            onNavigate={onNavigate}
          >
            {t('nav.opsPartners')}
          </SidebarLink>
          <SidebarLink to="/companies" icon={navIconForPath('/companies')} onNavigate={onNavigate}>
            {t('nav.companies')}
          </SidebarLink>
          <SidebarLink to="/admin-jobs" icon={navIconForPath('/admin-jobs')} onNavigate={onNavigate}>
            {t('nav.adminJobs')}
          </SidebarLink>
          <SidebarLink to="/audit" icon={navIconForPath('/audit')} onNavigate={onNavigate}>
            {t('nav.audit')}
          </SidebarLink>
        </>
      ) : null}

      {/* Partners / ops */}
      {showPartnerOnboarding ? (
        <SidebarLink
          to="/partner/onboarding"
          icon={navIconForPath('/partner/onboarding')}
          onNavigate={onNavigate}
        >
          {t('nav.partnerOnboarding')}
        </SidebarLink>
      ) : null}
      {role === AdminRole.LOCAL_BDE ||
      role === AdminRole.STATE_MASTER ||
      role === AdminRole.SUPER_ADMIN ? (
        <SidebarLink to="/ops/growth" icon={navIconForPath('/ops/growth')} onNavigate={onNavigate}>
          {t('nav.growth')}
        </SidebarLink>
      ) : null}
      {role === AdminRole.LOCAL_BDE ? (
        <>
          <SidebarLink
            to="/ops/my-senders"
            icon={navIconForPath('/ops/my-senders')}
            onNavigate={onNavigate}
          >
            {t('nav.mySenders')}
          </SidebarLink>
          <SidebarLink
            to="/ops/my-carriers"
            icon={navIconForPath('/ops/my-carriers')}
            onNavigate={onNavigate}
          >
            {t('nav.myCarriers')}
          </SidebarLink>
        </>
      ) : null}
      {isOpsAdmin ? (
        <SidebarLink
          to="/compliance"
          icon={navIconForPath('/compliance')}
          onNavigate={onNavigate}
        >
          {t('nav.compliance')}
        </SidebarLink>
      ) : null}
      {role === AdminRole.SUPER_ADMIN || role === AdminRole.STATE_MASTER ? (
        <SidebarLink
          to="/ops/exceptions"
          icon={navIconForPath('/ops/exceptions')}
          onNavigate={onNavigate}
        >
          {t('nav.opsExceptions')}
        </SidebarLink>
      ) : null}

      {isMarketplace ? (
        <SidebarLink
          to="/documents/upload"
          icon={role === AppRole.DRIVER ? DRIVER_DOCS_ICON : navIconForPath('/documents/upload')}
          onNavigate={onNavigate}
        >
          {role === AppRole.DRIVER ? t('nav.driverDocs') : t('nav.documentsUpload')}
        </SidebarLink>
      ) : null}
      <SidebarLink to="/account" icon={navIconForPath('/account')} onNavigate={onNavigate}>
        {t('nav.account')}
      </SidebarLink>
    </nav>
  );
}

function CabTab({
  to,
  end,
  label,
  icon: Icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn('cab-tab', isActive && 'is-active')}
    >
      <span className="cab-tab-icon" aria-hidden>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      <span className="cab-tab-label">{label}</span>
    </NavLink>
  );
}

function DriverCabShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const confirm = useConfirm();
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const role = useAuthStore((state) => state.role);
  const clearSession = useAuthStore((state) => state.clearSession);
  const theme = roleThemeFromRole(role);
  const title = displayName || email || t('userFallback');

  async function signOut() {
    const ok = await confirm({
      title: t('confirm.signOutTitle'),
      description: t('confirm.signOutBody'),
      confirmLabel: t('signOut'),
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await logout({ allDevices: false });
    } catch {
      // still clear local session
    }
    // Mark before clearSession so ProtectedRoute does not attach ?next= previous page.
    markIntentionalLogoutRedirect();
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="cab-shell" data-role={theme} data-theme="cab">
      <header className="cab-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo variant="light" markOnly className="h-7 w-7 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-clox-ink">CLOX Cab</p>
            <p className="truncate font-mono text-[11px] text-clox-mute">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RoleBadge role={role} className="hidden sm:inline-flex" />
          <NotificationBell />
          <LanguageSwitcher />
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => void signOut()}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:inline">{t('signOut')}</span>
          </Button>
        </div>
      </header>

      {/*
        Scroll lives ONLY on main (min-h-0 + overflow-y-auto). Tab bar is in-flow
        below main so it never covers CTAs and never blocks scroll.
      */}
      <main className="cab-main">
        <div className="cab-main-inner">{children ?? <Outlet />}</div>
      </main>

      <nav className="cab-tabbar" aria-label={t('nav.main')}>
        <CabTab to="/" end label={t('nav.cabHome')} icon={navIconForPath('/')} />
        <CabTab to="/trips" label={t('nav.cabTrips')} icon={navIconForPath('/trips')} />
        <CabTab
          to="/driver/onboarding"
          label={t('nav.cabOnboarding')}
          icon={navIconForPath('/driver/onboarding')}
        />
        <CabTab to="/account" label={t('nav.cabAccount')} icon={navIconForPath('/account')} />
      </nav>
    </div>
  );
}

function OpsShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const confirm = useConfirm();
  const email = useAuthStore((state) => state.email);
  const displayName = useAuthStore((state) => state.displayName);
  const role = useAuthStore((state) => state.role);
  const kind = useAuthStore((state) => state.kind);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = roleThemeFromRole(role);

  async function signOut() {
    const ok = await confirm({
      title: t('confirm.signOutTitle'),
      description: t('confirm.signOutBody'),
      confirmLabel: t('signOut'),
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await logout({ allDevices: false });
    } catch {
      // still clear local session
    }
    // Mark before clearSession so ProtectedRoute does not attach ?next= previous page.
    markIntentionalLogoutRedirect();
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

      <div className="min-w-0 overflow-x-hidden lg:pl-[222px]">
        <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between gap-2 border-b border-clox-border bg-clox-surface px-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clox-surface-alt text-clox-mute lg:hidden"
              aria-label={t('nav.openMenu')}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-[18px] w-[18px]" aria-hidden strokeWidth={2} />
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

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <NotificationBell />
            <LanguageSwitcher />
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => void signOut()}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{t('signOut')}</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
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
