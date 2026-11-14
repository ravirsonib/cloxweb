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
 * Some locales (notably `pa-IN`) reject `dateStyle`/`timeStyle` in Chromium
 * with `RangeError: Invalid option : option`. Prefer discrete fields + fallback.
 */
function safeDateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locales = [resolveLocale(), 'en-AU', 'en'];
  for (const locale of locales) {
    try {
      return new Intl.DateTimeFormat(locale, options);
    } catch {
      // try next locale
    }
  }
  // Last resort: no locale-sensitive styles that can fail.
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: options.timeZone || PLATFORM_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Formatters must never throw into React render. */
function formatOrDash(run: () => string): string {
  try {
    return run();
  } catch {
    return i18n.t('dash', { defaultValue: '—' });
  }
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
  return formatOrDash(() =>
    safeDateTimeFormat({
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date),
  );
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
  return formatOrDash(() =>
    safeDateTimeFormat({
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  );
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
  const showTime = options?.showTime !== false;
  return formatOrDash(() =>
    safeDateTimeFormat({
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(showTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
          }
        : {}),
    }).format(date),
  );
}

export function resolveStateTimeZone(state?: string | null): string {
  const code = state?.trim().toUpperCase();
  return (code && AU_STATE_TIMEZONES[code]) || PLATFORM_TIMEZONE;
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
  const timeZone = resolveStateTimeZone(state);
  return formatOrDash(() => {
    try {
      return safeDateTimeFormat({
        timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date);
    } catch {
      return safeDateTimeFormat({
        timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convert an instant to `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`
 * using the pickup state's wall clock.
 */
export function toDatetimeLocalValue(
  value: string | Date | null | undefined,
  state?: string | null,
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = resolveStateTimeZone(state);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  // Some engines still emit "24" for midnight with hour12:false — normalize.
  const hourRaw = get('hour');
  const hour = hourRaw === '24' ? '00' : hourRaw.padStart(2, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** Offset for `timeZone` at `date`, without `timeZoneName: 'longOffset'` (poor Safari support). */
function offsetIsoForInstant(date: Date, timeZone: string): string {
  const utcWall = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zonedWall = new Date(date.toLocaleString('en-US', { timeZone }));
  const diffMin = Math.round((zonedWall.getTime() - utcWall.getTime()) / 60_000);
  const sign = diffMin >= 0 ? '+' : '-';
  const abs = Math.abs(diffMin);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/**
 * Interpret a datetime-local wall time in the pickup state's zone → ISO-8601 with offset
 * (compatible with `jobCreateSchema.pickupAt`).
 */
export function fromDatetimeLocalValue(
  localValue: string,
  state?: string | null,
): string {
  const trimmed = localValue.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error('Invalid datetime-local value');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const timeZone = resolveStateTimeZone(state);

  // Guess UTC instant, then correct so the wall clock in `timeZone` matches.
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const asLocal = toDatetimeLocalValue(new Date(utcGuess), state);
    const got = asLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!got) break;
    const gotUtc = Date.UTC(
      Number(got[1]),
      Number(got[2]) - 1,
      Number(got[3]),
      Number(got[4]),
      Number(got[5]),
      second,
    );
    const wantedUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    utcGuess += wantedUtc - gotUtc;
  }

  const instant = new Date(utcGuess);
  const wall = toDatetimeLocalValue(instant, state);
  const offset = offsetIsoForInstant(instant, timeZone);
  return `${wall}:${pad2(second)}${offset}`;
}

/** Default create value: tomorrow 08:00 in the pickup state's wall clock. */
export function defaultPickupDatetimeLocal(state?: string | null): string {
  const nowLocal = toDatetimeLocalValue(new Date(), state);
  const datePart = nowLocal.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  return `${tomorrow.getUTCFullYear()}-${pad2(tomorrow.getUTCMonth() + 1)}-${pad2(tomorrow.getUTCDate())}T08:00`;
}

/** `YYYY-MM-DDTHH:mm` for “now” — use as `<input type="datetime-local" min>`. */
export function minDatetimeLocalValue(state?: string | null): string {
  return toDatetimeLocalValue(new Date(), state);
}

/** `YYYY-MM-DD` for “today” — use as `<input type="date" min>`. */
export function minDateInputValue(state?: string | null): string {
  return minDatetimeLocalValue(state).slice(0, 10);
}

/** True when datetime-local wall time is current or future in the given state zone. */
export function isDatetimeLocalNotInPast(
  localValue: string,
  state?: string | null,
): boolean {
  const trimmed = localValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return false;
  return trimmed >= minDatetimeLocalValue(state);
}

/** True when date-only value is today or later in the given state zone. */
export function isDateInputNotInPast(dateValue: string, state?: string | null): boolean {
  const trimmed = dateValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return trimmed >= minDateInputValue(state);
}
