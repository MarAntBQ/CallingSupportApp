const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidTitle, TYPES } = require('./pr-title.cjs');

test('acepta cada tipo de AGENTS.md, con o sin ámbito', () => {
  for (const type of TYPES) assert.equal(isValidTitle(`${type}: algo en español`), true, type);
  assert.equal(isValidTitle('chore(submodules): bump a 025f22f'), true);
  assert.equal(isValidTitle('fix: fechas de Novedades en la hora de Ecuador (#114)'), true);
});

test('rechaza títulos sin tipo o con un tipo que no existe', () => {
  for (const title of [
    'Componente de tablas: búsqueda, orden y paginación',
    'Arreglo de algo',
    'feature: algo',
    'Fix: mayúscula',
    'fix:sin espacio',
    'fix: ',
    'fix(): ámbito vacío',
    '',
  ]) {
    assert.equal(isValidTitle(title), false, title);
  }
});
