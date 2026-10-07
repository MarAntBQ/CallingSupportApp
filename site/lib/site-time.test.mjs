import { describe, expect, it } from 'vitest';
import { fetchMergedEntries, toEntry } from './merged-prs.mjs';
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

  it('dos PR del mismo día en Ecuador quedan en ese día, del más reciente al más antiguo', async () => {
    const entries = await fetchMergedEntries({
      api: 'https://api.test',
      fetchImpl: async () => ({
        ok: true,
        json: async () => [pr('2026-10-06T14:00:00Z', 101), pr('2026-10-07T04:30:00Z', 104), pr('2026-10-07T05:10:00Z', 105)],
      }),
    });
    expect(entries.map((entry) => [entry.number, entry.date])).toEqual([
      [105, '2026-10-07'],
      [104, '2026-10-06'],
      [101, '2026-10-06'],
    ]);
  });

  it('acepta objetos Date y rechaza fechas inválidas', () => {
    expect(siteDate(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
    expect(() => siteDate('no es fecha')).toThrow();
  });
});
