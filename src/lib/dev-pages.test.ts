import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEV_PAGE_EXTENSION, pageExtensionsFor } from './dev-pages';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe('páginas solo de desarrollo', () => {
  it('se compilan en desarrollo y en las previews de Vercel', () => {
    expect(pageExtensionsFor({ NODE_ENV: 'development' })).toContain(DEV_PAGE_EXTENSION);
    expect(pageExtensionsFor({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toContain(DEV_PAGE_EXTENSION);
  });

  it('no se compilan en producción ni en el staging', () => {
    expect(pageExtensionsFor({ NODE_ENV: 'production' })).not.toContain(DEV_PAGE_EXTENSION);
    expect(pageExtensionsFor({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).not.toContain(DEV_PAGE_EXTENSION);
  });

  it('todo lo que vive en src/app/dev es una página .dev.tsx o un archivo que solo ella importa', () => {
    const devDir = join(APP_DIR, 'dev');
    const routeFiles = files(devDir)
      .map((file) => relative(devDir, file))
      .filter((file) => /(^|\/)(page|route|layout|loading|error|not-found|template|default)\.(tsx?|jsx?)$/.test(file));
    expect(routeFiles).toEqual([]);
  });
});
