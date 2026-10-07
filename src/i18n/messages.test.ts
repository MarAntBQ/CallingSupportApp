import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkMessagesDir, compareKeys, formatProblems } from '../../scripts/i18n-check.mjs';
import { LOCALES } from './config';

const SCRIPT = fileURLToPath(new URL('../../scripts/i18n-check.mjs', import.meta.url));

function runCheck(dir?: string) {
  return spawnSync(process.execPath, dir ? [SCRIPT, dir] : [SCRIPT], { encoding: 'utf8' });
}

const fixture = mkdtempSync(join(tmpdir(), 'csa-i18n-'));
writeFileSync(join(fixture, 'es.json'), JSON.stringify({ home: { title: 'Inicio', subtitle: 'Hola' } }));
writeFileSync(join(fixture, 'pt.json'), JSON.stringify({ home: { title: 'Início' }, extra: 'Sobra' }));
writeFileSync(join(fixture, 'en.json'), JSON.stringify({ home: { title: 'Home', subtitle: 'Hi' } }));

afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe('mensajes de los tres idiomas', () => {
  it('existe un archivo por cada idioma soportado', () => {
    expect(checkMessagesDir().locales).toEqual([...LOCALES].sort());
  });

  it('pt.json y en.json tienen exactamente las claves de es.json', () => {
    expect(formatProblems(checkMessagesDir().problems)).toBe('');
  });

  it('npm run i18n:check pasa con los mensajes del repositorio', () => {
    const result = runCheck();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});

describe('i18n:check detecta claves que faltan o sobran', () => {
  it('compara claves anidadas', () => {
    expect(compareKeys({ a: { b: '1', c: '2' } }, { a: { b: '1' }, d: '3' })).toEqual({
      missing: ['a.c'],
      extra: ['d'],
    });
  });

  it('detecta cuando una clave cambia de forma entre idiomas', () => {
    expect(compareKeys({ a: { b: '1' } }, { a: '1' })).toEqual({ missing: ['a.b'], extra: ['a'] });
    expect(compareKeys({ a: '1' }, { a: { b: '1' } })).toEqual({ missing: ['a'], extra: ['a.b'] });
  });

  it('trata null, arreglos y números como valores, no como áreas', () => {
    expect(compareKeys({ a: null, b: ['x'], c: 1 }, { a: 'x', b: 'y', c: 'z' })).toEqual({
      missing: [],
      extra: [],
    });
    expect(compareKeys({ a: ['x'] }, {})).toEqual({ missing: ['a'], extra: [] });
  });

  it('un área vacía no exige claves', () => {
    expect(compareKeys({ a: {} }, {})).toEqual({ missing: [], extra: [] });
  });

  it('nombra la clave y el idioma en el mensaje', () => {
    const message = formatProblems(checkMessagesDir(fixture).problems);
    expect(message).toContain('pt.json: falta la clave "home.subtitle"');
    expect(message).toContain('pt.json: sobra la clave "extra"');
    expect(message).not.toContain('en.json');
  });

  it('el script termina con exit 1 y lista las claves', () => {
    const result = runCheck(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('home.subtitle');
    expect(result.stderr).toContain('extra');
  });
});
