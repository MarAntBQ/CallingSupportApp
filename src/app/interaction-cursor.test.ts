import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

function rule(cursor: string) {
  const match = css.match(new RegExp(String.raw`:where\(([^{]*)\)\s*\{\s*cursor:\s*${cursor};\s*\}`));
  if (!match) throw new Error(`falta la regla :where(...) { cursor: ${cursor} } en globals.css`);
  return {
    selectors: match[1]!.split(/,(?![^(]*\))/).map((s) => s.replace(/\s+/g, ' ').trim()),
    index: match.index!,
  };
}

const INTERACTIVE = [
  'a[href]',
  'button',
  "[role='button']",
  'summary',
  'select',
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='file']",
  "input[type='color']",
  "input[type='range']",
  "input[type='submit']",
  "input[type='button']",
  "input[type='reset']",
  "label:has(> input[type='checkbox'])",
  "label:has(> input[type='radio'])",
];

const TEXT_ENTRY = ['input', 'textarea', 'label', "input[type='text']", "input[type='email']", "input[type='password']", "input[type='date']", "input[type='search']"];

describe('cursor de los elementos interactivos', () => {
  it('todo lo que se puede clickear muestra la mano', () => {
    expect(INTERACTIVE.filter((s) => !rule('pointer').selectors.includes(s))).toEqual([]);
  });

  it('los campos de texto no reciben la mano', () => {
    expect(rule('pointer').selectors.filter((s) => TEXT_ENTRY.includes(s))).toEqual([]);
  });

  it('lo deshabilitado muestra "no permitido" y gana sobre la mano', () => {
    const disabled = rule('not-allowed');
    expect(disabled.selectors).toEqual(expect.arrayContaining([':disabled', "[aria-disabled='true']"]));
    expect(disabled.index, 'la regla de deshabilitado tiene que ir después de la de pointer').toBeGreaterThan(rule('pointer').index);
  });

  it('las dos reglas viven en @layer base para que una utilidad de Tailwind pueda sobrescribirlas', () => {
    const base = css.indexOf('@layer base');
    expect(base).toBeGreaterThanOrEqual(0);
    expect(rule('pointer').index).toBeGreaterThan(base);
  });
});
