import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand-logo';
import { CloxLoader } from '@/components/clox-loader';

type AppBootScreenProps = {
  /** Override status label; defaults to common:loading */
  label?: string;
};

/**
 * Full-viewport boot / session-hydrate screen.
 * Use for auth persist rehydrate and login session prepare — not for in-page queries
 * (those keep LoadingBlock inside the shell).
 */
export function AppBootScreen({ label }: AppBootScreenProps) {
  const { t } = useTranslation('common');
  const text = label ?? t('loading');

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-clox-bg px-6 text-clox-text"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text}
    >
      <div className="flex flex-col items-center gap-5">
        <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        <CloxLoader size={48} label={text} />
        <p className="text-sm text-clox-mute">{text}</p>
      </div>
    </main>
  );
}
