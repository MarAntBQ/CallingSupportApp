import { describe, expect, it } from 'vitest';
import { containsOfficialChurchName } from './church-name';

describe('containsOfficialChurchName', () => {
  it.each([
    'Barrio Iglesia de Jesucristo Centro',
    'La Iglesia de Jesucristo de los Santos de los Últimos Días - Barrio Norte',
    'IGLESIA DE JESUCRISTO',
    'iglesia  de   jesucristo',
    'Ala Igreja de Jesus Cristo Sul',
    'A Igreja de Jesus Cristo dos Santos dos Últimos Dias',
    'The Church of Jesus Christ of Latter-day Saints Ward',
    'church-of-jesus-christ branch',
    'Iglesia de Jesucristo, Rama Sur',
  ])('rechaza "%s"', (name) => {
    expect(containsOfficialChurchName(name)).toBe(true);
  });

  it.each(['Barrio Los Laureles', 'Rama Santo Domingo Norte', 'Ala Central', 'Second Ward', 'Barrio Jesucristo Vive'])(
    'acepta "%s"',
    (name) => {
      expect(containsOfficialChurchName(name)).toBe(false);
    },
  );
});
