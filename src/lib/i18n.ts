import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  defaultLocale,
  enCommon,
  hiCommon,
  isAppLocale,
  paCommon,
  LOCALE_STORAGE_KEY,
  normalizeAppLocale,
  type AppLocale,
} from '@/locales';

function readStoredLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return defaultLocale;
  return normalizeAppLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
}

const envLocale = import.meta.env.VITE_DEFAULT_LOCALE as string | undefined;
const initialLocale = isAppLocale(envLocale) ? envLocale : readStoredLocale();

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: defaultLocale,
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    en: { common: enCommon },
    hi: { common: hiCommon },
    pa: { common: paCommon },
  },
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
}

export { i18n };
