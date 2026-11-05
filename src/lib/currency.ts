/**
 * Global Currency & Formatting Configuration
 *
 * Centralizes currency configuration (code, symbol, locale, decimals) across the entire application.
 * Changing the configuration here updates every screen, ledger, chart, and KPI automatically.
 */

export interface CurrencyConfig {
  code: string;       // e.g. 'AUD'
  symbol: string;     // e.g. '$' or 'A$'
  locale: string;     // e.g. 'en-AU'
  decimals: number;   // e.g. 2
}

export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: 'AUD',
  symbol: 'A$',
  locale: 'en-AU',
  decimals: 2,
};

let currentCurrency: CurrencyConfig = { ...DEFAULT_CURRENCY };

export const CURRENCY_SYMBOL = DEFAULT_CURRENCY.symbol;
export const CURRENCY_CODE = DEFAULT_CURRENCY.code;

export function setCurrencyConfig(config: Partial<CurrencyConfig>) {
  currentCurrency = { ...currentCurrency, ...config };
}

export function getCurrencyConfig(): Readonly<CurrencyConfig> {
  return currentCurrency;
}

export function getCurrencySymbol(): string {
  return currentCurrency.symbol;
}

export function getCurrencyCode(): string {
  return currentCurrency.code;
}

export interface FormatCurrencyOptions {
  decimals?: number;
  showSymbol?: boolean;
  code?: boolean; // append currency code, e.g. "$1,200.00 AUD"
}

/**
 * Format an integer cents amount to a formatted currency string.
 * e.g. 125000 -> "$1,250.00"
 */
export function formatCurrency(
  cents: number | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  if (cents == null || Number.isNaN(cents)) return '-';
  const { symbol, locale, decimals: defaultDecimals, code: currCode } = currentCurrency;
  const decimals = options.decimals ?? defaultDecimals;
  const showSymbol = options.showSymbol ?? true;
  const dollars = cents / 100;

  const formattedNumber = dollars.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const withSymbol = showSymbol ? `${symbol}${formattedNumber}` : formattedNumber;
  return options.code ? `${withSymbol} ${currCode}` : withSymbol;
}

/**
 * Format raw dollars (floating number) to a formatted currency string.
 * e.g. 1250 -> "$1,250.00"
 */
export function formatDollarsAmount(
  dollars: number | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  if (dollars == null || Number.isNaN(dollars)) return '-';
  return formatCurrency(Math.round(dollars * 100), options);
}

/**
 * Drop-in backwards-compatible alias for existing formatDollars callers.
 */
export const formatDollars = formatCurrency;

/**
 * Format integer cents into compact representation.
 * e.g. 150000000 -> "$1.50M", 2500000 -> "$25.0k", 85000 -> "$850"
 */
export function formatCompactCurrency(
  cents: number | null | undefined,
  options: { showSymbol?: boolean } = {},
): string {
  if (cents == null || Number.isNaN(cents)) return '-';
  const symbol = options.showSymbol !== false ? currentCurrency.symbol : '';
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `${symbol}${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `${symbol}${(dollars / 1_000).toFixed(1)}k`;
  return `${symbol}${dollars.toFixed(0)}`;
}

export const formatCompactDollars = formatCompactCurrency;
