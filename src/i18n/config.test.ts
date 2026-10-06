import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, LOCALE_NAMES, LOCALES, pickLocale } from './config';

describe('configuración de idiomas', () => {
  it('tiene los tres idiomas con español por defecto', () => {
    expect(LOCALES).toEqual(['es', 'pt', 'en']);
    expect(DEFAULT_LOCALE).toBe('es');
    expect(LOCALE_NAMES).toEqual({ es: 'Español', pt: 'Português', en: 'English' });
  });

  it('reconoce solo los idiomas soportados', () => {
    expect(LOCALES.every(isLocale)).toBe(true);
    for (const value of ['fr', 'ES', 'pt-BR', '', null, undefined, 1, {}]) {
      expect(isLocale(value)).toBe(false);
    }
  });

  it('se queda con el primer idioma válido, en orden', () => {
    expect(pickLocale(['en', 'pt'])).toBe('en');
    expect(pickLocale([null, 'fr', 'pt', 'en'])).toBe('pt');
    expect(pickLocale([undefined, null, 'fr'])).toBe('es');
    expect(pickLocale([])).toBe('es');
  });
});
