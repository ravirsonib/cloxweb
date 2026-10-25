import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { setAppLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import type { AppLocale } from '@/locales';

const options: { locale: AppLocale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'hi', label: 'हिन्दी (Hindi)' },
];

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation('common');
  const current = (i18n.language?.startsWith('hi') ? 'hi' : 'en') as AppLocale;
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  function switchTo(locale: AppLocale) {
    setOpen(false);
    if (locale === current) return;
    setAppLocale(locale);
  }

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 168);
    const gap = 4;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < 120 && rect.top > spaceBelow;

    if (openUp) {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        bottom: window.innerHeight - rect.top + gap,
        top: 'auto',
      });
    } else {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        top: rect.bottom + gap,
        bottom: 'auto',
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const listbox =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            aria-label={t('language')}
            className="clox-select-popover overflow-hidden p-0"
            style={popoverStyle}
          >
            {options.map((option) => {
              const active = option.locale === current;
              return (
                <button
                  key={option.locale}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex w-full px-4 py-3 text-left text-[0.95rem] transition',
                    active
                      ? 'bg-clox-surface-alt font-bold text-clox-ink'
                      : 'text-clox-text hover:bg-clox-accent-tint hover:text-clox-accent-deep',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    switchTo(option.locale);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-clox-mute transition hover:bg-clox-surface-alt hover:text-clox-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={t('language')}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{current === 'hi' ? 'HI' : 'EN'}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {listbox}
    </div>
  );
}
