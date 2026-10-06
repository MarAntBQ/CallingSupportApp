export const LOCALES = ['es', 'pt', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export const LOCALE_NAMES: Record<Locale, string> = {
  es: 'Español',
  pt: 'Português',
  en: 'English',
};

export const LOCALE_COOKIE = 'csa_locale';

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function pickLocale(candidates: readonly unknown[]): Locale {
  return candidates.find(isLocale) ?? DEFAULT_LOCALE;
}
