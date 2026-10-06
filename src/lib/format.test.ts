import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatNumber } from './format';

const NBSP = ' ';

describe('formatos según el idioma', () => {
  it('formatMoney(30) en USD', () => {
    expect(formatMoney(30, 'es')).toBe(`30,00${NBSP}US$`);
    expect(formatMoney(30, 'pt')).toBe(`US$${NBSP}30,00`);
    expect(formatMoney(30, 'en')).toBe('$30.00');
  });

  it('formatMoney acepta otra moneda', () => {
    expect(formatMoney(30, 'en', 'BRL')).toBe('R$30.00');
  });

  it('formatNumber usa los separadores de cada idioma', () => {
    expect(formatNumber(1234567.5, 'es')).toBe('1.234.567,5');
    expect(formatNumber(1234567.5, 'pt')).toBe('1.234.567,5');
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
  });

  it('formatDate escribe la fecha larga en cada idioma', () => {
    const date = '2026-10-24T12:00:00Z';
    const options = { dateStyle: 'long', timeZone: 'UTC' } as const;
    expect(formatDate(date, 'es', options)).toBe('24 de octubre de 2026');
    expect(formatDate(date, 'pt', options)).toBe('24 de outubro de 2026');
    expect(formatDate(date, 'en', options)).toBe('October 24, 2026');
  });
});
