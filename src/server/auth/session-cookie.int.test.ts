import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { hashPassword } from './crypto';
import { sessionCookieName } from './sessions';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');
const EMAIL = 'ana@example.com';

const setupBody = {
  unitType: 'ward',
  unitName: 'Barrio de Prueba',
  contact: 'barrio.prueba@example.com',
  firstName: 'Ana',
  lastName: 'Prueba',
  email: EMAIL,
  password: PASSWORD,
  bishopApproved: true,
  bishopApprovedBy: 'Obispo de prueba',
  bishopApprovedOn: '2026-01-15',
  privacyConsent: true,
  locale: 'es',
} as const;

function post(path: string, body: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function sessionSetCookie(response: Response) {
  const header = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${sessionCookieName()}=`));
  if (!header) throw new Error(`no hay Set-Cookie de ${sessionCookieName()}`);
  const [pair, ...attributes] = header.split(';').map((part) => part.trim());
  return {
    header,
    value: pair!.slice(pair!.indexOf('=') + 1),
    attributes: attributes.map((attribute) => attribute.toLowerCase()),
    cookie: pair!,
  };
}

describe.skipIf(!url)('cookie de sesión y rotación contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    setup: typeof import('@/app/api/setup/route');
    login: typeof import('@/app/api/auth/login/route');
    logout: typeof import('@/app/api/auth/logout/route');
    me: typeof import('@/app/api/auth/me/route');
  };

  const login = (rememberMe: boolean, cookie?: string) =>
    routes.login.POST(post('/api/auth/login', { email: EMAIL, password: PASSWORD, rememberMe }, cookie));
  const me = (cookie?: string) =>
    routes.me.GET(new Request('http://localhost/api/auth/me', { headers: cookie ? { cookie } : {} }));

  async function createUser() {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, 'member'));
    await db.insert(schema.users).values({
      firstName: 'Ana',
      lastName: 'Prueba',
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      roleId: role!.id,
      status: 'active',
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
      setup: await import('@/app/api/setup/route'),
      login: await import('@/app/api/auth/login/route'),
      logout: await import('@/app/api/auth/logout/route'),
      me: await import('@/app/api/auth/me/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits restart identity cascade`);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe.each([
    ['production', true],
    ['development', false],
  ] as const)('con NODE_ENV=%s', (nodeEnv, production) => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', nodeEnv);
    });

    it('el login pone HttpOnly, SameSite=Lax, Path=/ y nunca Domain; Secure y __Host- solo en producción', async () => {
      await createUser();
      const cookie = sessionSetCookie(await login(false));
      expect(cookie.cookie.startsWith(production ? '__Host-csa_session=' : 'csa_session=')).toBe(true);
      expect(cookie.attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']));
      expect(cookie.attributes.includes('secure')).toBe(production);
      expect(cookie.attributes.some((attribute) => attribute.startsWith('domain='))).toBe(false);
    });

    it('sin "recordarme" es cookie del navegador (sin Expires ni Max-Age); con "recordarme" lleva Expires', async () => {
      await createUser();
      const browserCookie = sessionSetCookie(await login(false));
      expect(browserCookie.attributes.some((attribute) => attribute.startsWith('expires=') || attribute.startsWith('max-age='))).toBe(false);
      const remembered = sessionSetCookie(await login(true));
      expect(remembered.attributes.some((attribute) => attribute.startsWith('expires='))).toBe(true);
    });

    it('el setup pone los mismos atributos', async () => {
      const cookie = sessionSetCookie(await routes.setup.POST(post('/api/setup', setupBody)));
      expect(cookie.attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']));
      expect(cookie.attributes.includes('secure')).toBe(production);
      expect(cookie.attributes.some((attribute) => attribute.startsWith('domain='))).toBe(false);
    });

    it('el logout borra la cookie con Max-Age=0 y los mismos atributos', async () => {
      await createUser();
      const session = sessionSetCookie(await login(false));
      const cleared = sessionSetCookie(await routes.logout.POST(post('/api/auth/logout', {}, session.cookie)));
      expect(cleared.value).toBe('');
      expect(cleared.attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=lax', 'path=/', 'max-age=0']));
      expect(cleared.attributes.includes('secure')).toBe(production);
    });
  });

  it('iniciar sesión con una cookie de sesión válida revoca la anterior (rotación)', async () => {
    await createUser();
    const first = sessionSetCookie(await login(false));
    expect((await me(first.cookie)).status).toBe(200);

    const second = sessionSetCookie(await login(false, first.cookie));
    expect(second.value).not.toBe(first.value);
    expect((await me(first.cookie)).status).toBe(401);
    expect((await me(second.cookie)).status).toBe(200);
    const active = await db.select().from(schema.sessions).where(isNull(schema.sessions.revokedAt));
    expect(active).toHaveLength(1);
  }, 30_000);

  it('un login fallido con una cookie válida no revoca la sesión', async () => {
    await createUser();
    const first = sessionSetCookie(await login(false));
    const failed = await routes.login.POST(post('/api/auth/login', { email: EMAIL, password: 'x'.repeat(10) }, first.cookie));
    expect(failed.status).toBe(401);
    expect((await me(first.cookie)).status).toBe(200);
  }, 30_000);

  it('GET /api/auth/me responde 401 sin cookie y con una cookie inventada', async () => {
    expect((await me()).status).toBe(401);
    expect((await me(`${sessionCookieName()}=${randomBytes(32).toString('base64url')}`)).status).toBe(401);
  });
});
