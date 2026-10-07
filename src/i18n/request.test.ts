import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import pt from '../../messages/pt.json';

let cookieValue: string | undefined;
let userLocale: string | null = null;
let installationLocale: string | null = null;
let installationCalls = 0;

vi.mock('./preferences', () => ({
  getUserLocale: async () => userLocale,
  getInstallationLocale: async () => {
    installationCalls += 1;
    return installationLocale;
  },
}));

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
    userLocale = null;
    installationLocale = null;
    installationCalls = 0;
  });

  it('no consulta el idioma de la instalación si ya decidió el usuario o la cookie', async () => {
    userLocale = 'en';
    await resolveLocale();
    userLocale = null;
    cookieValue = 'pt';
    await resolveLocale();
    expect(installationCalls).toBe(0);
    cookieValue = undefined;
    await resolveLocale();
    expect(installationCalls).toBe(1);
  });

  it('sin cookie usa español', async () => {
    expect(await resolveLocale()).toBe('es');
  });

  it('el idioma del usuario manda sobre la cookie y la instalación', async () => {
    userLocale = 'en';
    cookieValue = 'pt';
    installationLocale = 'pt';
    expect(await resolveLocale()).toBe('en');
  });

  it('la cookie manda sobre el idioma de la instalación', async () => {
    cookieValue = 'pt';
    installationLocale = 'en';
    expect(await resolveLocale()).toBe('pt');
  });

  it('sin usuario ni cookie usa el idioma de la instalación', async () => {
    installationLocale = 'en';
    expect(await resolveLocale()).toBe('en');
  });

  it('salta los valores inválidos de cada fuente', async () => {
    userLocale = 'fr';
    cookieValue = 'de';
    installationLocale = 'pt';
    expect(await resolveLocale()).toBe('pt');
    installationLocale = 'it';
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
