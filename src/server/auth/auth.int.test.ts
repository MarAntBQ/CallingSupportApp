import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { hashPassword, hashSessionToken } from './crypto';
import { AuthError } from './errors';
import {
  countActiveAdmins,
  createSession,
  findSession,
  IDLE_TIMEOUT_MS,
  revokeSession,
  sessionCookieName,
  TOUCH_INTERVAL_MS,
} from './sessions';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const setupBody = {
  unitType: 'branch',
  unitName: 'Rama de Prueba',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  password: 'contraseña-larga',
  bishopApproved: true,
  bishopApprovedBy: 'Presidente de rama de prueba',
  bishopApprovedOn: '2026-01-15',
  privacyConsent: true,
  locale: 'pt',
} as const;

function jsonRequest(path: string, body: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, cookie?: string) {
  return new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });
}

function sessionCookieFrom(response: Response) {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`${sessionCookieName()}=([^;]*)`));
  return match ? `${sessionCookieName()}=${match[1]}` : undefined;
}

describe.skipIf(!url)('autenticación contra Postgres', () => {
  const pools: Pool[] = [];
  let db: Database;
  let db2: Database;
  let routes: {
    setup: typeof import('@/app/api/setup/route');
    login: typeof import('@/app/api/auth/login/route');
    logout: typeof import('@/app/api/auth/logout/route');
    me: typeof import('@/app/api/auth/me/route');
    locale: typeof import('@/app/api/locale/route');
  };
  let performSetup: typeof import('@/server/setup/service').performSetup;

  async function createUser(
    email: string,
    { status = 'active', roleKey = 'member' }: { status?: 'pending' | 'active' | 'suspended'; roleKey?: string } = {},
  ) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, roleKey));
    const [user] = await db
      .insert(schema.users)
      .values({
        firstName: 'Prueba',
        lastName: 'Usuario',
        email,
        passwordHash: await hashPassword('clave-correcta'),
        roleId: role!.id,
        status,
      })
      .returning();
    return user!;
  }

  async function login(email: string, password = 'clave-correcta') {
    return routes.login.POST(jsonRequest('/api/auth/login', { email, password }));
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

    for (let i = 0; i < 2; i++) pools.push(new Pool({ connectionString: url, max: 1 }));
    db = drizzle(pools[0]!, { schema });
    db2 = drizzle(pools[1]!, { schema });

    routes = {
      setup: await import('@/app/api/setup/route'),
      login: await import('@/app/api/auth/login/route'),
      logout: await import('@/app/api/auth/logout/route'),
      me: await import('@/app/api/auth/me/route'),
      locale: await import('@/app/api/locale/route'),
    };
    ({ performSetup } = await import('@/server/setup/service'));
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits restart identity cascade`);
  });

  afterAll(async () => {
    await Promise.all(pools.map((pool) => pool.end()));
  });

  it('la migración siembra los cuatro roles', async () => {
    const roles = await db.select().from(schema.roles).orderBy(schema.roles.level);
    expect(roles.map((role) => [role.key, role.level])).toEqual([
      ['friend', 5],
      ['member', 10],
      ['leader', 50],
      ['super_admin', 100],
    ]);
  });

  it('dos setups simultáneos desde conexiones distintas crean un solo usuario', async () => {
    let arrived = 0;
    const bothChecked = new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        if (arrived >= 2) {
          clearInterval(tick);
          resolve();
        }
      }, 10);
      setTimeout(() => {
        clearInterval(tick);
        resolve();
      }, 1_500);
    });
    const afterCheck = async () => {
      arrived += 1;
      await bothChecked;
    };
    const results = await Promise.allSettled([
      performSetup(db, { ...setupBody, email: 'uno@example.com' }, { afterCheck }),
      performSetup(db2, { ...setupBody, email: 'dos@example.com' }, { afterCheck }),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AuthError);
    expect(((rejected[0] as PromiseRejectedResult).reason as AuthError).status).toBe(404);
    const { rows } = await db.execute<{ total: number }>(sql`select count(*)::int as total from users`);
    expect(rows[0]!.total).toBe(1);
  }, 30_000);

  it('/api/setup: crea el SuperAdmin, guarda la aprobación e inicia sesión; después responde 404', async () => {
    expect(await (await routes.setup.GET(getRequest('/api/setup'))).json()).toEqual({ needed: true });

    const response = await routes.setup.POST(jsonRequest('/api/setup', setupBody));
    expect(response.status).toBe(201);
    const me = await response.json();
    expect(me.role.key).toBe('super_admin');
    expect(me.allowedModules.length).toBeGreaterThan(0);
    expect(JSON.stringify(me)).not.toMatch(/password/i);

    const cookie = sessionCookieFrom(response);
    expect(cookie).toBeDefined();
    expect((await routes.me.GET(getRequest('/api/auth/me', cookie))).status).toBe(200);

    const [admin] = await db.select().from(schema.users);
    expect(admin!.consentAt).toBeInstanceOf(Date);
    expect(admin!.consentPolicyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(admin!.consentLocale).toBe('pt');
    expect(admin!.locale).toBe('pt');

    const [approval] = await db.select().from(schema.installation);
    expect(approval).toMatchObject({
      unitType: 'branch',
      bishopApprovedBy: 'Presidente de rama de prueba',
      bishopApprovedOn: '2026-01-15',
    });
    const [config] = await db.select().from(schema.appConfig);
    expect(config).toMatchObject({ unitName: 'Rama de Prueba', defaultLocale: 'pt' });

    expect(await (await routes.setup.GET(getRequest('/api/setup'))).json()).toEqual({ needed: false });
    expect((await routes.setup.POST(jsonRequest('/api/setup', { ...setupBody, email: 'otro@example.com' }))).status).toBe(404);
  }, 30_000);

  it('/api/setup sin el tipo o el nombre de la unidad responde 400 y no crea nada', async () => {
    for (const missing of ['unitType', 'unitName'] as const) {
      const response = await routes.setup.POST(jsonRequest('/api/setup', { ...setupBody, [missing]: undefined }));
      expect(response.status).toBe(400);
      expect((await response.json()).fields).toContain(missing);
    }
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it('/api/setup rechaza un nombre de unidad con el nombre oficial de la Iglesia', async () => {
    const response = await routes.setup.POST(
      jsonRequest('/api/setup', { ...setupBody, unitName: 'Barrio Iglesia de Jesucristo Centro' }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'unitName', code: 'official_name' }]);
    expect(await db.select().from(schema.installation)).toHaveLength(0);
  });

  it('/api/setup sin el consentimiento del aviso de privacidad responde 400', async () => {
    const response = await routes.setup.POST(jsonRequest('/api/setup', { ...setupBody, privacyConsent: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toContain('privacyConsent');
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it('/api/setup sin la aprobación del obispo responde 400 y no crea nada', async () => {
    const response = await routes.setup.POST(jsonRequest('/api/setup', { ...setupBody, bishopApproved: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toContain('bishopApproved');
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it('inicia sesión con el correo en mayúsculas y guarda solo el hash del token', async () => {
    await createUser('juan@ejemplo.com');
    const response = await login('JUAN@EJEMPLO.COM');
    expect(response.status).toBe(200);

    const cookie = sessionCookieFrom(response)!;
    const token = cookie.split('=')[1]!;
    const stored = await db.select().from(schema.sessions);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  }, 20_000);

  it('responde con los códigos de error de la especificación', async () => {
    await createUser('activo@example.com');
    await createUser('pendiente@example.com', { status: 'pending' });
    await createUser('suspendido@example.com', { status: 'suspended' });

    const cases: [string, string, number, string][] = [
      ['activo@example.com', 'mala', 401, 'invalid_credentials'],
      ['noexiste@example.com', 'clave-correcta', 401, 'invalid_credentials'],
      ['pendiente@example.com', 'clave-correcta', 403, 'account_pending'],
      ['suspendido@example.com', 'clave-correcta', 403, 'account_suspended'],
      ['pendiente@example.com', 'mala', 401, 'invalid_credentials'],
    ];
    for (const [email, password, status, error] of cases) {
      const response = await login(email, password);
      expect([email, password, response.status, (await response.json()).error]).toEqual([email, password, status, error]);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  }, 30_000);

  it('después de cerrar sesión, la cookie anterior ya no sirve', async () => {
    await createUser('sale@example.com');
    const cookie = sessionCookieFrom(await login('sale@example.com'))!;
    expect((await routes.me.GET(getRequest('/api/auth/me', cookie))).status).toBe(200);

    const logout = await routes.logout.POST(jsonRequest('/api/auth/logout', {}, cookie));
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await routes.me.GET(getRequest('/api/auth/me', cookie))).status).toBe(401);
  }, 20_000);

  it('un usuario suspendido con sesión abierta pierde el acceso en su siguiente petición', async () => {
    const user = await createUser('pronto@example.com');
    const cookie = sessionCookieFrom(await login('pronto@example.com'))!;
    expect((await routes.me.GET(getRequest('/api/auth/me', cookie))).status).toBe(200);

    await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, user.id));
    expect((await routes.me.GET(getRequest('/api/auth/me', cookie))).status).toBe(401);
  }, 20_000);

  it('una sesión vencida o revocada no es válida', async () => {
    const user = await createUser('tiempo@example.com');
    const { token } = await createSession(db, user.id);
    const session = await findSession(db, token);
    expect(session?.user.email).toBe('tiempo@example.com');

    expect(await findSession(db, token, new Date(Date.now() + 2 * 60 * 60 * 1000))).toBeNull();

    await revokeSession(db, session!.id);
    expect(await findSession(db, token)).toBeNull();
  }, 20_000);

  it('cuenta los administradores activos para el aviso del segundo administrador', async () => {
    await createUser('admin1@example.com', { roleKey: 'super_admin' });
    expect(await countActiveAdmins(db)).toBe(1);
    await createUser('lider@example.com', { roleKey: 'leader' });
    await createUser('admin-suspendido@example.com', { roleKey: 'super_admin', status: 'suspended' });
    expect(await countActiveAdmins(db)).toBe(1);
    await createUser('admin2@example.com', { roleKey: 'super_admin' });
    expect(await countActiveAdmins(db)).toBe(2);
  }, 30_000);

  it('con sesión, el selector guarda el idioma del usuario y el próximo login lo restaura', async () => {
    const user = await createUser('idioma@example.com');
    const cookie = sessionCookieFrom(await login('idioma@example.com'))!;

    const response = await routes.locale.POST(jsonRequest('/api/locale', { locale: 'pt' }, cookie));
    expect(response.status).toBe(204);
    const [saved] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(saved!.locale).toBe('pt');

    const again = await login('idioma@example.com');
    expect(again.headers.get('set-cookie')).toMatch(/csa_locale=pt/);
  }, 20_000);
it('el sexto intento fallido con el mismo correo en 15 minutos responde 429 con Retry-After', async () => {
    await createUser('limite@example.com');
    for (let i = 0; i < 5; i++) expect((await login('limite@example.com', 'mala')).status).toBe(401);
    const blocked = await login('limite@example.com', 'mala');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'rate_limited' });
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(800);
    expect((await login('LIMITE@example.com', 'clave-correcta')).status).toBe(429);
    const stored = await db.select().from(schema.rateLimits);
    expect(JSON.stringify(stored)).not.toContain('limite@');
  }, 60_000);

  it('una ráfaga de 20 intentos simultáneos con el mismo correo solo deja pasar 5', async () => {
    await createUser('rafaga@example.com');
    const responses = await Promise.all(Array.from({ length: 20 }, () => login('rafaga@example.com', 'mala')));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(15);
  }, 60_000);

  it('authenticate tarda lo mismo con un correo inexistente que con una contraseña incorrecta (20 de cada uno)', async () => {
    const { authenticate } = await import('./login');
    await createUser('tiempo-existe@example.com');
    const measure = async (email: string) => {
      const started = performance.now();
      await authenticate(db, email, 'contraseña-mala').catch(() => undefined);
      return performance.now() - started;
    };
    await measure('calentar@example.com');
    const missing: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 20; i++) {
      missing.push(await measure(`no-existe-${i}@example.com`));
      wrong.push(await measure('tiempo-existe@example.com'));
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[10]!;
    expect(Math.abs(median(missing) - median(wrong))).toBeLessThan(100);
  }, 120_000);

  it('los inicios de sesión correctos no gastan el cupo de la IP (oficina o red compartida)', async () => {
    for (let i = 0; i < 25; i++) await createUser(`oficina${i}@example.com`);
    for (let i = 0; i < 25; i++) expect((await login(`oficina${i}@example.com`)).status).toBe(200);
    for (let i = 0; i < 19; i++) expect((await login(`oficina${i}@example.com`, 'mala')).status).toBe(401);
    expect((await login('oficina20@example.com', 'mala')).status).toBe(401);
    expect((await login('oficina21@example.com', 'mala')).status).toBe(429);
  }, 180_000);

  it('un inicio de sesión correcto limpia el contador de su correo', async () => {
    await createUser('vuelve@example.com');
    for (let i = 0; i < 4; i++) await login('vuelve@example.com', 'mala');
    expect((await login('vuelve@example.com')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login('vuelve@example.com', 'mala')).status).toBe(401);
  }, 60_000);

  it('el setup acepta 10 intentos por IP por hora y el undécimo responde 429', async () => {
    const fromIp = (body: unknown) =>
      routes.setup.POST(
        new Request('http://localhost/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'x-forwarded-for': '198.51.100.9' },
          body: JSON.stringify(body),
        }),
      );
    for (let i = 0; i < 10; i++) expect((await fromIp({ ...setupBody, privacyConsent: false })).status).toBe(400);
    const blocked = await fromIp(setupBody);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(await db.select().from(schema.users)).toHaveLength(0);
  }, 60_000);

  it('un POST desde otro sitio responde 403 sin tocar la base', async () => {
    await createUser('csrf@example.com');
    const response = await routes.login.POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://otro-sitio.example' },
        body: JSON.stringify({ email: 'csrf@example.com', password: 'clave-correcta' }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'bad_origin' });
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
  }, 20_000);

  it('la sesión vence tras 8 horas sin uso y se renueva al usarla', async () => {
    const user = await createUser('inactivo@example.com');
    const start = new Date();
    const { token } = await createSession(db, user.id, { rememberMe: true, now: start });
    const later = new Date(start.getTime() + TOUCH_INTERVAL_MS + 1000);
    expect(await findSession(db, token, later)).not.toBeNull();
    const [touched] = await db.select().from(schema.sessions);
    expect(touched!.lastSeenAt.getTime()).toBe(later.getTime());

    expect(await findSession(db, token, new Date(later.getTime() + IDLE_TIMEOUT_MS - 1000))).not.toBeNull();
    const [again] = await db.select().from(schema.sessions);
    expect(await findSession(db, token, new Date(again!.lastSeenAt.getTime() + IDLE_TIMEOUT_MS + 1000))).toBeNull();
  }, 20_000);
});
