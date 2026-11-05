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
import { createPortal } from 'react-dom';
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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [state, close]);

  const api = useMemo(() => confirm, [confirm]);

  const dialogNode =
    state && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close(false);
            }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a2f4c] p-6 shadow-2xl border border-slate-200 dark:border-slate-700/80 text-left overflow-hidden animate-in zoom-in-95 duration-150"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={state.description ? descId : undefined}
            >
              <h2 id={titleId} className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {state.title}
              </h2>
              {state.description ? (
                <p id={descId} className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {state.description}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600 font-semibold px-4 py-2 rounded-lg"
                  onClick={() => close(false)}
                >
                  {state.cancelLabel ?? t('confirm.cancel')}
                </Button>
                <Button
                  ref={confirmBtnRef}
                  type="button"
                  variant={state.tone === 'destructive' ? 'destructive' : 'cta'}
                  className={
                    state.tone === 'destructive'
                      ? 'bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm border border-transparent'
                      : 'bg-[#f26e22] hover:bg-[#c6551a] text-white font-semibold px-4 py-2 rounded-lg shadow-sm border border-transparent'
                  }
                  onClick={() => close(true)}
                >
                  {state.confirmLabel ?? t('confirm.confirm')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {dialogNode}
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
