const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateProfile, profileFiles, parseProfile } = require('./team-profiles.cjs');

const teamDir = path.join(__dirname, '..', '..', 'team');

test('todos los perfiles de team/ son válidos', () => {
  const files = profileFiles(teamDir);
  assert.ok(files.length >= 1, 'debe existir al menos un perfil');
  for (const f of files) {
    const errors = validateProfile(f, fs.readFileSync(f, 'utf8'));
    assert.deepEqual(errors, [], `${path.basename(f)}: ${errors.join('; ')}`);
  }
});

const ok = `---
name: Persona Prueba
github: persona
languages: [es, pt]
since: 2026-10
links:
  - https://example.com
---

Hago pruebas y traducciones.
`;

test('parseProfile lee listas en línea y en bloque', () => {
  const { data, body } = parseProfile(ok);
  assert.deepEqual(data.languages, ['es', 'pt']);
  assert.deepEqual(data.links, ['https://example.com']);
  assert.equal(body, 'Hago pruebas y traducciones.');
});

test('validateProfile acepta un perfil correcto', () => {
  assert.deepEqual(validateProfile('team/persona.md', ok), []);
});

test('validateProfile rechaza errores comunes', () => {
  const v = (text, file = 'team/persona.md') => validateProfile(file, text).join(' | ');
  assert.match(v(ok, 'team/otra.md'), /no coincide/);
  assert.match(v(ok.replace('name: Persona Prueba\n', '')), /falta "name"/);
  assert.match(v(ok.replace('Hago pruebas', 'Soy el fundador y hago pruebas')), /jerarquía/);
  assert.match(v(ok.replace('Hago pruebas', 'Llámame al +593 99 123 4567. Hago pruebas')), /teléfono/);
  assert.match(v(ok.replace('Hago pruebas', 'Escríbeme a persona@example.com. Hago pruebas')), /correo/);
  assert.match(v(ok.replace('[es, pt]', '[es, fr]')), /languages/);
  assert.match(v(ok.replace('https://example.com', 'http://example.com')), /https/);
  assert.match(v(ok.replace('Hago pruebas y traducciones.', 'x'.repeat(601))), /máximo/);
  assert.match(v('sin frontmatter'), /frontmatter/);
  assert.match(v(ok.replace('github: persona', 'github: not a user'), 'team/not a user.md'), /usuario-de-github/);
  assert.match(v(ok.replace('Hago pruebas', 'Vivo en la calle Bolívar 123. Hago pruebas')), /dirección/);
  assert.match(v(ok.replace('Hago pruebas', 'Moro na rua das Flores 45. Hago pruebas')), /dirección/);
});

test('validateProfile rechaza títulos de jerarquía en los 3 idiomas', () => {
  const v = (s) => validateProfile('team/persona.md', ok.replace('Hago pruebas', `${s}. Hago pruebas`)).join(' | ');
  for (const s of ['Soy el autor del proyecto', 'Soy la dueña del proyecto', 'Sou o dono do projeto', 'Sou o criador', 'I am the project owner', 'Co-founder here', 'I am the project author', 'Soy líder del equipo']) {
    assert.match(v(s), /jerarquía/, s);
  }
  for (const s of ['Me gusta servir en mi barrio', 'Apoyo a los líderes de mi unidad con la tecnología', 'Escribo en mi blog']) {
    assert.equal(v(s), '', s);
  }
});
