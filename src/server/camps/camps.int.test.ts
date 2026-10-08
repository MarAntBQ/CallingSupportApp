import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';

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

function campInput(over: Record<string, unknown> = {}) {
  return {
    name: 'Campamento de prueba',
    description: 'Un campamento inventado para las pruebas.',
    location: 'Bosque de prueba',
    startDate: '2026-12-10',
    endDate: '2026-12-12',
    registrationDeadline: '2026-12-01',
    feeYouth: 0,
    feeLeader: 0,
    feeAuthorized: false,
    quotaYouthMale: 0,
    quotaYouthFemale: 0,
    open: false,
    ...over,
  };
}

describe.skipIf(!url)('campamentos contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: { list: typeof import('@/app/api/camps/route'); byId: typeof import('@/app/api/camps/[id]/route') };

  async function createUser(email: string, role: RoleKey, firstName = 'Ana') {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName, lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100, status: 'active' })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  async function adminCookie() {
    return cookieFor((await createUser('admin@example.com', 'super_admin', 'Obispo')).id);
  }

  async function leaderCookie(grant: Grant) {
    const user = await createUser(`lider-${randomBytes(3).toString('hex')}@example.com`, 'leader');
    const [organization] = await db.insert(schema.organizations).values({ name: `Org ${randomBytes(4).toString('hex')}` }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: organization!.id, name: 'Presidenta de Mujeres Jóvenes' }).returning();
    await db.insert(schema.userCallings).values({ userId: user.id, callingId: calling!.id });
    await db.insert(schema.modulePermissions).values({ module: 'camps', callingId: calling!.id, ...grant });
    return cookieFor(user.id);
  }

  const list = (cookie: string) => routes.list.GET(request('GET', '/api/camps', undefined, cookie));
  const create = (body: unknown, cookie: string) => routes.list.POST(request('POST', '/api/camps', body, cookie));
  const update = (id: string, body: unknown, cookie: string) =>
    routes.byId.PATCH(request('PATCH', `/api/camps/${id}`, body, cookie), { params: Promise.resolve({ id }) });

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
    routes = { list: await import('@/app/api/camps/route'), byId: await import('@/app/api/camps/[id]/route') };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table camps, module_permissions, user_callings, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('crea un campamento con un slug legible; el mismo nombre recibe -2', async () => {
    const cookie = await adminCookie();
    const first = await create(campInput({ name: 'Campamento de Mujeres Jóvenes' }), cookie);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ slug: 'campamento-de-mujeres-jovenes', feeYouth: '0.00', youthCount: 0, pendingCount: 0 });
    const second = await create(campInput({ name: 'Campamento de Mujeres Jóvenes' }), cookie);
    expect((await second.json()).slug).toBe('campamento-de-mujeres-jovenes-2');
  });

  it('un aporte mayor que 0 sin la autorización del obispado responde 400 y no crea nada (20.6.2)', async () => {
    const cookie = await adminCookie();
    const response = await create(campInput({ feeYouth: 30 }), cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'feeAuthorized', code: 'fee_authorization_required' }]);
    expect(await db.select().from(schema.camps)).toHaveLength(0);
  });

  it('la base también rechaza un aporte sin autorización aunque alguien salte la validación', async () => {
    await expect(
      db.insert(schema.camps).values({ slug: 'directo', name: 'Directo', location: 'Lugar', startDate: '2026-12-10', endDate: '2026-12-12', registrationDeadline: '2026-12-01', feeYouth: '30.00' }),
    ).rejects.toThrow();
  });

  it('con la autorización registra quién y cuándo; cambiar montos no la renueva y desmarcarla la borra', async () => {
    const cookie = await adminCookie();
    const created = await (await create(campInput({ feeYouth: 30, feeAuthorized: true, donationCategoryName: 'Campamento' }), cookie)).json();
    expect(created).toMatchObject({ feeYouth: '30.00', feeAuthorized: true, feeAuthorizedByName: 'Obispo Prueba' });
    expect(created.feeAuthorizedAt).toBeTruthy();
    expect(created).not.toHaveProperty('feeAuthorizedBy');

    const same = await (await update(created.id, campInput({ feeYouth: 30, feeAuthorized: true, name: 'Renombrado' }), cookie)).json();
    expect(same.feeAuthorizedAt).toBe(created.feeAuthorizedAt);

    // Otro organizador cambia el monto: queda registrado él, con la fecha nueva.
    const other = await leaderCookie({ canUpdate: true });
    const changed = await (await update(created.id, campInput({ feeYouth: 25, feeAuthorized: true }), other)).json();
    expect(changed.feeAuthorizedByName).toBe('Ana Prueba');
    expect(new Date(changed.feeAuthorizedAt).getTime()).toBeGreaterThan(new Date(created.feeAuthorizedAt).getTime());

    const cleared = await (await update(created.id, campInput({ feeYouth: 0, feeAuthorized: false }), cookie)).json();
    expect(cleared).toMatchObject({ feeAuthorized: false, feeAuthorizedAt: null, feeAuthorizedByName: null });
  });

  it('la base exige la fecha de la autorización y no guarda autor sin autorización', async () => {
    const user = await createUser('obispo@example.com', 'super_admin');
    const base = { name: 'Directo', location: 'Lugar', startDate: '2026-12-10', endDate: '2026-12-12', registrationDeadline: '2026-12-01' };
    await expect(db.insert(schema.camps).values({ ...base, slug: 'sin-fecha', feeAuthorized: true })).rejects.toThrow();
    await expect(db.insert(schema.camps).values({ ...base, slug: 'fecha-sin-marca', feeAuthorizedAt: new Date() })).rejects.toThrow();
    await expect(db.insert(schema.camps).values({ ...base, slug: 'autor-sin-marca', feeAuthorizedBy: user.id })).rejects.toThrow();
    await db.insert(schema.camps).values({ ...base, slug: 'completa', feeAuthorized: true, feeAuthorizedAt: new Date(), feeAuthorizedBy: user.id, feeYouth: '30.00' });
    // Borrar a quien autorizó deja el autor en nulo, sin romper el check.
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
    const [camp] = await db.select({ by: schema.camps.feeAuthorizedBy, at: schema.camps.feeAuthorizedAt }).from(schema.camps);
    expect(camp).toMatchObject({ by: null });
    expect(camp!.at).toBeTruthy();
  });

  it('valida las fechas: fin antes de inicio y fecha límite después del fin responden 400', async () => {
    const cookie = await adminCookie();
    const backwards = await create(campInput({ startDate: '2026-12-12', endDate: '2026-12-10' }), cookie);
    expect((await backwards.json()).issues).toEqual([{ field: 'endDate', code: 'end_before_start' }]);
    const late = await create(campInput({ registrationDeadline: '2026-12-20' }), cookie);
    expect((await late.json()).issues).toEqual([{ field: 'registrationDeadline', code: 'deadline_after_end' }]);
  });

  it('renombrar no cambia el slug; PATCH a un id inexistente responde 404', async () => {
    const cookie = await adminCookie();
    const created = await (await create(campInput(), cookie)).json();
    const renamed = await (await update(created.id, campInput({ name: 'Otro nombre' }), cookie)).json();
    expect(renamed).toMatchObject({ name: 'Otro nombre', slug: created.slug });
    expect((await update('00000000-0000-4000-8000-000000000000', campInput(), cookie)).status).toBe(404);
  });

  it('cada acción exige su permiso del módulo', async () => {
    const admin = await adminCookie();
    const created = await (await create(campInput(), admin)).json();
    const reader = await leaderCookie({ canRead: true });
    expect((await list(reader)).status).toBe(200);
    expect((await create(campInput(), reader)).status).toBe(403);
    expect((await update(created.id, campInput(), reader)).status).toBe(403);
    const editor = await leaderCookie({ canUpdate: true });
    expect((await update(created.id, campInput({ open: true }), editor)).status).toBe(200);
    const member = await cookieFor((await createUser('miembro@example.com', 'member')).id);
    expect((await list(member)).status).toBe(403);
    expect((await list('')).status).toBe(401);
  });

  it('la lista cuenta jóvenes, líderes, aprobados y pendientes sin devolver datos de personas', async () => {
    const cookie = await adminCookie();
    const created = await (await create(campInput(), cookie)).json();
    const [registration] = await db.insert(schema.campRegistrations).values({ campId: created.id, consent: true, policyVersion: '2026-10' }).returning();
    const youth = { registrationId: registration!.id, birthDate: '2011-05-01', emergencyContactName: 'Mamá Prueba', emergencyContactPhone: '0990000000' };
    await db.insert(schema.campParticipants).values([
      { ...youth, type: 'youth', fullName: 'Joven Uno', gender: 'female', approved: true, accessTokenHash: 'a'.repeat(64) },
      { ...youth, type: 'youth', fullName: 'Joven Dos', gender: 'male', accessTokenHash: 'b'.repeat(64) },
      { registrationId: registration!.id, type: 'leader', fullName: 'Líder Uno', gender: 'female', approved: true, accessTokenHash: 'c'.repeat(64) },
    ]);
    const [camp] = await (await list(cookie)).json();
    expect(camp).toMatchObject({ youthCount: 2, leaderCount: 1, approvedCount: 2, pendingCount: 1 });
    expect(JSON.stringify(camp)).not.toMatch(/Joven|Mamá|0990000000/);
  });

  it('un joven sin contacto de emergencia o sin fecha de nacimiento no entra a la base', async () => {
    const cookie = await adminCookie();
    const created = await (await create(campInput(), cookie)).json();
    const [registration] = await db.insert(schema.campRegistrations).values({ campId: created.id, consent: true, policyVersion: '2026-10' }).returning();
    const base = { registrationId: registration!.id, type: 'youth', fullName: 'Joven Prueba', gender: 'male' };
    await expect(db.insert(schema.campParticipants).values({ ...base, birthDate: '2011-05-01', accessTokenHash: 'd'.repeat(64) })).rejects.toThrow();
    await expect(
      db.insert(schema.campParticipants).values({ ...base, emergencyContactName: 'Papá', emergencyContactPhone: '0990000001', accessTokenHash: 'e'.repeat(64) }),
    ).rejects.toThrow();
  });

  it('ninguna tabla del módulo tiene columnas de datos médicos ni de pagos (20.7.4 y capítulo 34)', async () => {
    const result = await db.execute(sql`select table_name, column_name from information_schema.columns where table_name like 'camp%'`);
    const columns = (result.rows as { table_name: string; column_name: string }[]).map((row) => `${row.table_name}.${row.column_name}`);
    expect(columns.length).toBeGreaterThan(20);
    expect(columns.filter((column) => /medic|allerg|alerg|diagnos|condition|paid|payment|balance|saldo|abono/i.test(column))).toEqual([]);
  });
});
