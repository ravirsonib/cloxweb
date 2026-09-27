import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLocale } from '@/lib/i18n';
import type { AppLocale } from '@/locales';

const options: { locale: AppLocale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'hi', label: 'हिन्दी (Hindi)' },
];

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation('common');
  const current = (i18n.language?.startsWith('hi') ? 'hi' : 'en') as AppLocale;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  function switchTo(locale: AppLocale) {
    setOpen(false);
    if (locale === current) return;
    setAppLocale(locale);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-white transition hover:text-clox-orange"
        aria-haspopup="listbox"
        aria-expanded={open}
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

      {open ? (
        <div
          role="listbox"
          aria-label={t('language')}
          className="absolute right-0 top-full z-[1001] mt-1 min-w-[10.5rem] overflow-hidden rounded-lg bg-white shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
        >
          {options.map((option) => {
            const active = option.locale === current;
            return (
              <button
                key={option.locale}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full px-4 py-3 text-left text-[0.95rem] transition ${
                  active
                    ? 'bg-slate-100 font-bold text-clox-navy'
                    : 'text-slate-800 hover:bg-clox-surface hover:text-clox-orange'
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  switchTo(option.locale);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
