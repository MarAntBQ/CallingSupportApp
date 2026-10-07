import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const validConfig = {
  unitName: 'Barrio de Prueba',
  allowRegistration: true,
  timezone: 'America/Lima',
  defaultLocale: 'en',
  contact: 'barrio.prueba@example.com',
  controller: {
    name: 'Obispado de prueba',
    email: 'Obispado@Example.com',
    phone: '+593 2 000 0000',
    address: 'Av. de Prueba 123',
    city: 'Quito, Ecuador',
    website: 'https://example.com',
  },
  retentionMonths: 6,
  policyVersion: '2026-11',
};

const PUBLIC_KEYS = [
  'allowRegistration',
  'contact',
  'controller',
  'defaultLocale',
  'logoDataUrl',
  'policyVersion',
  'retentionMonths',
  'timezone',
  'unitName',
];

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'GET' ? {} : { Origin: 'http://localhost' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!url)('configuración de la instalación contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let seededRow: unknown;
  let routes: {
    config: typeof import('@/app/api/config/route');
    logo: typeof import('@/app/api/config/logo/route');
  };

  async function cookieFor(roleKey: string, email: string) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, roleKey));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Prueba', lastName: 'Usuario', email, passwordHash: await hashPassword('clave-correcta'), roleId: role!.id, status: 'active' })
      .returning();
    const { token } = await createSession(db, user!.id);
    return `${sessionCookieName()}=${token}`;
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "test": esta prueba la vacía.');
    }
    process.env.DATABASE_URL = url;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    seededRow = (await admin.query('select id, unit_name, timezone, default_locale, retention_months, policy_version from app_config')).rows;
    await admin.end();

    pool = new Pool({ connectionString: url, max: 1 });
    db = drizzle(pool, { schema });
    routes = {
      config: await import('@/app/api/config/route'),
      logo: await import('@/app/api/config/logo/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('la migración crea la fila única con los valores por defecto', () => {
    expect(seededRow).toEqual([
      { id: 1, unit_name: '', timezone: 'America/Guayaquil', default_locale: 'es', retention_months: 12, policy_version: '2026-10' },
    ]);
  });

  it('la base rechaza una segunda fila', async () => {
    await db.insert(schema.appConfig).values({ id: 1 });
    await expect(db.insert(schema.appConfig).values({ id: 2 })).rejects.toThrow();
  });

  it('GET /api/config funciona sin sesión y solo expone los campos de la especificación', async () => {
    const response = await routes.config.GET(request('GET', '/api/config'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
    expect(Object.keys(body.controller).sort()).toEqual(['address', 'city', 'email', 'name', 'phone', 'website']);
    expect(body).toMatchObject({ unitName: '', logoDataUrl: null, timezone: 'America/Guayaquil', defaultLocale: 'es', contact: null });
  });

  it('PATCH y POST del logo: 401 sin sesión y 403 para quien no es SuperAdmin', async () => {
    expect((await routes.config.PATCH(request('PATCH', '/api/config', validConfig))).status).toBe(401);
    expect((await routes.logo.POST(request('POST', '/api/config/logo', { logoDataUrl: null }))).status).toBe(401);
    for (const role of ['leader', 'member']) {
      const cookie = await cookieFor(role, `${role}@example.com`);
      expect((await routes.config.PATCH(request('PATCH', '/api/config', validConfig, cookie))).status).toBe(403);
      expect((await routes.logo.POST(request('POST', '/api/config/logo', { logoDataUrl: PNG, notOfficialLogo: true }, cookie))).status).toBe(403);
    }
    expect(await db.select().from(schema.appConfig)).toHaveLength(0);
  });

  it('PATCH de un SuperAdmin guarda y GET lo devuelve', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    const response = await routes.config.PATCH(request('PATCH', '/api/config', validConfig, cookie));
    expect(response.status).toBe(200);
    const body = await (await routes.config.GET(request('GET', '/api/config'))).json();
    expect(body).toMatchObject({
      unitName: 'Barrio de Prueba',
      allowRegistration: true,
      timezone: 'America/Lima',
      defaultLocale: 'en',
      contact: 'barrio.prueba@example.com',
      controller: {
        name: 'Obispado de prueba',
        email: 'obispado@example.com',
        phone: '+593 2 000 0000',
        address: 'Av. de Prueba 123',
        city: 'Quito, Ecuador',
        website: 'https://example.com',
      },
      retentionMonths: 6,
      policyVersion: '2026-11',
    });
  });

  it('PATCH conserva el logo', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    await routes.logo.POST(request('POST', '/api/config/logo', { logoDataUrl: PNG, notOfficialLogo: true }, cookie));
    await routes.config.PATCH(request('PATCH', '/api/config', validConfig, cookie));
    expect((await (await routes.config.GET(request('GET', '/api/config'))).json()).logoDataUrl).toBe(PNG);
  });

  it('PATCH con el nombre oficial de la Iglesia responde 400 y no guarda', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    const response = await routes.config.PATCH(
      request('PATCH', '/api/config', { ...validConfig, unitName: 'Barrio Iglesia de Jesucristo Centro' }, cookie),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'unitName', code: 'official_name' }]);
    expect(await db.select().from(schema.appConfig)).toHaveLength(0);
  });

  it('PATCH con zona horaria, correo o campos inválidos responde 400 con los campos', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    const response = await routes.config.PATCH(
      request(
        'PATCH',
        '/api/config',
        { ...validConfig, timezone: 'Marte/Olympus', controller: { ...validConfig.controller, email: 'x' }, logoDataUrl: PNG },
        cookie,
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual(expect.arrayContaining(['timezone', 'controller.email']));
  });

  it('PATCH desde otro origen responde 403', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    const req = new Request('http://localhost/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example.com', cookie },
      body: JSON.stringify(validConfig),
    });
    expect((await routes.config.PATCH(req)).status).toBe(403);
  });

  it('POST del logo: guarda una imagen confirmada, rechaza lo que no es imagen y null lo quita', async () => {
    const cookie = await cookieFor('super_admin', 'admin@example.com');
    const post = (body: unknown) => routes.logo.POST(request('POST', '/api/config/logo', body, cookie));

    expect((await post({ logoDataUrl: 'data:text/html;base64,PHNjcmlwdD4=', notOfficialLogo: true })).status).toBe(400);
    expect((await post({ logoDataUrl: `data:image/png;base64,${'A'.repeat(3_000_000)}`, notOfficialLogo: true })).status).toBe(400);
    const unconfirmed = await post({ logoDataUrl: PNG });
    expect(unconfirmed.status).toBe(400);
    expect((await unconfirmed.json()).issues).toEqual([{ field: 'notOfficialLogo', code: 'required' }]);
    expect(await db.select().from(schema.appConfig)).toHaveLength(0);

    const saved = await post({ logoDataUrl: PNG, notOfficialLogo: true });
    expect(saved.status).toBe(200);
    expect((await saved.json()).logoDataUrl).toBe(PNG);

    expect((await (await post({ logoDataUrl: null })).json()).logoDataUrl).toBeNull();
  });
});
