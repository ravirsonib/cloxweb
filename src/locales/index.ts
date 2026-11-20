import type { ResourceLanguage } from 'i18next';

/**
 * Domain JSON files under `en|hi|pa/` are merged into a single `common` namespace
 * so call sites keep `t('jobs.createHint')` / `useTranslation('common')`.
 *
 * Layout (same filenames per language):
 *   common.json            — shared chrome (nav, home, login, toasts, …)
 *   jobs.json              — jobs, jobStatuses, loadTypes, market, assignments
 *   validation.json
 *   senderOnboarding.json  — senderOnboarding, senderRegister
 *   carrierOnboarding.json
 *   driverOnboarding.json
 *   partnerOnboarding.json
 *   finance.json
 *   trips.json
 *   fleet.json
 *   account.json
 *   admin.json
 *
 * Re-split after a monolith restore: `node admin/scripts/split-locales.mjs`
 * Key parity (merged trees): `npm run i18n:parity`
 */

type LocaleJson = Record<string, unknown>;

function mergeLocaleModules(
  modules: Record<string, LocaleJson>,
): ResourceLanguage {
  const merged: LocaleJson = {};
  for (const part of Object.values(modules)) {
    Object.assign(merged, part);
  }
  return merged as ResourceLanguage;
}

const enModules = import.meta.glob('./en/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, LocaleJson>;

const hiModules = import.meta.glob('./hi/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, LocaleJson>;

const paModules = import.meta.glob('./pa/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, LocaleJson>;

export const enCommon = mergeLocaleModules(enModules);
export const hiCommon = mergeLocaleModules(hiModules);
export const paCommon = mergeLocaleModules(paModules);

export const defaultLocale = 'en' as const;
export const supportedLocales = ['en', 'hi', 'pa'] as const;
export type AppLocale = (typeof supportedLocales)[number];

export const LOCALE_STORAGE_KEY = 'clox-admin-locale';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (supportedLocales as readonly string[]).includes(value);
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  if (value?.startsWith('hi')) return 'hi';
  if (value?.startsWith('pa')) return 'pa';
  return defaultLocale;
}
