import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export type ToastInput = {
  tone?: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
};

type ToastApi = {
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  warn: (message: string, title?: string) => string;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  info: 4000,
  success: 3500,
  warn: 5000,
  error: 6000,
};

const toneClass: Record<ToastTone, string> = {
  info: 'clox-notice-info',
  success: 'clox-notice-success',
  warn: 'clox-notice-warn',
  error: 'clox-notice-error',
};

let toastId = 0;

function nextId() {
  toastId += 1;
  return `toast-${toastId}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId();
      const tone = input.tone ?? 'info';
      const item: ToastItem = {
        id,
        tone,
        title: input.title,
        message: input.message,
        durationMs: input.durationMs,
      };
      setItems((prev) => [...prev.slice(-4), item]);

      const duration = input.durationMs ?? DEFAULT_DURATION[tone];
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (message, title) => push({ tone: 'success', message, title }),
      error: (message, title) => push({ tone: 'error', message, title }),
      info: (message, title) => push({ tone: 'info', message, title }),
      warn: (message, title) => push({ tone: 'warn', message, title }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="clox-toast-viewport" aria-live="polite" aria-relevant="additions text">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn('clox-toast', 'clox-notice', toneClass[item.tone])}
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <div className="min-w-0 flex-1">
              {item.title ? <p className="font-semibold text-inherit">{item.title}</p> : null}
              <p className={cn('text-sm', item.title && 'mt-0.5')}>{item.message}</p>
            </div>
            <button
              type="button"
              className="clox-toast-dismiss"
              aria-label={t('toast.dismiss')}
              onClick={() => dismiss(item.id)}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
