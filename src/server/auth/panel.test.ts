import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ADMIN = fileURLToPath(new URL('../../app/(admin)', import.meta.url));
// La única página que se ve sin la verificación obligatoria activa: donde se activa.
const MFA_SETUP_PAGE = join('admin', 'profile', 'security', 'page.tsx');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('páginas del panel y la verificación en dos pasos (#36)', () => {
  it('cada page.tsx del panel usa getPanelSession() y no getSession()', () => {
    const pages = walk(ADMIN).filter((file) => /[\\/]page\.tsx$/.test(file));
    expect(pages.length).toBeGreaterThan(5);
    const problems = pages
      .map((file) => ({ file: relative(ADMIN, file), source: readFileSync(file, 'utf8') }))
      .filter(({ file }) => file !== MFA_SETUP_PAGE)
      .filter(({ source }) => !source.includes('await getPanelSession()') || /\bgetSession\(/.test(source))
      .map(({ file }) => file);
    expect(problems).toEqual([]);
  });
});
