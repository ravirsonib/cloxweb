import { i18n } from '@/lib/i18n';

/**
 * Canonical Australian timezones mapped by state.
 */
export const AU_STATE_TIMEZONES: Record<string, string> = {
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  ACT: 'Australia/Sydney',
  TAS: 'Australia/Hobart',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  NT: 'Australia/Darwin',
  WA: 'Australia/Perth',
};

/**
 * Standard Platform Reference Timezone (AEST / AEDT).
 * Used across the entire platform for timestamps, audit logs, and reports.
 */
export const PLATFORM_TIMEZONE = 'Australia/Sydney';

function resolveLocale(): string {
  if (i18n.language?.startsWith('hi')) return 'hi-IN';
  if (i18n.language?.startsWith('pa')) return 'pa-IN';
  return 'en-AU';
}

/**
 * Formats a pure calendar date (date-only: e.g. Driver Licence Expiry, RWC expiry, DOB)
 * in Australian format (DD/MM/YYYY).
 *
 * This function NEVER converts across timezones, preventing dates from advancing
 * by +1 day due to UTC midnight offsets (e.g. 23:59:59 UTC).
 */
export function formatCalendarDate(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('dash', { defaultValue: '—' });
  const str = typeof value === 'string' ? value : value.toISOString();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return i18n.t('dash', { defaultValue: '—' });
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date in standard Australian format (DD/MM/YYYY) using the platform timezone.
 */
export function formatDate(
  value: string | Date | null | undefined,
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  if (!value) return i18n.t('dash', { defaultValue: '—' });
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return i18n.t('dash', { defaultValue: '—' });
  return new Intl.DateTimeFormat(resolveLocale(), {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats time (e.g. 14:30 or 2:30 pm) in standard platform timezone.
 */
export function formatTime(
  value: string | Date | null | undefined,
  timeZone: string = PLATFORM_TIMEZONE,
): string {
  if (!value) return i18n.t('dash', { defaultValue: '—' });
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return i18n.t('dash', { defaultValue: '—' });
  return new Intl.DateTimeFormat(resolveLocale(), {
    timeZone,
    timeStyle: 'short',
  }).format(date);
}

/**
 * Formats a point-in-time timestamp (e.g. createdAt, completedAt) in the standard
 * platform timezone (Australia/Sydney).
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  options?: { timeZone?: string; showTime?: boolean },
): string {
  if (!value) return i18n.t('dash', { defaultValue: '—' });
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return i18n.t('dash', { defaultValue: '—' });
  const timeZone = options?.timeZone || PLATFORM_TIMEZONE;
  return new Intl.DateTimeFormat(resolveLocale(), {
    timeZone,
    dateStyle: 'medium',
    timeStyle: options?.showTime === false ? undefined : 'short',
  }).format(date);
}

/**
 * Formats a location-aware timestamp (e.g. pickupAt, delivery appointment)
 * in the state's specific timezone (e.g. Perth = AWST, Brisbane = AEST, Sydney = AEDT),
 * including the timezone abbreviation.
 */
export function formatLocationDateTime(
  value: string | Date | null | undefined,
  state?: string | null,
): string {
  if (!value) return i18n.t('dash', { defaultValue: '—' });
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return i18n.t('dash', { defaultValue: '—' });
  const timeZone = (state && AU_STATE_TIMEZONES[state]) || PLATFORM_TIMEZONE;
  return new Intl.DateTimeFormat(resolveLocale(), {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(date);
}
