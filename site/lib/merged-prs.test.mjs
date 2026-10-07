import { describe, expect, it } from 'vitest';
import { fetchMergedEntries, parseNovedad, prNumberFromUrl, toEntry } from './merged-prs.mjs';

const pr = (over = {}) => ({
  number: 97,
  title: 'Favicon y logo',
  body: '',
  merged_at: '2026-10-07T03:00:00Z',
  html_url: 'https://github.com/MarAntBQ/CallingSupportApp/pull/97',
  user: { login: 'MarAntBQ', type: 'User' },
  labels: [],
  ...over,
});

const body = `## Resumen

Texto.

## Novedad

<!-- una línea por idioma -->
- es: La aplicación muestra su logo.
- pt: O aplicativo mostra seu logo.
- en: The app shows its logo.

## Issue enlazado

Closes #85`;

describe('parseNovedad', () => {
  it('lee una línea por idioma y se detiene en la sección siguiente', () => {
    expect(parseNovedad(body)).toEqual({
      es: 'La aplicación muestra su logo.',
      pt: 'O aplicativo mostra seu logo.',
      en: 'The app shows its logo.',
    });
  });

  it('acepta CRLF, asteriscos y la sección al final del cuerpo', () => {
    expect(parseNovedad('## Novedad\r\n* ES: Hola\r\n* en: Hi')).toEqual({ es: 'Hola', en: 'Hi' });
  });

  it('ignora el ejemplo dentro de un comentario HTML', () => {
    expect(parseNovedad('## Novedad\n<!--\n- es: ejemplo\n-->\n- es: real')).toEqual({ es: 'real' });
  });

  it('devuelve null si no hay sección y no confunde ### con ##', () => {
    expect(parseNovedad('## Resumen\n### Novedad\n- es: no')).toBeNull();
  });

  it('ignora las líneas dentro de un bloque de código', () => {
    expect(parseNovedad('## Novedad\n```\n- es: ejemplo de código\n```\n- es: real')).toEqual({ es: 'real' });
  });

  it('reconoce el encabezado al final del cuerpo, sin salto de línea', () => {
    expect(parseNovedad('Texto\n\n## Novedad')).toEqual({});
  });

  it('la plantilla vacía no aporta texto', () => {
    expect(parseNovedad('## Novedad\n\n- es:\n- pt:\n- en:\n')).toEqual({});
  });
});

describe('toEntry', () => {
  it('usa el texto de cada idioma y la fecha del merge', () => {
    expect(toEntry(pr({ body }))).toMatchObject({
      number: 97,
      date: '2026-10-07',
      translated: true,
      text: { es: 'La aplicación muestra su logo.', pt: 'O aplicativo mostra seu logo.', en: 'The app shows its logo.' },
    });
  });

  it('sin sección usa el título en los tres idiomas, sin el (#N) del squash', () => {
    expect(toEntry(pr({ title: 'Favicon y logo (#97)' })).text).toEqual({
      es: 'Favicon y logo',
      pt: 'Favicon y logo',
      en: 'Favicon y logo',
    });
  });

  it('si falta un idioma usa el español', () => {
    expect(toEntry(pr({ body: '## Novedad\n- es: Hola' })).text.pt).toBe('Hola');
  });

  it('omite los PR sin merge, los de dependencias y los marcados "ninguna"', () => {
    expect(toEntry(pr({ merged_at: null }))).toBeNull();
    expect(toEntry(pr({ user: { login: 'dependabot[bot]', type: 'Bot' } }))).toBeNull();
    expect(toEntry(pr({ labels: [{ name: 'dependencies' }] }))).toBeNull();
    expect(toEntry(pr({ body: '## Novedad\n- es: ninguna\n- pt: nenhuma\n- en: none' }))).toBeNull();
  });

  it('recorta un texto demasiado largo, también cuando sale del título', () => {
    expect(toEntry(pr({ body: `## Novedad\n- es: ${'a'.repeat(400)}` })).text.es).toHaveLength(280);
    expect(toEntry(pr({ title: 'b'.repeat(400) })).text.en).toHaveLength(280);
  });

  it('arma la URL del PR con su número y nunca usa la que trae la API', () => {
    const entry = toEntry(pr({ html_url: 'javascript:alert(1)' }));
    expect(entry.url).toBe('https://github.com/MarAntBQ/CallingSupportApp/pull/97');
    expect(toEntry(pr({ number: '97"><script>' }))).toBeNull();
  });

  it('la etiqueta de dependencias no distingue mayúsculas', () => {
    expect(toEntry(pr({ labels: [{ name: 'Dependencies' }] }))).toBeNull();
    expect(toEntry(pr({ user: { login: 'renovate[bot]', type: 'User' } }))).toBeNull();
  });
});

describe('prNumberFromUrl', () => {
  it('saca el número aunque la URL tenga barra final o espacios', () => {
    expect(prNumberFromUrl(' https://github.com/MarAntBQ/CallingSupportApp/pull/46/ ')).toBe(46);
    expect(prNumberFromUrl('https://example.com')).toBeNull();
  });
});

describe('fetchMergedEntries', () => {
  const ok = (data) => ({ ok: true, json: async () => data });

  it('pagina hasta la última página y ordena del más reciente al más antiguo', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => pr({ number: i + 1, merged_at: `2026-10-0${(i % 7) + 1}T00:00:00Z` }));
    const page2 = [pr({ number: 200, merged_at: '2026-10-09T00:00:00Z' })];
    const urls = [];
    const entries = await fetchMergedEntries({
      api: 'https://api.test',
      fetchImpl: async (url) => {
        urls.push(url);
        return ok(url.includes('page=1&') || url.endsWith('page=1') ? page1 : page2);
      },
    });
    expect(urls).toHaveLength(2);
    expect(entries).toHaveLength(101);
    expect(entries[0].number).toBe(200);
  });

  it('sigue más allá de 10 páginas hasta una incompleta', async () => {
    let calls = 0;
    const full = Array.from({ length: 100 }, (_, i) => pr({ number: i + 1 }));
    const entries = await fetchMergedEntries({
      api: 'https://api.test',
      fetchImpl: async () => ok(++calls <= 12 ? full : [pr({ number: 5000 })]),
    });
    expect(calls).toBe(13);
    expect(entries).toHaveLength(1201);
  });

  it('lanza si GitHub responde con error, para que el build use solo las manuales', async () => {
    await expect(fetchMergedEntries({ api: 'https://api.test', fetchImpl: async () => ({ ok: false, status: 403 }) })).rejects.toThrow('403');
  });
});
