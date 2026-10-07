import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { templeTripSchema } from '@/lib/validation/temple-trips';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { createTempleTrip } from '@/server/temple-trips/trips';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

type RoleKey = 'super_admin' | 'leader' | 'member';

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function tripInput(over: Record<string, unknown> = {}) {
  return {
    date: '2026-12-20',
    registrationDeadline: '2026-12-01',
    dateConfirmed: true,
    includesTransport: false,
    includesLodging: false,
    includesBreakfast: false,
    includesLunch: false,
    quotaTransport: 0,
    quotaLodging: 0,
    costTransport: 0,
    costBreakfast: 0,
    costLunch: 0,
    quotaBaptismMale: 0,
    quotaBaptismFemale: 0,
    quotaInitiatoryMale: 0,
    quotaInitiatoryFemale: 0,
    quotaEndowmentMale: 0,
    quotaEndowmentFemale: 0,
    quotaSealingMale: 0,
    quotaSealingFemale: 0,
    templeName: 'Templo de Guayaquil Ecuador',
    inAssignedDistrict: true,
    scheduledWithTemple: false,
    active: false,
    ...over,
  };
}

describe.skipIf(!url)('viajes al templo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    trips: typeof import('@/app/api/temple-trips/route');
    tripById: typeof import('@/app/api/temple-trips/[id]/route');
  };

  async function createUser(email: string, role: RoleKey) {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, status: 'active' })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  function post(body: unknown, cookie: string) {
    return routes.trips.POST(request('POST', '/api/temple-trips', body, cookie));
  }

  function patch(id: string, body: unknown, cookie: string) {
    return routes.tripById.PATCH(request('PATCH', `/api/temple-trips/${id}`, body, cookie), {
      params: Promise.resolve({ id }),
    });
  }

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
      trips: await import('@/app/api/temple-trips/route'),
      tripById: await import('@/app/api/temple-trips/[id]/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table temple_trips, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('un viaje recién creado aparece en el panel sin inscripciones', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await post(tripInput(), cookie)).status).toBe(201);
    const list = await (await routes.trips.GET(request('GET', '/api/temple-trips', undefined, cookie))).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ templeName: 'Templo de Guayaquil Ecuador', registeredCount: 0, approvedCount: 0, pendingCount: 0 });
  });

  it('activar sin programar con el templo responde 400 con la cita del 25.1.2', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const response = await post(tripInput({ active: true, scheduledWithTemple: false }), cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'scheduledWithTemple', code: 'schedule_with_temple_required' }]);
  });

  it('activar un viaje desactiva el que estaba activo', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await post(tripInput({ active: true, scheduledWithTemple: true, templeName: 'Templo A' }), cookie)).status).toBe(201);
    expect((await post(tripInput({ active: true, scheduledWithTemple: true, templeName: 'Templo B' }), cookie)).status).toBe(201);
    const active = await db.select({ name: schema.templeTrips.templeName }).from(schema.templeTrips).where(eq(schema.templeTrips.active, true));
    expect(active).toEqual([{ name: 'Templo B' }]);
  });

  it('una fecha límite posterior a la fecha del viaje se rechaza con 400', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const response = await post(tripInput({ date: '2026-12-01', registrationDeadline: '2026-12-20' }), cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'registrationDeadline', code: 'deadline_after_date' }]);
  });

  it('sin el permiso de crear, POST responde 403', async () => {
    const cookie = await cookieFor((await createUser('lider@example.com', 'leader')).id);
    expect((await post(tripInput(), cookie)).status).toBe(403);
  });

  it('los costos se guardan con 2 decimales exactos (0.1 + 0.2)', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await post(tripInput({ includesTransport: true, costTransport: 0.1 + 0.2 }), cookie)).status).toBe(201);
    const [trip] = await db.select({ cost: schema.templeTrips.costTransport }).from(schema.templeTrips);
    expect(trip!.cost).toBe('0.30');
  });

  it('PATCH a un viaje inexistente responde 404', async () => {
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await patch('00000000-0000-4000-8000-000000000000', tripInput(), cookie)).status).toBe(404);
  });

  it('dos viajes activos creados a la vez se serializan: queda uno solo activo, sin error', async () => {
    const other = new Pool({ connectionString: url!, max: 1 });
    const db2 = drizzle(other, { schema });
    try {
      const [a, b] = await Promise.all([
        createTempleTrip(db, templeTripSchema.parse(tripInput({ active: true, scheduledWithTemple: true, templeName: 'Templo A' }))),
        createTempleTrip(db2, templeTripSchema.parse(tripInput({ active: true, scheduledWithTemple: true, templeName: 'Templo B' }))),
      ]);
      expect(a.id).toBeTruthy();
      expect(b.id).toBeTruthy();
      const active = await db.select({ name: schema.templeTrips.templeName }).from(schema.templeTrips).where(eq(schema.templeTrips.active, true));
      expect(active).toHaveLength(1);
    } finally {
      await other.end();
    }
  });
});
