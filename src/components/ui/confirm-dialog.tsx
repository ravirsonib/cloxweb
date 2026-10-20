import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type ConfirmTone = 'default' | 'destructive';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [state, setState] = useState<ConfirmState | null>(null);
  const titleId = useId();
  const descId = useId();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState((prev) => {
        prev?.resolve(false);
        return { ...options, resolve };
      });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setState((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    confirmBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state, close]);

  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <div
            className="clox-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={state.description ? descId : undefined}
          >
            <h2 id={titleId} className="font-display text-lg font-semibold text-clox-ink">
              {state.title}
            </h2>
            {state.description ? (
              <p id={descId} className="mt-2 text-sm text-clox-mute">
                {state.description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel ?? t('confirm.cancel')}
              </Button>
              <Button
                ref={confirmBtnRef}
                type="button"
                variant={state.tone === 'destructive' ? 'destructive' : 'cta'}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? t('confirm.confirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
