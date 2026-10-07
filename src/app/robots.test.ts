import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('bloquea todo el rastreo (la app es interna, no se indexa)', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
