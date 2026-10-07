import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { DEMO_UNIT_NAME, seedDemo } from '@/server/db/seed-demo';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

describe.skipIf(!url)('semilla demo contra Postgres', () => {
  let pool: Pool;
  let db: Database;

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
  }, 60_000);

  beforeEach(async () => {
    await db.execute(
      sql`truncate table temple_participants, temple_registrations, temple_trips, user_callings, callings, organizations, sessions, users restart identity cascade`,
    );
    await db.update(schema.appConfig).set({ unitName: '' }).where(eq(schema.appConfig.id, 1));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('crea la unidad, 3 organizaciones con llamamientos, 5 usuarios, y 1 viaje con 10 participantes', async () => {
    const summary = await seedDemo(db);

    expect(summary.unitName).toBe(DEMO_UNIT_NAME);
    const [config] = await db.select({ unitName: schema.appConfig.unitName }).from(schema.appConfig).where(eq(schema.appConfig.id, 1));
    expect(config?.unitName).toBe(DEMO_UNIT_NAME);

    expect(await db.select().from(schema.organizations)).toHaveLength(3);
    expect(await db.select().from(schema.callings)).toHaveLength(6);

    const userRows = await db.select({ email: schema.users.email }).from(schema.users);
    expect(userRows).toHaveLength(5);
    expect(userRows.every((row) => row.email.endsWith('@example.com'))).toBe(true);
    expect(summary.users.filter((user) => user.created)).toHaveLength(5);
    expect(summary.users.every((user) => user.created && user.password && user.password.length > 0)).toBe(true);

    const trips = await db.select().from(schema.templeTrips);
    expect(trips).toHaveLength(1);
    expect(trips[0]!.active).toBe(true);
    expect(summary.trip.created).toBe(true);

    expect(await db.select().from(schema.templeRegistrations)).toHaveLength(1);
    const participants = await db.select().from(schema.templeParticipants);
    expect(participants).toHaveLength(10);
    expect(participants.every((row) => row.email.endsWith('@example.com'))).toBe(true);
    expect(summary.participants).toBe(10);
  });

  it('es idempotente: correrla dos veces no duplica ni rompe', async () => {
    await seedDemo(db);
    const second = await seedDemo(db);

    expect(await db.select().from(schema.organizations)).toHaveLength(3);
    expect(await db.select().from(schema.callings)).toHaveLength(6);
    expect(await db.select().from(schema.users)).toHaveLength(5);
    expect(await db.select().from(schema.templeTrips)).toHaveLength(1);
    expect(await db.select().from(schema.templeRegistrations)).toHaveLength(1);
    expect(await db.select().from(schema.templeParticipants)).toHaveLength(10);

    // En la segunda corrida nada se crea de nuevo y no se imprimen contraseñas.
    expect(second.trip.created).toBe(false);
    expect(second.registration.created).toBe(false);
    expect(second.users.every((user) => !user.created && user.password === null)).toBe(true);
    expect(second.participants).toBe(10);
  });
});
