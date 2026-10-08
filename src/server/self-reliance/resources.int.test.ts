import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { asc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resourceSchema } from '@/lib/validation/self-reliance';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { createResource } from './resources';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

type RoleKey = 'super_admin' | 'leader' | 'member';
type Grant = Partial<Record<'canRead' | 'canCreate' | 'canUpdate' | 'canDelete', boolean>>;

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function resourceInput(over: Record<string, unknown> = {}) {
  return {
    title: 'Curso de prueba',
    description: 'Un recurso inventado para las pruebas.',
    url: 'https://example.com/curso',
    category: 'courses',
    locale: 'es',
    published: true,
    ...over,
  };
}

describe.skipIf(!url)('recursos de Autosuficiencia contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let seeded: { title: string; url: string; category: string; locale: string; position: number }[] = [];
  let routes: {
    list: typeof import('@/app/api/self-reliance/resources/route');
    byId: typeof import('@/app/api/self-reliance/resources/[id]/route');
    reorder: typeof import('@/app/api/self-reliance/resources/reorder/route');
    publicList: typeof import('@/app/api/public/self-reliance/resources/route');
  };

  async function createUser(email: string, role: RoleKey) {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100, status: 'active' })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  async function adminCookie() {
    return cookieFor((await createUser('admin@example.com', 'super_admin')).id);
  }

  async function leaderCookie(grant: Grant) {
    const user = await createUser(`lider-${randomBytes(3).toString('hex')}@example.com`, 'leader');
    const [organization] = await db.insert(schema.organizations).values({ name: `Org ${randomBytes(4).toString('hex')}` }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: organization!.id, name: 'Especialista de autosuficiencia' }).returning();
    await db.insert(schema.userCallings).values({ userId: user.id, callingId: calling!.id });
    await db.insert(schema.modulePermissions).values({ module: 'self-reliance', callingId: calling!.id, ...grant });
    return cookieFor(user.id);
  }

  const list = (cookie: string) => routes.list.GET(request('GET', '/api/self-reliance/resources', undefined, cookie));
  const create = (body: unknown, cookie: string) => routes.list.POST(request('POST', '/api/self-reliance/resources', body, cookie));
  const update = (id: string, body: unknown, cookie: string) =>
    routes.byId.PATCH(request('PATCH', `/api/self-reliance/resources/${id}`, body, cookie), { params: Promise.resolve({ id }) });
  const remove = (id: string, cookie: string) =>
    routes.byId.DELETE(request('DELETE', `/api/self-reliance/resources/${id}`, undefined, cookie), { params: Promise.resolve({ id }) });
  const reorder = (ids: string[], cookie: string) => routes.reorder.POST(request('POST', '/api/self-reliance/resources/reorder', { ids }, cookie));

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "test": esta prueba la vacía.');
    }
    process.env.DATABASE_URL = url;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    await admin.end();
    pool = new Pool({ connectionString: url, max: 1 });
    db = drizzle(pool, { schema });
    // La semilla se lee antes de que cada prueba vacíe la tabla.
    seeded = await db
      .select({
        title: schema.selfRelianceResources.title,
        url: schema.selfRelianceResources.url,
        category: schema.selfRelianceResources.category,
        locale: schema.selfRelianceResources.locale,
        position: schema.selfRelianceResources.position,
      })
      .from(schema.selfRelianceResources)
      .orderBy(asc(schema.selfRelianceResources.position));
    routes = {
      list: await import('@/app/api/self-reliance/resources/route'),
      byId: await import('@/app/api/self-reliance/resources/[id]/route'),
      reorder: await import('@/app/api/self-reliance/resources/reorder/route'),
      publicList: await import('@/app/api/public/self-reliance/resources/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(
      sql`truncate table self_reliance_resources, rate_limits, module_permissions, user_callings, callings, organizations, sessions, users restart identity cascade`,
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('la migración siembra los 8 recursos oficiales en todos los idiomas, en orden', () => {
    expect(seeded).toHaveLength(8);
    expect(seeded.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seeded.every((row) => row.locale === 'all' && row.url.startsWith('https://'))).toBe(true);
    expect(seeded.find((row) => row.category === 'languages')).toMatchObject({ title: 'EnglishConnect', url: 'https://englishconnect.org' });
  });

  it('crear un recurso lo deja al final, calcula "official" por dominio y no expone quién lo creó', async () => {
    const cookie = await adminCookie();
    const first = await create(resourceInput(), cookie);
    expect(first.status).toBe(201);
    const second = await create(resourceInput({ title: 'Cursos', url: 'https://www.churchofjesuschrist.org/life/self-reliance/courses' }), cookie);
    const [a, b] = [await first.json(), await second.json()];
    expect(a).toMatchObject({ position: 1, official: false, description: 'Un recurso inventado para las pruebas.' });
    expect(b).toMatchObject({ position: 2, official: true });
    expect(a).not.toHaveProperty('createdBy');
    const [row] = await db.select({ createdBy: schema.selfRelianceResources.createdBy }).from(schema.selfRelianceResources).where(eq(schema.selfRelianceResources.id, a.id));
    expect(row!.createdBy).toBeTruthy();
  });

  it('un recurso con URL http:// se rechaza con 400', async () => {
    const response = await create(resourceInput({ url: 'http://example.com/curso' }), await adminCookie());
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual(['url']);
    expect(await db.select().from(schema.selfRelianceResources)).toHaveLength(0);
  });

  it('la base también rechaza una URL que no es https:// aunque alguien salte la validación', async () => {
    await expect(
      db.insert(schema.selfRelianceResources).values({ title: 'Directo', url: 'http://example.com', category: 'courses' }),
    ).rejects.toThrow();
  });

  it('PATCH edita y despublica; un id inexistente responde 404', async () => {
    const cookie = await adminCookie();
    const created = await (await create(resourceInput(), cookie)).json();
    const patched = await update(created.id, { published: false, title: 'Curso renombrado' }, cookie);
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ published: false, title: 'Curso renombrado', description: 'Un recurso inventado para las pruebas.' });
    expect((await update('00000000-0000-4000-8000-000000000000', { published: true }, cookie)).status).toBe(404);
    expect((await update(created.id, { url: 'http://example.com' }, cookie)).status).toBe(400);
  });

  it('DELETE elimina el recurso y un segundo DELETE responde 404', async () => {
    const cookie = await adminCookie();
    const created = await (await create(resourceInput(), cookie)).json();
    expect((await remove(created.id, cookie)).status).toBe(204);
    expect((await remove(created.id, cookie)).status).toBe(404);
  });

  it('reordenar fija las posiciones; una lista incompleta o vieja responde 409 sin cambiar nada', async () => {
    const cookie = await adminCookie();
    const ids: string[] = [];
    for (const title of ['Uno', 'Dos', 'Tres']) ids.push((await (await create(resourceInput({ title }), cookie)).json()).id);
    const response = await reorder([ids[2]!, ids[0]!, ids[1]!], cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).map((item: { title: string }) => item.title)).toEqual(['Tres', 'Uno', 'Dos']);
    const stale = await reorder([ids[1]!, ids[0]!], cookie);
    expect(stale.status).toBe(409);
    expect((await stale.json()).issues).toEqual([{ field: 'ids', code: 'stale' }]);
    const titles = (await (await list(cookie)).json()).map((item: { title: string }) => item.title);
    expect(titles).toEqual(['Tres', 'Uno', 'Dos']);
    expect((await reorder([ids[0]!, ids[0]!, ids[1]!], cookie)).status).toBe(400);
  });

  it('cada acción exige su permiso del módulo: leer, crear, editar, ordenar y eliminar', async () => {
    const admin = await adminCookie();
    const created = await (await create(resourceInput(), admin)).json();

    const reader = await leaderCookie({ canRead: true });
    expect((await list(reader)).status).toBe(200);
    expect((await create(resourceInput(), reader)).status).toBe(403);
    expect((await update(created.id, { published: false }, reader)).status).toBe(403);
    expect((await reorder([created.id], reader)).status).toBe(403);
    expect((await remove(created.id, reader)).status).toBe(403);

    const editor = await leaderCookie({ canRead: true, canCreate: true, canUpdate: true });
    expect((await create(resourceInput({ title: 'Del editor' }), editor)).status).toBe(201);
    expect((await update(created.id, { published: false }, editor)).status).toBe(200);
    expect((await remove(created.id, editor)).status).toBe(403);

    const deleter = await leaderCookie({ canDelete: true });
    expect((await remove(created.id, deleter)).status).toBe(204);

    const member = await cookieFor((await createUser('miembro@example.com', 'member')).id);
    expect((await list(member)).status).toBe(403);
    expect((await list('')).status).toBe(401);
  });

  async function publicList(query = '', cookie?: string) {
    const response = await routes.publicList.GET(request('GET', `/api/public/self-reliance/resources${query}`, undefined, cookie));
    return { status: response.status, body: await response.json() };
  }

  async function seedPortal() {
    const cookie = await adminCookie();
    for (const input of [
      resourceInput({ title: 'Curso en español', locale: 'es' }),
      resourceInput({ title: 'Curso oculto', published: false }),
      resourceInput({ title: 'Course in English', locale: 'en', url: 'https://example.com/en' }),
      resourceInput({ title: 'Empleo oficial', category: 'employment', locale: 'all', url: 'https://www.churchofjesuschrist.org/life/self-reliance/find-a-better-job' }),
    ]) {
      expect((await create(input, cookie)).status).toBe(201);
    }
  }

  it('el portal público muestra solo lo publicado, los oficiales primero, en el idioma pedido o en todos', async () => {
    await seedPortal();
    const { status, body } = await publicList('?locale=es');
    expect(status).toBe(200);
    expect(body.map((item: { title: string }) => item.title)).toEqual(['Empleo oficial', 'Curso en español']);
    expect(body[0]).toMatchObject({ official: true });
    expect(body[0]).not.toHaveProperty('position');
    expect(body[0]).not.toHaveProperty('createdBy');
    const english = await publicList('?locale=en');
    expect(english.body.map((item: { title: string }) => item.title)).toEqual(['Empleo oficial', 'Course in English']);
  });

  it('filtra por categoría y responde 400 con una categoría que no existe', async () => {
    await seedPortal();
    const { body } = await publicList('?locale=es&category=employment');
    expect(body.map((item: { title: string }) => item.title)).toEqual(['Empleo oficial']);
    expect((await publicList('?category=casino')).status).toBe(400);
  });

  it('los enlaces a churchofjesuschrist.org llevan el lang del idioma (pt → lang=por), también desde la cookie', async () => {
    await seedPortal();
    const pt = await publicList('?locale=pt');
    expect(pt.body.find((item: { official: boolean }) => item.official).url).toBe(
      'https://www.churchofjesuschrist.org/life/self-reliance/find-a-better-job?lang=por',
    );
    const fromCookie = await publicList('', 'csa_locale=en');
    expect(fromCookie.body.find((item: { official: boolean }) => item.official).url).toMatch(/\?lang=eng$/);
    expect(fromCookie.body.find((item: { official: boolean }) => !item.official).url).toBe('https://example.com/en');
  });

  it('el portal público tiene límite por IP (#28)', async () => {
    for (let i = 0; i < 120; i += 1) expect((await publicList()).status).toBe(200);
    const blocked = await publicList();
    expect(blocked.status).toBe(429);
  });

  it('dos altas a la vez no comparten posición', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const other = new Pool({ connectionString: url!, max: 1 });
    const db2 = drizzle(other, { schema });
    try {
      const input = resourceSchema.parse(resourceInput());
      const [a, b] = await Promise.all([createResource(db, input, admin.id), createResource(db2, input, admin.id)]);
      expect(new Set([a.position, b.position])).toEqual(new Set([1, 2]));
    } finally {
      await other.end();
    }
  });
});
