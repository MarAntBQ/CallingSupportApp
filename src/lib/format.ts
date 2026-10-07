import type { Locale } from '@/i18n/config';

export const DEFAULT_CURRENCY = 'USD';

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' },
) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatMoney(amount: number, locale: Locale, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export const ciTypecheckProbe: number = 'no es un número';
