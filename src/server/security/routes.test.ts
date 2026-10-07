import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findUnprotectedActions, findUnprotectedRoutes } from './enforcement';

const APP = fileURLToPath(new URL('../../app', import.meta.url));
const SRC = fileURLToPath(new URL('../..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('toda ruta y Server Action declara cómo se protege', () => {
  it('cada método exportado de un route.ts usa withAuth o publicRoute', () => {
    const files = walk(APP).filter((file) => /[\\/]route\.(?:ts|tsx|js|jsx|mjs)$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    const problems = files.flatMap((file) =>
      findUnprotectedRoutes(readFileSync(file, 'utf8')).map((method) => `${relative(SRC, file)}: ${method}`),
    );
    expect(problems).toEqual([]);
  });

  it('cada acción exportada de un archivo "use server" usa authedAction', () => {
    const files = walk(SRC).filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file) && !/\.test\.tsx?$/.test(file));
    const problems = files.flatMap((file) =>
      findUnprotectedActions(readFileSync(file, 'utf8')).map((name) => `${relative(SRC, file)}: ${name}`),
    );
    expect(problems).toEqual([]);
  });
});

describe('detector de rutas sin proteger', () => {
  it('marca funciones exportadas y constantes sin envoltorio', () => {
    const source = `
      export async function GET() { return new Response('abierta'); }
      export function DELETE() {}
      export const POST = async () => new Response('abierta');
      export const PUT = withAuth(async () => new Response('ok'));
      export const PATCH = publicRoute(async () => new Response('ok'), { reason: 'prueba' });
      export let HEAD = async () => new Response();
      export var OPTIONS = handler;
      export const dynamic = 'force-dynamic';
    `;
    expect(findUnprotectedRoutes(source)).toEqual(['GET', 'DELETE', 'POST', 'HEAD', 'OPTIONS']);
  });

  it('acepta el envoltorio con tipo genérico y sigue marcando lo que no lo usa', () => {
    const source = `
      export const PATCH = withAuth<{ id: string }>(async () => new Response('ok'), { permission: 'global-admin' });
      export const PUT = handler<{ id: string }>(async () => new Response('abierta'));
      export const DELETE = <T,>() => new Response('abierta');
    `;
    expect(findUnprotectedRoutes(source)).toEqual(['PUT', 'DELETE']);
  });

  it('marca las re-exportaciones de métodos, que esconden el envoltorio', () => {
    expect(findUnprotectedRoutes(`export { handler as GET, other as POST } from './x';`)).toEqual(['GET', 'POST']);
  });

  it('marca acciones de "use server" sin authedAction', () => {
    const source = `'use server';
      export async function borrar() {}
      export const guardar = async () => {};
      export const cambiar = authedAction(schema, {}, async () => {});
    `;
    expect(findUnprotectedActions(source)).toEqual(['borrar', 'guardar']);
    expect(findUnprotectedActions(`export async function noEsAccion() {}`)).toEqual([]);
  });
});
