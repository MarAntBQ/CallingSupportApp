import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const read = (path: string) => readFileSync(path, 'utf8');
const rel = (path: string) => relative(ROOT, path);

export const HAND_WRITTEN_STATUS = /(?<![\p{L}\p{N}])(ya está|lo siguiente|hoy muestra|por portar|en reescritura)(?![\p{L}\p{N}])/iu;

export function findHandWrittenStatus(files: { path: string; text: string }[]) {
  return files.filter(({ text }) => HAND_WRITTEN_STATUS.test(text)).map(({ path }) => path);
}

export function findTablesWithoutControls(files: { path: string; text: string }[]) {
  return files.filter(({ text }) => /<table[\s>]/.test(text) && !/\bSortHeader\b/.test(text)).map(({ path }) => path);
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ALLOWED_TEST_DOMAINS = /@(example|ejemplo)\.com$/i;

export function findRealLookingEmails(files: { path: string; text: string }[]) {
  return files.flatMap(({ path, text }) =>
    [...text.matchAll(EMAIL)].map((match) => match[0]).filter((email) => !ALLOWED_TEST_DOMAINS.test(email)).map((email) => `${path}: ${email}`),
  );
}

const PREVIOUS_HANDBOOK_NUMBER = /38\.8\.24\.2/g;
const PREVIOUS_NUMBERING_NOTE = /numeración anterior|numeração anterior|previous Handbook numbering/i;

export function findOutdatedHandbookCitations(files: { path: string; text: string }[]) {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => (line.match(PREVIOUS_HANDBOOK_NUMBER) ?? []).length > (PREVIOUS_NUMBERING_NOTE.test(line) ? 1 : 0))
      .map(({ number }) => `${path}:${number}`),
  );
}

const asFiles = (paths: string[]) => paths.map((path) => ({ path: rel(path), text: read(path) }));

describe('reglas del repositorio que se verifican solas', () => {
  it('regla dura 12: el README y el sitio no tienen estado escrito a mano', () => {
    const files = asFiles([join(ROOT, 'README.md'), ...walk(join(ROOT, 'site/content')).filter((path) => path.endsWith('.md'))]);
    expect(findHandWrittenStatus(files)).toEqual([]);
  });

  it('toda <table> de src/ usa los controles de #7 (orden, búsqueda y paginación)', () => {
    const files = asFiles(walk(join(ROOT, 'src')).filter((path) => path.endsWith('.tsx') && !path.includes('/components/table/')));
    expect(findTablesWithoutControls(files)).toEqual([]);
  });

  it('las pruebas y las migraciones solo usan correos inventados (@example.com o @ejemplo.com)', () => {
    const files = asFiles([
      ...walk(join(ROOT, 'src')).filter((path) => /\.test\.tsx?$/.test(path) && !path.endsWith('repository-rules.test.ts')),
      ...walk(join(ROOT, 'drizzle')).filter((path) => path.endsWith('.sql')),
      ...walk(join(ROOT, 'src/app/dev')),
    ]);
    expect(findRealLookingEmails(files)).toEqual([]);
  });
});

describe('cron de la purga diaria en el VPS (#162)', () => {
  const cron = read(join(ROOT, 'deploy/app-daily.cron'));
  const lines = cron.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

  it('no lleva secretos: app-daily.sh lee CRON_SECRET del .env', () => {
    expect(cron).not.toMatch(/CRON_SECRET=|Bearer|[a-f0-9]{32,}/i);
  });

  it('cada línea llama app-daily.sh con una URL https y deja el log fuera de /tmp', () => {
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/ callingsupportapp \/home\/callingsupportapp\/[\w-]+\/deploy\/app-daily\.sh \/home\/callingsupportapp\/[\w-]+ https:\/\/[\w.-]+ >> /);
      expect(line).not.toMatch(/\/tmp\//);
    }
  });
});

describe('citas del Manual General', () => {
  it('los recursos en línea se citan como 38.8.21.2 (Manual vigente), no con la numeración anterior 38.8.24.2', () => {
    const files = asFiles([
      ...['AGENTS.md', 'DESIGN.md', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md'].map((name) => join(ROOT, name)),
      ...walk(join(ROOT, '.claude/skills')),
      ...walk(join(ROOT, 'messages')),
      ...walk(join(ROOT, 'site/content')),
      ...walk(join(ROOT, 'site/i18n')),
      ...walk(join(ROOT, 'src')).filter((path) => !path.endsWith('repository-rules.test.ts')),
    ].filter((path) => existsSync(path)));
    expect(findOutdatedHandbookCitations(files)).toEqual([]);
  });

  it('el detector marca la numeración anterior salvo en la aclaración', () => {
    expect(findOutdatedHandbookCitations([{ path: 'a.md', text: 'línea\n(Manual General 38.8.24.2)' }])).toEqual(['a.md:2']);
    expect(
      findOutdatedHandbookCitations([{ path: 'b.md', text: 'La página de pautas todavía cita la numeración anterior del Manual (38.8.24.2).' }]),
    ).toEqual([]);
    expect(
      findOutdatedHandbookCitations([
        { path: 'c.md', text: 'Ver Manual General 38.8.24.2. La página de pautas todavía cita la numeración anterior del Manual (38.8.24.2).' },
      ]),
    ).toEqual(['c.md:1']);
  });
});

describe('los detectores de las reglas pueden fallar', () => {
  it('detecta estado escrito a mano', () => {
    expect(findHandWrittenStatus([{ path: 'README.md', text: 'El módulo ya está listo.' }])).toEqual(['README.md']);
    expect(findHandWrittenStatus([{ path: 'a.md', text: 'Lo siguiente: Viaje al Templo.' }])).toEqual(['a.md']);
    expect(findHandWrittenStatus([{ path: 'b.md', text: 'Se instala en una hora.' }])).toEqual([]);
    expect(findHandWrittenStatus([{ path: 'c.md', text: 'Hoy muestra el avance.' }])).toEqual(['c.md']);
    expect(findHandWrittenStatus([{ path: 'd.md', text: 'Esta pieza ya estátil.' }])).toEqual([]);
  });

  it('detecta una tabla sin SortHeader', () => {
    expect(findTablesWithoutControls([{ path: 'x.tsx', text: '<table className="w-full">' }])).toEqual(['x.tsx']);
    expect(findTablesWithoutControls([{ path: 'y.tsx', text: '<table>\n<SortHeader table={t} />' }])).toEqual([]);
  });

  it('detecta un correo que no es de prueba', () => {
    expect(findRealLookingEmails([{ path: 'z.test.ts', text: "email: 'persona@gmail.com'" }])).toEqual(['z.test.ts: persona@gmail.com']);
    expect(findRealLookingEmails([{ path: 'w.test.ts', text: "'ANA@EXAMPLE.COM', 'juan@ejemplo.com'" }])).toEqual([]);
  });
});
