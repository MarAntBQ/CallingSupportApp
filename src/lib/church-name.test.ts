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
    'Barrio Santos de los Últimos Días',
    'Ala dos Santos dos Últimos Dias',
    'Latter-day Saints Ward',
    'SUD Central',
    'Rama LDS Norte',
  ])('rechaza "%s"', (name) => {
    expect(containsOfficialChurchName(name)).toBe(true);
  });

  it.each([
    ['con un espacio de ancho cero', 'Iglesia de Jesu​cristo Centro'],
    ['con una c cirílica', 'Iglesia de Jesuсristo Centro'],
    ['con una o griega', 'Iglesia de Jesucristο Centro'],
    ['con letras de ancho completo', 'Ｉglesia de Ｊesucristo'],
  ])('rechaza el nombre oficial disfrazado %s', (_case, name) => {
    expect(containsOfficialChurchName(name)).toBe(true);
  });

  it.each(['Barrio Los Laureles', 'Rama Santo Domingo Norte', 'Ala Central', 'Second Ward', 'Barrio Jesucristo Vive', 'Rama Sudamérica'])(
    'acepta "%s"',
    (name) => {
      expect(containsOfficialChurchName(name)).toBe(false);
    },
  );
});
