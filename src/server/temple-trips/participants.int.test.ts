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
import { listTripParticipants, setApproval, updateLogistics, updateParticipant } from '@/server/temple-trips/registrations';

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

describe.skipIf(!url)('panel de participantes contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    participants: typeof import('@/app/api/temple-trips/[id]/participants/route');
    approval: typeof import('@/app/api/temple-participants/[id]/approval/route');
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

  async function activeTrip(over: Record<string, unknown> = {}) {
    const [trip] = await db
      .insert(schema.templeTrips)
      .values({ date: '2026-12-20', registrationDeadline: '2026-12-19', templeName: 'Templo de Prueba', scheduledWithTemple: true, active: true, ...over })
      .returning();
    return trip!;
  }

  async function addParticipant(tripId: string, over: Record<string, unknown> = {}) {
    const [reg] = await db.insert(schema.templeRegistrations).values({ tripId, consent: true, policyVersion: '2026-10', locale: 'es' }).returning();
    const [p] = await db
      .insert(schema.templeParticipants)
      .values({
        registrationId: reg!.id,
        idNumber: randomBytes(5).toString('hex'),
        birthDate: '1990-01-01',
        fullName: 'Persona Prueba',
        phone: '+593999999999',
        email: 'persona@example.com',
        gender: 'male',
        ...over,
      })
      .returning();
    return p!;
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
    routes = {
      participants: await import('@/app/api/temple-trips/[id]/participants/route'),
      approval: await import('@/app/api/temple-participants/[id]/approval/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table temple_participants, temple_registrations, temple_trips, user_callings, module_permissions, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('con 1 cupo, dos aprobaciones simultáneas: una pasa y la otra recibe 409', async () => {
    const trip = await activeTrip({ includesTransport: true, quotaTransport: 1 });
    const a = await addParticipant(trip.id, { idNumber: 'AA1', wantsTransport: true });
    const b = await addParticipant(trip.id, { idNumber: 'BB1', wantsTransport: true });
    const other = new Pool({ connectionString: url!, max: 1 });
    const db2 = drizzle(other, { schema });
    try {
      const [ra, rb] = await Promise.all([setApproval(db, a.id, true), setApproval(db2, b.id, true)]);
      const results = [ra, rb];
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.status === 409)).toHaveLength(1);
      const approved = await db.select({ id: schema.templeParticipants.id }).from(schema.templeParticipants).where(eq(schema.templeParticipants.approved, true));
      expect(approved).toHaveLength(1);
    } finally {
      await other.end();
    }
  });

  it('editar los servicios recalcula el costo con los precios congelados, no con los del viaje', async () => {
    const trip = await activeTrip({ includesTransport: true, quotaTransport: 10, costTransport: '5.00', includesBreakfast: true, costBreakfast: '2.00' });
    const p = await addParticipant(trip.id, { wantsTransport: true, priceTransport: '5.00', priceBreakfast: '2.00', totalCost: '5.00' });
    // Cambian los precios del viaje después; no deben afectar al participante.
    await db.update(schema.templeTrips).set({ costTransport: '99.00', costBreakfast: '99.00' }).where(eq(schema.templeTrips.id, trip.id));
    // Quita transporte y agrega desayuno: total = desayuno congelado (2.00).
    const result = await updateParticipant(db, p.id, { wantsTransport: false, wantsBreakfast: true });
    expect(result.ok).toBe(true);
    const [row] = await db.select({ total: schema.templeParticipants.totalCost }).from(schema.templeParticipants).where(eq(schema.templeParticipants.id, p.id));
    expect(row!.total).toBe('2.00');
  });

  it('la IP no se envía a quien no es SuperAdmin', async () => {
    const trip = await activeTrip();
    const [reg] = await db.insert(schema.templeRegistrations).values({ tripId: trip.id, ip: '203.0.113.5', consent: true, policyVersion: '2026-10', locale: 'es' }).returning();
    await db
      .insert(schema.templeParticipants)
      .values({ registrationId: reg!.id, idNumber: 'IP1', birthDate: '1990-01-01', fullName: 'Persona Prueba', phone: '+593999999999', email: 'persona@example.com', gender: 'male' });
    expect((await listTripParticipants(db, trip.id, { includeIp: true }))[0]!.ip).toBe('203.0.113.5');
    expect((await listTripParticipants(db, trip.id, { includeIp: false }))[0]!.ip).toBeNull();
  });

  it('un usuario con permiso de leer pero no de editar: GET 200, aprobación 403', async () => {
    const trip = await activeTrip({ includesTransport: true, quotaTransport: 5 });
    const participant = await addParticipant(trip.id);
    // líder con calling que tiene temple-trips canRead pero NO canUpdate
    const [org] = await db.insert(schema.organizations).values({ name: 'Obispado' }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: org!.id, name: 'Secretario' }).returning();
    await db.insert(schema.modulePermissions).values({ module: 'temple-trips', callingId: calling!.id, canRead: true });
    const leader = await createUser('lider@example.com', 'leader');
    await db.insert(schema.userCallings).values({ userId: leader.id, callingId: calling!.id });
    const cookie = await cookieFor(leader.id);
    const get = await routes.participants.GET(request('GET', `/api/temple-trips/${trip.id}/participants`, undefined, cookie), { params: Promise.resolve({ id: trip.id }) });
    expect(get.status).toBe(200);
    const approve = await routes.approval.POST(request('POST', `/api/temple-participants/${participant.id}/approval`, { approved: true }, cookie), {
      params: Promise.resolve({ id: participant.id }),
    });
    expect(approve.status).toBe(403);
  });

  it('marcar una casilla de logística persiste y el patch parcial no pisa las demás', async () => {
    const trip = await activeTrip({ includesTransport: true, quotaTransport: 5 });
    const p = await addParticipant(trip.id, { wantsTransport: true });
    expect((await updateLogistics(db, p.id, { boardedOutbound: true })).ok).toBe(true);
    let [row] = await listTripParticipants(db, trip.id, { includeIp: false });
    expect(row!.boardedOutbound).toBe(true);
    expect(row!.boardedReturn).toBe(false);
    // Un segundo patch solo del desayuno NO debe apagar el "ida" ya marcado.
    expect((await updateLogistics(db, p.id, { breakfastDelivered: true })).ok).toBe(true);
    [row] = await listTripParticipants(db, trip.id, { includeIp: false });
    expect(row!.boardedOutbound).toBe(true);
    expect(row!.breakfastDelivered).toBe(true);
    expect(row!.lunchDelivered).toBe(false);
  });

  it('logística de un participante inexistente devuelve 404', async () => {
    const result = await updateLogistics(db, '00000000-0000-0000-0000-000000000000', { boardedReturn: true });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(404);
  });

  it('rendimiento: con 2000 participantes la lista usa índice y responde rápido', async () => {
    const trip = await activeTrip();
    const [reg] = await db.insert(schema.templeRegistrations).values({ tripId: trip.id, consent: true, policyVersion: '2026-10', locale: 'es' }).returning();
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      registrationId: reg!.id,
      idNumber: `P${index}`,
      birthDate: '1990-01-01',
      fullName: `Persona ${index}`,
      phone: '+593999999999',
      email: 'persona@example.com',
      gender: 'male',
      approved: index % 2 === 0,
    }));
    for (let i = 0; i < rows.length; i += 500) await db.insert(schema.templeParticipants).values(rows.slice(i, i + 500));
    const explain = await db.execute(
      sql`explain select p.* from temple_participants p join temple_registrations r on r.id = p.registration_id where r.trip_id = ${trip.id}`,
    );
    const plan = explain.rows.map((r) => Object.values(r)[0]).join('\n');
    expect(plan.toLowerCase()).toContain('index');
    const started = Date.now();
    const list = await listTripParticipants(db, trip.id, { includeIp: false });
    const elapsed = Date.now() - started;
    expect(list).toHaveLength(2000);
    expect(elapsed).toBeLessThan(1500);
  });
});
