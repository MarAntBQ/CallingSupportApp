import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import pt from '../../messages/pt.json';

let cookieValue: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'csa_locale' && cookieValue !== undefined ? { value: cookieValue } : undefined),
  }),
}));

vi.mock('next-intl/server', () => ({
  getRequestConfig: <T>(factory: T) => factory,
}));

const { default: requestConfig, resolveLocale } = await import('./request');
const loadConfig = requestConfig as unknown as () => Promise<{ locale: string; messages: unknown }>;

describe('resolución del idioma', () => {
  beforeEach(() => {
    cookieValue = undefined;
  });

  it('sin cookie usa español', async () => {
    expect(await resolveLocale()).toBe('es');
  });

  it.each(['es', 'pt', 'en'])('respeta la cookie csa_locale=%s', async (locale) => {
    cookieValue = locale;
    expect(await resolveLocale()).toBe(locale);
  });

  it.each(['fr', '', 'PT', 'pt-BR', '../es'])('ignora un valor inválido (%j) y cae en español', async (value) => {
    cookieValue = value;
    expect(await resolveLocale()).toBe('es');
  });

  it('carga los mensajes del idioma elegido', async () => {
    const expected = { es, pt, en };
    for (const locale of ['es', 'pt', 'en'] as const) {
      cookieValue = locale;
      expect(await loadConfig()).toEqual({ locale, messages: expected[locale] });
    }
  });
});
