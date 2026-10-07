import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const GLOBALS = fileURLToPath(new URL('./globals.css', import.meta.url));

function readTokens(css: string) {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name!] = value!.toLowerCase();
  }
  return tokens;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

const tokens = readTokens(readFileSync(GLOBALS, 'utf8'));

const TEXT_TOKENS = [
  'text',
  'text-muted',
  'primary',
  'primary-strong',
  'secondary-strong',
  'tertiary-strong',
  'success-strong',
  'warning-strong',
  'danger-strong',
];
const BACKGROUNDS = ['surface', 'bg', 'surface-muted'];
const FILL_TOKENS = ['secondary', 'tertiary', 'success', 'warning', 'danger', 'info'];
const AA = 4.5;

describe('tokens de diseño', () => {
  it('define todos los tokens de DESIGN.md y ninguno de la paleta anterior', () => {
    for (const name of [...TEXT_TOKENS, ...BACKGROUNDS, ...FILL_TOKENS, 'on-primary', 'border', 'border-strong']) {
      expect(tokens, `falta --color-${name}`).toHaveProperty(name);
    }
    expect(Object.keys(tokens).filter((name) => /^(brown|sage)/.test(name))).toEqual([]);
  });

  it('todo token de texto cumple WCAG AA (4.5:1) sobre cada fondo', () => {
    const failures = TEXT_TOKENS.flatMap((text) =>
      BACKGROUNDS.map((bg) => ({ pair: `${text} sobre ${bg}`, ratio: contrast(tokens[text]!, tokens[bg]!) })),
    )
      .filter(({ ratio }) => ratio < AA)
      .map(({ pair, ratio }) => `${pair}: ${ratio.toFixed(2)}:1`);
    expect(failures).toEqual([]);
  });

  it('el texto sobre los botones principales cumple WCAG AA', () => {
    expect(contrast(tokens['on-primary']!, tokens.primary!)).toBeGreaterThanOrEqual(AA);
    expect(contrast(tokens['on-primary']!, tokens['primary-strong']!)).toBeGreaterThanOrEqual(AA);
  });

  it('calcula el contraste como WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#a8a29e', '#ffffff')).toBeLessThan(AA);
  });

  it('ningún archivo de src/ escribe colores fuera de globals.css', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== GLOBALS)
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${relative(SRC, file)}:${i + 1}` }))
          .filter(({ line }) => /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|\b(?:rgb|hsl)a?\(/.test(line))
          .map(({ at, line }) => `${at}  ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
