import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import { getDashboard } from '@/server/dashboard/dashboard';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

function request(method: string, path: string, cookie?: string) {
  return new Request(`http://localhost${path}`, { method, headers: { Origin: 'http://localhost', ...(cookie ? { cookie } : {}) } });
}

describe.skipIf(!url)('dashboard del SuperAdmin contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let route: typeof import('@/app/api/dashboard/route');

  async function createUser(email: string, role: string, status: 'pending' | 'active' | 'suspended') {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, status })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  async function addParticipant(tripId: string, over: Record<string, unknown>) {
    const [reg] = await db.insert(schema.templeRegistrations).values({ tripId, consent: true, policyVersion: '2026-10', locale: 'es' }).returning();
    await db
      .insert(schema.templeParticipants)
      .values({ registrationId: reg!.id, idNumber: randomBytes(5).toString('hex'), birthDate: '1990-01-01', fullName: 'Persona', phone: '+593999999999', email: 'p@example.com', gender: 'male', ...over });
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) throw new Error('TEST_DATABASE_URL debe contener "test"');
    process.env.DATABASE_URL = url;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    await admin.end();
    pool = new Pool({ connectionString: url, max: 2 });
    db = drizzle(pool, { schema });
    route = await import('@/app/api/dashboard/route');
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table temple_participants, temple_registrations, temple_trips, user_callings, module_permissions, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('los números coinciden con usuarios y reportes, y el costo cuenta solo aprobados del viaje activo', async () => {
    await createUser('super@example.com', 'super_admin', 'active');
    await createUser('lider1@example.com', 'leader', 'active');
    await createUser('lider2@example.com', 'leader', 'pending');
    await createUser('miembro@example.com', 'member', 'active');
    const [trip] = await db
      .insert(schema.templeTrips)
      .values({ date: '2026-12-20', registrationDeadline: '2026-12-01', templeName: 'Templo', scheduledWithTemple: true, active: true, includesTransport: true, quotaTransport: 10, costTransport: '5.00' })
      .returning();
    await db.insert(schema.templeTrips).values({ date: '2026-06-01', registrationDeadline: '2026-05-01', templeName: 'Viejo', active: false });
    await addParticipant(trip!.id, { approved: true, wantsTransport: true, priceTransport: '5.00', totalCost: '5.00' });
    await addParticipant(trip!.id, { approved: true, wantsTransport: true, priceTransport: '5.00', totalCost: '5.00' });
    await addParticipant(trip!.id, { approved: false, wantsTransport: true, priceTransport: '5.00', totalCost: '5.00' });

    const data = await getDashboard(db);
    expect(data.users.total).toBe(4);
    expect(data.users.active).toBe(3);
    expect(data.users.pending).toBe(1);
    expect(Object.fromEntries(data.users.byRole.map((r) => [r.role, r.count]))).toMatchObject({ super_admin: 1, leader: 2, member: 1 });
    expect(data.trips.total).toBe(2);
    expect(data.trips.active?.id).toBe(trip!.id);
    expect(data.participantsPendingApproval).toBe(1);
    // solo los 2 aprobados × 5.00; el pendiente no cuenta
    expect(data.estimatedCost).toBe(10);
  });

  it('sin viaje activo no falla: active=null, pendientes=0, costo=0', async () => {
    await createUser('super@example.com', 'super_admin', 'active');
    await db.insert(schema.templeTrips).values({ date: '2026-06-01', registrationDeadline: '2026-05-01', templeName: 'Viejo', active: false });
    const data = await getDashboard(db);
    expect(data.trips.total).toBe(1);
    expect(data.trips.active).toBeNull();
    expect(data.participantsPendingApproval).toBe(0);
    expect(data.estimatedCost).toBe(0);
  });

  it('GET /api/dashboard: SuperAdmin 200, un rol inferior 403', async () => {
    const admin = await createUser('super@example.com', 'super_admin', 'active');
    const member = await createUser('miembro@example.com', 'member', 'active');
    const ok = await route.GET(request('GET', '/api/dashboard', await cookieFor(admin.id)), { params: Promise.resolve({}) });
    expect(ok.status).toBe(200);
    const forbidden = await route.GET(request('GET', '/api/dashboard', await cookieFor(member.id)), { params: Promise.resolve({}) });
    expect(forbidden.status).toBe(403);
  });
});
