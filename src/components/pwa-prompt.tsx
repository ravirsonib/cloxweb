import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * PWA install + update prompts. App talks to the real Nest API (NetworkOnly for /v1).
 */
export function PwaPrompt() {
  const { t } = useTranslation('common');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[PWA] SW registered', swUrl);
      }
    },
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (needRefresh) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-clox-border bg-clox-surface p-4 shadow-clox-2">
        <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-clox-text">{t('pwa.updateReady')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNeedRefresh(false)}>
              {t('pwa.later')}
            </Button>
            <Button variant="cta" size="sm" onClick={() => void updateServiceWorker(true)}>
              {t('pwa.update')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!installEvent || dismissedInstall) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-clox-border bg-clox-surface p-4 shadow-clox-2">
      <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-clox-text">{t('pwa.installHint')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDismissedInstall(true)}>
            {t('pwa.notNow')}
          </Button>
          <Button variant="cta" size="sm" onClick={() => void install()}>
            {t('pwa.install')}
          </Button>
        </div>
      </div>
    </div>
  );
}
