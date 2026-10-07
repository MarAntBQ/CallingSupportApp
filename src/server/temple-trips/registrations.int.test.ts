import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { registrationNotice } from '@/server/temple-trips/registration-notice';
import { purgeExpiredRegistrations } from '@/server/temple-trips/registrations';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function participant(over: Record<string, unknown> = {}) {
  return {
    idNumber: '1710034065',
    birthDate: '1990-05-10',
    fullName: 'Persona Prueba',
    phone: '+593999999999',
    email: 'persona@example.com',
    gender: 'male',
    wantsTransport: false,
    needsLodging: false,
    wantsBreakfast: false,
    wantsLunch: false,
    ordinances: [] as string[],
    ...over,
  };
}

const bodyOf = (participants: unknown[], over: Record<string, unknown> = {}) => ({ participants, consent: true, ...over });

describe.skipIf(!url)('inscripción pública al viaje al templo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: { public: typeof import('@/app/api/public/temple-trip/route') };

  async function activeTrip(over: Record<string, unknown> = {}) {
    const [trip] = await db
      .insert(schema.templeTrips)
      .values({
        date: '2026-12-20',
        registrationDeadline: '2026-12-19',
        templeName: 'Templo de Prueba',
        scheduledWithTemple: true,
        active: true,
        ...over,
      })
      .returning();
    return trip!;
  }

  function post(body: unknown) {
    return routes.public.POST(request('POST', '/api/public/temple-trip', body));
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
    pool = new Pool({ connectionString: url, max: 2 });
    db = drizzle(pool, { schema });
    routes = { public: await import('@/app/api/public/temple-trip/route') };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table temple_participants, temple_registrations, temple_trips, sessions, users restart identity cascade`);
    await db.update(schema.appConfig).set({ timezone: 'America/Guayaquil', defaultLocale: 'es', policyVersion: '2026-10', retentionMonths: 12 });
    delete process.env.RECAPTCHA_SECRET_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.RECAPTCHA_SECRET_KEY;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('GET sin viaje activo responde 404; con viaje activo devuelve cupos restantes', async () => {
    expect((await routes.public.GET(request('GET', '/api/public/temple-trip'))).status).toBe(404);
    await activeTrip({ includesTransport: true, quotaTransport: 10, quotaBaptismMale: 3 });
    const response = await routes.public.GET(request('GET', '/api/public/temple-trip'));
    expect(response.status).toBe(200);
    const trip = await response.json();
    expect(trip.remainingQuotas.transport).toBe(10);
    expect(trip.remainingQuotas.quotaBaptismMale).toBe(3);
  });

  it('un menor de 11 con ordenanzas a la fecha del viaje se rechaza con 400', async () => {
    await activeTrip();
    const response = await post(bodyOf([participant({ birthDate: '2020-01-01', gender: 'male', ordinances: ['baptism'] })]));
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toContainEqual({ field: 'participants', code: 'age_ordinance' });
  });

  it('la cédula se normaliza: 235-001.660-2 y 2350016602 son la misma en el mismo envío', async () => {
    await activeTrip();
    const response = await post(
      bodyOf([participant({ idNumber: '235-001.660-2' }), participant({ idNumber: '2350016602', email: 'otra@example.com' })]),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toContainEqual({ field: 'participants', code: 'duplicate_in_submission' });
  });

  it('cupo excedido responde 400 con el recurso exacto', async () => {
    await activeTrip({ includesTransport: true, quotaTransport: 1 });
    const response = await post(
      bodyOf([
        participant({ idNumber: 'A10', wantsTransport: true }),
        participant({ idNumber: 'A20', email: 'b@example.com', wantsTransport: true }),
      ]),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toContainEqual({ field: 'transport', code: 'quota_exceeded' });
  });

  it('el transporte no se cobra si el viaje no lo incluye, aunque la persona lo pida', async () => {
    await activeTrip({ includesTransport: false, costTransport: '5.00' });
    expect((await post(bodyOf([participant({ wantsTransport: true })]))).status).toBe(201);
    const [row] = await db.select({ price: schema.templeParticipants.priceTransport, wants: schema.templeParticipants.wantsTransport }).from(schema.templeParticipants);
    expect(row!.price).toBe('0.00');
    expect(row!.wants).toBe(false);
  });

  it('cambiar los precios del viaje después de inscribirse no cambia el total guardado', async () => {
    const trip = await activeTrip({ includesTransport: true, quotaTransport: 10, costTransport: '5.00' });
    expect((await post(bodyOf([participant({ wantsTransport: true })]))).status).toBe(201);
    await db.update(schema.templeTrips).set({ costTransport: '99.00' }).where(eq(schema.templeTrips.id, trip.id));
    const [row] = await db.select({ total: schema.templeParticipants.totalCost, price: schema.templeParticipants.priceTransport }).from(schema.templeParticipants);
    expect(row!.price).toBe('5.00');
    expect(row!.total).toBe('5.00');
  });

  it('el día límite sigue abierto a las 23:30 en America/Guayaquil y cerrado al día siguiente', async () => {
    await activeTrip({ registrationDeadline: '2026-12-19' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-20T04:30:00Z')); // 2026-12-19 23:30 en America/Guayaquil (GMT-5)
    expect((await post(bodyOf([participant({ idNumber: 'OPEN1' })]))).status).toBe(201);
    vi.setSystemTime(new Date('2026-12-21T06:00:00Z')); // 2026-12-21 en America/Guayaquil
    const closed = await post(bodyOf([participant({ idNumber: 'LATE1' })]));
    expect(closed.status).toBe(400);
    expect((await closed.json()).issues).toContainEqual({ field: 'participants', code: 'registration_closed' });
  });

  it('con RECAPTCHA_SECRET_KEY, un token inválido responde 400; sin la clave el formulario funciona', async () => {
    await activeTrip();
    process.env.RECAPTCHA_SECRET_KEY = 'una-clave-de-prueba';
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    const bad = await post(bodyOf([participant({ idNumber: 'R100' })], { recaptchaToken: 'malo' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues).toContainEqual({ field: 'recaptchaToken', code: 'recaptcha_failed' });
    vi.unstubAllGlobals();
    delete process.env.RECAPTCHA_SECRET_KEY;
    expect((await post(bodyOf([participant({ idNumber: 'R200' })]))).status).toBe(201);
  });

  it('una fecha de nacimiento futura se rechaza', async () => {
    await activeTrip();
    const response = await post(bodyOf([participant({ idNumber: 'FUT1', birthDate: '2099-01-01' })]));
    expect(response.status).toBe(400);
    expect((await response.json()).fields.some((field: string) => field.includes('birthDate'))).toBe(true);
  });

  it('sin consentimiento, el servidor rechaza el envío', async () => {
    await activeTrip();
    const response = await post({ participants: [participant({ idNumber: 'C100' })], consent: false });
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toContain('consent');
  });

  it('una cédula repetida contra el mismo viaje se rechaza', async () => {
    await activeTrip();
    expect((await post(bodyOf([participant({ idNumber: '0102030405' })]))).status).toBe(201);
    const again = await post(bodyOf([participant({ idNumber: '010-203.040-5', email: 'z@example.com' })]));
    expect(again.status).toBe(400);
    expect((await again.json()).issues).toContainEqual({ field: 'participants', code: 'duplicate_existing' });
  });

  it('el aviso de nueva inscripción no lleva datos de personas', () => {
    for (const locale of ['es', 'pt', 'en'] as const) {
      const notice = registrationNotice(locale, 2, 'http://localhost/admin/temple-trips');
      const all = `${notice.subject} ${notice.html} ${notice.telegramText}`;
      expect(all).not.toContain('@');
      expect(all).not.toContain('persona');
      expect(notice.html).toContain('2');
      expect(notice.html).toContain('/admin/temple-trips');
    }
  });

  it('la purga borra inscripciones vencidas (viaje pasado + retención) y es idempotente; respeta viajes futuros', async () => {
    const past = await activeTrip({ date: '2025-01-10', registrationDeadline: '2025-01-05', active: false, templeName: 'Pasado' });
    const future = await activeTrip({ date: '2027-06-10', registrationDeadline: '2027-06-01', active: true, templeName: 'Futuro' });
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // ~13 meses
    const [regPast] = await db.insert(schema.templeRegistrations).values({ tripId: past.id, consent: true, policyVersion: '2026-10', locale: 'es', createdAt: old }).returning();
    await db.insert(schema.templeParticipants).values({ registrationId: regPast!.id, idNumber: 'P1', birthDate: '1990-01-01', fullName: 'Persona Prueba', phone: '+593999999999', email: 'p@example.com', gender: 'male' });
    const [regFuture] = await db.insert(schema.templeRegistrations).values({ tripId: future.id, consent: true, policyVersion: '2026-10', locale: 'es', createdAt: old }).returning();
    await db.insert(schema.templeParticipants).values({ registrationId: regFuture!.id, idNumber: 'F1', birthDate: '1990-01-01', fullName: 'Persona Prueba', phone: '+593999999999', email: 'f@example.com', gender: 'male' });

    const first = await purgeExpiredRegistrations(db, { timeZone: 'America/Guayaquil', retentionMonths: 12 });
    expect(first).toEqual({ purgedRegistrations: 1, purgedParticipants: 1 });
    const second = await purgeExpiredRegistrations(db, { timeZone: 'America/Guayaquil', retentionMonths: 12 });
    expect(second).toEqual({ purgedRegistrations: 0, purgedParticipants: 0 });
    const left = await db.select({ id: schema.templeRegistrations.id }).from(schema.templeRegistrations);
    expect(left).toEqual([{ id: regFuture!.id }]);
  });
});
