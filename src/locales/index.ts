import enCommon from './en/common.json';
import hiCommon from './hi/common.json';
import paCommon from './pa/common.json';

export const defaultLocale = 'en' as const;
export const supportedLocales = ['en', 'hi', 'pa'] as const;
export type AppLocale = (typeof supportedLocales)[number];

export { enCommon, hiCommon, paCommon };

export const LOCALE_STORAGE_KEY = 'clox-admin-locale';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (supportedLocales as readonly string[]).includes(value);
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  if (value?.startsWith('hi')) return 'hi';
  if (value?.startsWith('pa')) return 'pa';
  return defaultLocale;
}
