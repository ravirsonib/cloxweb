import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAuthStore } from '@/stores/auth-store';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-clox-orange/15 text-clox-orange'
      : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

function NavIcon({ name }: { name: 'dashboard' | 'leads' | 'audit' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  if (name === 'dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    );
  }

  if (name === 'leads') {
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common');

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label={t('nav.main')}>
      <NavLink to="/" end className={navItemClass} onClick={onNavigate}>
        <NavIcon name="dashboard" />
        {t('nav.dashboard')}
      </NavLink>
      <NavLink to="/leads" className={navItemClass} onClick={onNavigate}>
        <NavIcon name="leads" />
        {t('nav.leads')}
      </NavLink>
      <NavLink to="/audit" className={navItemClass} onClick={onNavigate}>
        <NavIcon name="audit" />
        {t('nav.audit')}
      </NavLink>
    </nav>
  );
}

export function AdminShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const email = useAuthStore((state) => state.email);
  const adminName = useAuthStore((state) => state.adminName);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);

  function signOut() {
    clearSession();
    navigate('/login', { replace: true });
  }

  const displayName = adminName || email || t('admin.adminFallback');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label={t('nav.closeMenu')}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-slate-950 transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clox-orange/15 text-sm font-bold text-clox-orange">
            {t('brand').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-wide text-white">
              {t('brand')}
            </p>
            <p className="truncate text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              {t('admin.consoleLabel')}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <p className="mb-2 px-5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t('nav.section')}
          </p>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-xs text-slate-500">{t('admin.signedInAs')}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-200">{displayName}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 lg:hidden"
              aria-label={t('nav.openMenu')}
              onClick={() => setMobileOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white">{t('admin.workspaceTitle')}</p>
              <p className="text-xs text-slate-500">{t('admin.workspaceSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
            >
              {t('signOut')}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

export const fieldClassName =
  'w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-clox-orange';

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-xl bg-clox-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';

export const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50';
