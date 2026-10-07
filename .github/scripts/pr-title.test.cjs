const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { isValidTitle, PATTERN, TYPES } = require('./pr-title.cjs');

const WORKFLOW = readFileSync(join(__dirname, '../workflows/pr-title.yml'), 'utf8');
const workflowPattern = () => WORKFLOW.match(/pattern='([^']+)'/)[1];

test('acepta cada tipo de AGENTS.md, con o sin ámbito', () => {
  for (const type of TYPES) assert.equal(isValidTitle(`${type}: algo en español`), true, type);
  for (const title of [
    'chore(submodules): bump a 025f22f',
    'fix: fechas de Novedades en la hora de Ecuador (#114)',
    'fix(foo(bar)): ámbito con paréntesis',
    'fix( foo): ámbito con espacio',
  ]) {
    assert.equal(isValidTitle(title), true, title);
  }
});

test('rechaza títulos sin tipo, con un tipo que no existe o mal formados', () => {
  for (const title of [
    'Componente de tablas: búsqueda, orden y paginación',
    'Arreglo de algo',
    'feature: algo',
    'Fix: mayúscula',
    'fix:sin espacio',
    'fix: ',
    'fix(): ámbito vacío',
    ' fix: espacio al inicio',
    '',
  ]) {
    assert.equal(isValidTitle(title), false, JSON.stringify(title));
  }
});

test('el workflow valida con la misma regex que este script', () => {
  assert.equal(workflowPattern(), PATTERN.source);
});

test('el workflow no hace checkout del código del PR ni pide permisos', () => {
  assert.doesNotMatch(WORKFLOW, /actions\/checkout/);
  assert.match(WORKFLOW, /^permissions: \{\}$/m);
  assert.doesNotMatch(WORKFLOW, /run:[^\n]*\$\{\{/);
});

test('la regex del workflow se comporta igual en bash', { skip: process.platform === 'win32' }, () => {
  for (const [title, expected] of [
    ['feat: algo', 0],
    ['fix(foo(bar)): algo', 0],
    ['Arreglo de algo', 1],
    ['fix:sin espacio', 1],
  ]) {
    const result = spawnSync('bash', ['-c', `pattern='${workflowPattern()}'; [[ "$T" =~ $pattern ]]`], {
      env: { ...process.env, T: title },
    });
    assert.equal(result.status, expected, title);
  }
});
