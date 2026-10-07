import { describe, expect, it } from 'vitest';
import { toEntry } from './merged-prs.mjs';
import { SITE_TIME_ZONE, siteDate } from './site-time.mjs';

const pr = (merged_at, number = 104) => ({
  number,
  title: 'Cambio',
  body: '',
  merged_at,
  user: { login: 'MarAntBQ', type: 'User' },
  labels: [],
});

describe('fechas del sitio en la hora de Ecuador', () => {
  it('la zona del proyecto es America/Guayaquil', () => {
    expect(SITE_TIME_ZONE).toBe('America/Guayaquil');
  });

  it('un PR mergeado a las 23:44 del 6 de octubre en Ecuador sale el 6', () => {
    expect(toEntry(pr('2026-10-07T04:44:00Z')).date).toBe('2026-10-06');
  });

  it('desde las 00:00 de Ecuador ya es el día siguiente', () => {
    expect(toEntry(pr('2026-10-07T05:00:00Z')).date).toBe('2026-10-07');
    expect(siteDate('2026-10-07T04:59:59Z')).toBe('2026-10-06');
  });

  it('dos PR del mismo día en Ecuador quedan en el mismo día y conservan el orden por hora UTC', () => {
    const early = toEntry(pr('2026-10-06T14:00:00Z', 101));
    const late = toEntry(pr('2026-10-07T04:30:00Z', 104));
    expect([early.date, late.date]).toEqual(['2026-10-06', '2026-10-06']);
    expect(late.mergedAt.localeCompare(early.mergedAt)).toBeGreaterThan(0);
  });

  it('acepta objetos Date y rechaza fechas inválidas', () => {
    expect(siteDate(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
    expect(() => siteDate('no es fecha')).toThrow();
  });
});
