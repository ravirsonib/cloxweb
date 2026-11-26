import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand-logo';
import { CloxLoader } from '@/components/clox-loader';
import { isCabTheme, roleThemeFromRole } from '@/lib/role-theme';
import { useAuthStore } from '@/stores/auth-store';

type AppBootScreenProps = {
  /** Override status label; defaults to common:loading */
  label?: string;
};

/**
 * Full-viewport boot / session-hydrate screen.
 * Use for auth persist rehydrate, login session prepare, and standalone invite peeks —
 * not for in-page queries (those keep LoadingBlock inside the shell).
 */
export function AppBootScreen({ label }: AppBootScreenProps) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const isCab = isCabTheme(roleThemeFromRole(role));
  const text = label ?? t('loading');

  return (
    <main
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-clox-bg px-6 py-12 text-clox-text"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text}
    >
      <div className="clox-panel flex w-full max-w-xs flex-col items-center gap-5 px-8 py-10 text-center shadow-clox-2">
        <BrandLogo variant={isCab ? 'light' : 'default'} className="h-8 w-auto object-contain" />
        <CloxLoader size={56} label={text} decorative className="shadow-clox-1" />
        <p className="text-sm font-medium text-clox-mute">{text}</p>
      </div>
    </main>
  );
}
