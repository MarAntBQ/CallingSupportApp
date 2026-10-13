import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { campRegistrationSchema } from '@/lib/validation/camps';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { createPublicRegistration, getPersonalLink } from './registrations';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const youth = (fullName: string) => ({
  fullName,
  birthDate: '2011-05-01',
  gender: 'female',
  emergencyContactName: 'Tía Prueba',
  emergencyContactPhone: '0990000002',
});

describe.skipIf(!url)('lista de qué llevar del campamento contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    packing: typeof import('@/app/api/camps/[id]/packing/route');
    packingItem: typeof import('@/app/api/camps/[id]/packing/[itemId]/route');
    mePacking: typeof import('@/app/api/camps/me/[token]/packing/route');
  };

  async function createUser(email: string, role: 'super_admin' | 'leader' | 'member') {
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

  async function createCamp(over: Partial<typeof schema.camps.$inferInsert> = {}) {
    const [camp] = await db
      .insert(schema.camps)
      .values({ slug: 'campamento', name: 'Campamento de prueba', location: 'Bosque', startDate: day(40), endDate: day(42), registrationDeadline: day(30), open: true, ...over })
      .returning();
    return camp!;
  }

  async function registerYouth(slug: string, names: string[]) {
    const input = campRegistrationSchema.parse({
      guardian: { name: 'Mamá Prueba', phone: '0990000001', email: 'mama.prueba@example.com' },
      participants: names.map((name) => youth(name)),
      consent: true,
    });
    const result = await createPublicRegistration(db, slug, input, { ip: null, locale: 'es', policyVersion: '2026-10' }, 'America/Guayaquil');
    if (!result.ok) throw new Error('la inscripción debía pasar');
    return result.links;
  }

  const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });
  const listPacking = (campId: string, cookie: string) => routes.packing.GET(request('GET', `/api/camps/${campId}/packing`, undefined, cookie), ctx({ id: campId }));
  const addPacking = (campId: string, body: unknown, cookie: string) => routes.packing.POST(request('POST', `/api/camps/${campId}/packing`, body, cookie), ctx({ id: campId }));
  const delPacking = (campId: string, itemId: string, cookie: string) => routes.packingItem.DELETE(request('DELETE', `/api/camps/${campId}/packing/${itemId}`, undefined, cookie), ctx({ id: campId, itemId }));
  const togglePacking = (token: string, body: unknown) => routes.mePacking.POST(request('POST', `/api/camps/me/${token}/packing`, body), ctx({ token }));

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
    routes = {
      packing: await import('@/app/api/camps/[id]/packing/route'),
      packingItem: await import('@/app/api/camps/[id]/packing/[itemId]/route'),
      mePacking: await import('@/app/api/camps/me/[token]/packing/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table camps, email_log, module_permissions, user_callings, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('el admin agrega ítems y el enlace personal muestra solo los que aplican por tipo', async () => {
    const camp = await createCamp();
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await addPacking(camp.id, { name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all' }, cookie)).status).toBe(201);
    expect((await addPacking(camp.id, { name: 'Botiquín', category: 'Otros', appliesTo: 'leader' }, cookie)).status).toBe(201);
    expect(await (await listPacking(camp.id, cookie)).json()).toHaveLength(2);

    const [link] = await registerYouth('campamento', ['Joven Uno']);
    const view = (await getPersonalLink(db, link!.token))!;
    expect(view.packing.map((p) => p.name)).toEqual(['Saco de dormir']); // el de 'leader' no aplica al joven
    expect(view.packing[0]!.checked).toBe(false);
  });

  it('marcar un ítem desde el enlace personal persiste y es idempotente; desmarcar lo quita', async () => {
    const camp = await createCamp();
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const item = await (await addPacking(camp.id, { name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all' }, cookie)).json();
    const [link] = await registerYouth('campamento', ['Joven Uno']);

    expect((await togglePacking(link!.token, { itemId: item.id, checked: true })).status).toBe(200);
    expect((await getPersonalLink(db, link!.token))!.packing[0]!.checked).toBe(true);
    // marcar de nuevo no duplica ni falla
    expect((await togglePacking(link!.token, { itemId: item.id, checked: true })).status).toBe(200);
    expect((await getPersonalLink(db, link!.token))!.packing[0]!.checked).toBe(true);
    // desmarcar
    expect((await togglePacking(link!.token, { itemId: item.id, checked: false })).status).toBe(200);
    expect((await getPersonalLink(db, link!.token))!.packing[0]!.checked).toBe(false);
  });

  it('no se puede marcar un ítem que no aplica al tipo, de otro campamento, o con un token inexistente (404)', async () => {
    const camp = await createCamp();
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const leaderItem = await (await addPacking(camp.id, { name: 'Botiquín', category: 'Otros', appliesTo: 'leader' }, cookie)).json();
    const other = await createCamp({ slug: 'otro' });
    const otherItem = await (await addPacking(other.id, { name: 'Carpa', category: 'Otros', appliesTo: 'all' }, cookie)).json();
    const [link] = await registerYouth('campamento', ['Joven Uno']);

    expect((await togglePacking(link!.token, { itemId: leaderItem.id, checked: true })).status).toBe(404); // no aplica a youth
    expect((await togglePacking(link!.token, { itemId: otherItem.id, checked: true })).status).toBe(404); // otro campamento
    expect((await togglePacking('x'.repeat(43), { itemId: leaderItem.id, checked: true })).status).toBe(404); // token inexistente
  });

  it('borrar un ítem lo quita de la lista y del enlace personal (checks en cascada)', async () => {
    const camp = await createCamp();
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const item = await (await addPacking(camp.id, { name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all' }, cookie)).json();
    const [link] = await registerYouth('campamento', ['Joven Uno']);
    await togglePacking(link!.token, { itemId: item.id, checked: true });

    expect((await delPacking(camp.id, item.id, cookie)).status).toBe(200);
    expect(await (await listPacking(camp.id, cookie)).json()).toHaveLength(0);
    expect((await getPersonalLink(db, link!.token))!.packing).toHaveLength(0);
  });

  it('gestionar la lista exige el permiso de camps: un miembro sin permiso recibe 403', async () => {
    const camp = await createCamp();
    const memberCookie = await cookieFor((await createUser('miembro@example.com', 'member')).id);
    expect((await addPacking(camp.id, { name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all' }, memberCookie)).status).toBe(403);
    expect((await listPacking(camp.id, memberCookie)).status).toBe(403);
  });
});
