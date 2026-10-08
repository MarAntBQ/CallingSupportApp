import { describe, expect, it } from 'vitest';
import { nextFreeSlug, slugify } from './constants';

describe('slugify', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(slugify('Campamento de Mujeres Jóvenes 2026')).toBe('campamento-de-mujeres-jovenes-2026');
    expect(slugify('  ¡Ñandú & Cía.!  ')).toBe('nandu-cia');
  });

  it('nunca queda vacío ni pasa de 60 caracteres', () => {
    expect(slugify('¡¡¡')).toBe('camp');
    const long = slugify('a'.repeat(30) + ' ' + 'b'.repeat(40));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).not.toMatch(/-$/);
  });
});

describe('nextFreeSlug', () => {
  it('agrega -2, -3… cuando el slug ya existe', () => {
    expect(nextFreeSlug('campamento', new Set())).toBe('campamento');
    expect(nextFreeSlug('campamento', new Set(['campamento']))).toBe('campamento-2');
    expect(nextFreeSlug('campamento', new Set(['campamento', 'campamento-2']))).toBe('campamento-3');
  });

  it('nunca usa "me", reservado para el enlace personal /camps/me/<token>', () => {
    expect(nextFreeSlug('me', new Set())).toBe('me-2');
  });

  it('recorta el slug largo para que el sufijo quepa en 60', () => {
    const base = 'a'.repeat(60);
    const next = nextFreeSlug(base, new Set([base]));
    expect(next).toHaveLength(60);
    expect(next.endsWith('-2')).toBe(true);
  });
});
