import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { assignRoom, createRoom, deleteRoom, listRooms } from '@/server/temple-trips/rooms';
import { buildRoomsExcel } from '@/server/temple-trips/rooms-excel';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!url)('habitaciones del viaje al templo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: { rooms: typeof import('@/app/api/temple-trips/[id]/rooms/route') };

  async function lodgingTrip(over: Record<string, unknown> = {}) {
    const [trip] = await db
      .insert(schema.templeTrips)
      .values({ date: '2026-12-20', registrationDeadline: '2026-12-19', templeName: 'Templo de Prueba', scheduledWithTemple: true, active: true, includesLodging: true, quotaLodging: 100, ...over })
      .returning();
    return trip!;
  }

  async function occupant(tripId: string, over: Record<string, unknown> = {}) {
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
        approved: true,
        needsLodging: true,
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
    routes = { rooms: await import('@/app/api/temple-trips/[id]/rooms/route') };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table temple_rooms, temple_participants, temple_registrations, temple_trips, user_callings, module_permissions, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('crear habitación falla con 400 si el viaje no incluye hospedaje', async () => {
    const trip = await lodgingTrip({ includesLodging: false });
    const result = await createRoom(db, trip.id, '206');
    expect(result).toEqual({ ok: false, status: 400, code: 'no_lodging' });
  });

  it('el séptimo ocupante se rechaza con 400', async () => {
    const trip = await lodgingTrip();
    const room = await createRoom(db, trip.id, '206');
    expect(room.ok).toBe(true);
    const roomId = room.ok ? room.id : '';
    for (let i = 0; i < 6; i += 1) {
      const person = await occupant(trip.id, { idNumber: `A${i}` });
      expect(await assignRoom(db, person.id, roomId)).toEqual({ ok: true });
    }
    const seventh = await occupant(trip.id, { idNumber: 'A6' });
    expect(await assignRoom(db, seventh.id, roomId)).toEqual({ ok: false, status: 400, code: 'room_full' });
  });

  it('el tercer líder se rechaza con 400', async () => {
    const trip = await lodgingTrip();
    const room = await createRoom(db, trip.id, '206');
    const roomId = room.ok ? room.id : '';
    const a = await occupant(trip.id, { idNumber: 'L1' });
    const b = await occupant(trip.id, { idNumber: 'L2' });
    const c = await occupant(trip.id, { idNumber: 'L3' });
    expect(await assignRoom(db, a.id, roomId, 'leader')).toEqual({ ok: true });
    expect(await assignRoom(db, b.id, roomId, 'leader')).toEqual({ ok: true });
    expect(await assignRoom(db, c.id, roomId, 'leader')).toEqual({ ok: false, status: 400, code: 'too_many_leaders' });
  });

  it('asignar a un participante pendiente o sin hospedaje se rechaza en el servidor', async () => {
    const trip = await lodgingTrip();
    const room = await createRoom(db, trip.id, '206');
    const roomId = room.ok ? room.id : '';
    const pending = await occupant(trip.id, { idNumber: 'P1', approved: false });
    const noLodging = await occupant(trip.id, { idNumber: 'P2', needsLodging: false });
    expect(await assignRoom(db, pending.id, roomId)).toEqual({ ok: false, status: 400, code: 'not_approved' });
    expect(await assignRoom(db, noLodging.id, roomId)).toEqual({ ok: false, status: 400, code: 'not_approved' });
  });

  it('una habitación de otro viaje se rechaza con 400', async () => {
    const tripA = await lodgingTrip({ active: true });
    const tripB = await lodgingTrip({ active: false });
    const roomB = await createRoom(db, tripB.id, '301');
    const person = await occupant(tripA.id, { idNumber: 'X1' });
    expect(await assignRoom(db, person.id, roomB.ok ? roomB.id : '')).toEqual({ ok: false, status: 400, code: 'room_other_trip' });
  });

  it('borrar una habitación deja a sus ocupantes sin habitación y sin rol', async () => {
    const trip = await lodgingTrip();
    const room = await createRoom(db, trip.id, '206');
    const roomId = room.ok ? room.id : '';
    const person = await occupant(trip.id, { idNumber: 'D1' });
    await assignRoom(db, person.id, roomId, 'leader');
    expect(await deleteRoom(db, roomId)).toBe(true);
    const [row] = await db
      .select({ roomId: schema.templeParticipants.roomId, roomRole: schema.templeParticipants.roomRole })
      .from(schema.templeParticipants)
      .where(eq(schema.templeParticipants.id, person.id));
    expect(row).toEqual({ roomId: null, roomRole: null });
    expect(await db.select().from(schema.templeRooms)).toHaveLength(0);
  });

  it('las habitaciones se ordenan en orden natural: 2, 10, 206', async () => {
    const trip = await lodgingTrip();
    for (const number of ['206', '2', '10']) await createRoom(db, trip.id, number);
    const view = await listRooms(db, trip.id);
    expect(view?.rooms.map((room) => room.number)).toEqual(['2', '10', '206']);
  });

  it('el Excel lleva solo las 7 columnas, con el encabezado y las etiquetas de rol', async () => {
    const trip = await lodgingTrip();
    const room = await createRoom(db, trip.id, '206');
    const roomId = room.ok ? room.id : '';
    const leader = await occupant(trip.id, { idNumber: 'E1', fullName: 'Pérez Gómez Juan Carlos', gender: 'male', birthDate: '1988-03-05', lastNames: 'Pérez Gómez', firstNames: 'Juan Carlos', nationality: 'Ecuatoriana' });
    const guest = await occupant(trip.id, { idNumber: 'E2', fullName: 'López Ana', gender: 'female', birthDate: '1995-11-20' });
    await assignRoom(db, leader.id, roomId, 'leader');
    await assignRoom(db, guest.id, roomId, 'guest');

    const buffer = await buildRoomsExcel(db, trip.id, 'Ecuatoriana');
    expect(buffer).not.toBeNull();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer! as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('Habitaciones')!;
    expect(sheet).toBeDefined();

    const header = sheet.getRow(1);
    expect(header.getCell(1).value).toBe('Habitación # 206');
    expect(header.getCell(2).value).toBe('Correo electrónico');
    expect(header.getCell(7).value).toBe('F. Nacimiento día/mes/año');
    expect(header.getCell(8).value).toBeNull();
    expect((header.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFF2CEE2');
    expect(header.getCell(1).font?.color?.argb).toBe('FF880E4F');

    const leaderRow = sheet.getRow(2);
    expect(leaderRow.getCell(1).value).toBe('1. Líder a cargo');
    expect(leaderRow.getCell(2).value).toBe('persona@example.com');
    expect(leaderRow.getCell(3).value).toBe('Pérez Gómez');
    expect(leaderRow.getCell(4).value).toBe('Juan Carlos');
    expect(leaderRow.getCell(5).value).toBe('M');
    expect(leaderRow.getCell(6).value).toBe('Ecuatoriana');
    expect(leaderRow.getCell(7).value).toBe('5/3/1988');

    const guestRow = sheet.getRow(3);
    expect(guestRow.getCell(1).value).toBe('1. Huésped');
    expect(guestRow.getCell(5).value).toBe('F');
  });

  it('el Excel es null (400 en el endpoint) cuando no hay habitaciones', async () => {
    const trip = await lodgingTrip();
    expect(await buildRoomsExcel(db, trip.id, '')).toBeNull();
  });

  it('un usuario sin permiso de crear no puede crear una habitación (403)', async () => {
    const trip = await lodgingTrip();
    const [org] = await db.insert(schema.organizations).values({ name: 'Obispado' }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: org!.id, name: 'Secretario' }).returning();
    await db.insert(schema.modulePermissions).values({ module: 'temple-trips', callingId: calling!.id, canRead: true });
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, 'leader'));
    const [leader] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email: 'lider@example.com', passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, status: 'active' })
      .returning();
    await db.insert(schema.userCallings).values({ userId: leader!.id, callingId: calling!.id });
    const { token } = await createSession(db, leader!.id);
    const cookie = `${sessionCookieName()}=${token}`;
    const response = await routes.rooms.POST(request('POST', `/api/temple-trips/${trip.id}/rooms`, { number: '206' }, cookie), {
      params: Promise.resolve({ id: trip.id }),
    });
    expect(response.status).toBe(403);
  });
});
