import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDollarsAmount,
  getCurrencyCode,
  getCurrencyConfig,
  getCurrencySymbol,
  setCurrencyConfig,
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  type CurrencyConfig,
  type FormatCurrencyOptions,
} from '@/lib/currency';

export {
  formatCompactCurrency,
  formatCurrency,
  formatDollarsAmount,
  getCurrencyCode,
  getCurrencyConfig,
  getCurrencySymbol,
  setCurrencyConfig,
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  type CurrencyConfig,
  type FormatCurrencyOptions,
};

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  /** Amount in integer cents (e.g. 125000 = $1,250.00). Preferred in Clox. */
  cents?: number | null;
  /** Amount in floating/raw dollars (e.g. 1250 = $1,250.00). Alternate input. */
  dollars?: number | null;
  /** Whether to format as compact representation (e.g. $1.5M, $25k). */
  compact?: boolean;
  /** Whether to show the currency symbol (e.g. '$'). Defaults to true. */
  showSymbol?: boolean;
  /** Whether to append the currency code (e.g. 'AUD'). Defaults to false. */
  showCode?: boolean;
  /** Number of decimal places. Defaults to 2. */
  decimals?: number;
  /**
   * Colorize the amount automatically:
   * - Positive amounts (> 0) in green/ok tone
   * - Negative amounts (< 0) in red/danger tone
   * - Zero in neutral muted tone
   */
  colorize?: boolean;
  /** Render as a subtle pill/badge container. */
  badge?: boolean;
  /** Fallback string when amount is null/undefined. Defaults to '—'. */
  fallback?: string;
}

/**
 * Centralized Money / Currency display component.
 *
 * Ensures consistent currency symbol, code, decimal formatting, and colorization
 * across all cards, tables, charts, ledgers, and detail views.
 *
 * @example
 * ```tsx
 * <Money cents={row.amountCents} />
 * <Money cents={row.grossProfitCents} colorize />
 * <Money cents={totalVolumeCents} compact showCode />
 * <Money dollars={150} badge />
 * ```
 */
export const Money = forwardRef<HTMLSpanElement, MoneyProps>(function Money(
  {
    cents,
    dollars,
    compact = false,
    showSymbol = true,
    showCode = false,
    decimals,
    colorize = false,
    badge = false,
    fallback = '—',
    className,
    ...props
  },
  ref,
) {
  // Resolve effective cents value
  const effectiveCents =
    cents !== undefined
      ? cents
      : dollars !== undefined && dollars !== null
        ? Math.round(dollars * 100)
        : null;

  if (effectiveCents === null || Number.isNaN(effectiveCents)) {
    return (
      <span ref={ref} className={cn('text-clox-mute font-mono', className)} {...props}>
        {fallback}
      </span>
    );
  }

  const formatted = compact
    ? formatCompactCurrency(effectiveCents, { showSymbol })
    : formatCurrency(effectiveCents, {
        decimals,
        showSymbol,
        code: showCode,
      });

  const isPositive = effectiveCents > 0;
  const isNegative = effectiveCents < 0;

  const colorClasses = colorize
    ? isPositive
      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
      : isNegative
        ? 'text-red-600 dark:text-red-400 font-semibold'
        : 'text-clox-mute'
    : '';

  const badgeClasses = badge
    ? cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        colorize && isPositive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        colorize && isNegative && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        (!colorize || (!isPositive && !isNegative)) && 'bg-clox-surface-alt text-clox-ink',
      )
    : '';

  return (
    <span
      ref={ref}
      className={cn('font-mono tabular-nums tracking-tight', colorClasses, badgeClasses, className)}
      {...props}
    >
      {formatted}
    </span>
  );
});

/** Drop-in alias for Money. */
export const Currency = Money;
