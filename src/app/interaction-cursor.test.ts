import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

function rule(cursor: string) {
  const match = css.match(new RegExp(String.raw`:where\(([^{]*)\)\s*\{\s*cursor:\s*${cursor};\s*\}`));
  return match
    ? {
        selectors: match[1]!.split(/,(?![^(]*\))/).map((s) => s.replace(/\s+/g, ' ').trim()),
        index: match.index!,
      }
    : null;
}

const INTERACTIVE = [
  'button',
  "[role='button']",
  'summary',
  'select',
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='file']",
  "input[type='submit']",
  "input[type='button']",
  "input[type='reset']",
  "label:has(> input[type='checkbox'])",
  "label:has(> input[type='radio'])",
];

describe('cursor de los elementos interactivos', () => {
  it('todo lo que se puede clickear muestra la mano', () => {
    const pointer = rule('pointer');
    expect(pointer, 'falta la regla :where(...) { cursor: pointer } en globals.css').not.toBeNull();
    expect(INTERACTIVE.filter((s) => !pointer!.selectors.includes(s))).toEqual([]);
  });

  it('lo deshabilitado muestra "no permitido" y gana sobre la mano', () => {
    const pointer = rule('pointer');
    const disabled = rule('not-allowed');
    expect(disabled, 'falta la regla :where(...) { cursor: not-allowed } en globals.css').not.toBeNull();
    expect(disabled!.selectors).toEqual(expect.arrayContaining([':disabled', "[aria-disabled='true']"]));
    expect(disabled!.index, 'la regla de deshabilitado tiene que ir después de la de pointer').toBeGreaterThan(pointer!.index);
  });

  it('las dos reglas viven en @layer base para que una utilidad de Tailwind pueda sobrescribirlas', () => {
    const base = css.indexOf('@layer base');
    expect(base).toBeGreaterThanOrEqual(0);
    expect(rule('pointer')!.index).toBeGreaterThan(base);
  });
});
