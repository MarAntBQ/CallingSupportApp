import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { hashPassword, verifyPassword } from './crypto';
import { authenticate } from './login';
import { changePassword } from './profile';
import { createSession, createLoginSession, findSession, sessionCookieName } from './sessions';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const randomSecret = () => randomBytes(12).toString('hex');
const PASSWORD = randomSecret();
const NEW_PASSWORD = randomSecret();
const OTHER_PASSWORD = randomSecret();

function request(method: string, path: string, body: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!url)('Mi perfil contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    profile: typeof import('@/app/api/auth/profile/route');
    password: typeof import('@/app/api/auth/change-password/route');
    me: typeof import('@/app/api/auth/me/route');
    login: typeof import('@/app/api/auth/login/route');
  };

  async function createUser(email: string) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, 'member'));
    const [user] = await db
      .insert(schema.users)
      .values({
        firstName: 'Ana',
        lastName: 'Prueba',
        email,
        phone: '099 000 0000',
        passwordHash: await hashPassword(PASSWORD),
        roleId: role!.id,
        status: 'active',
      })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  const me = (cookie: string) =>
    routes.me.GET(new Request('http://localhost/api/auth/me', { headers: { cookie } }));

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
      profile: await import('@/app/api/auth/profile/route'),
      password: await import('@/app/api/auth/change-password/route'),
      me: await import('@/app/api/auth/me/route'),
      login: await import('@/app/api/auth/login/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('PATCH /api/auth/profile sin sesión responde 401', async () => {
    expect((await routes.profile.PATCH(request('PATCH', '/api/auth/profile', { firstName: 'Beto' }))).status).toBe(401);
  });

  it('actualiza solo lo enviado y devuelve me con el nombre nuevo', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    const response = await routes.profile.PATCH(request('PATCH', '/api/auth/profile', { firstName: '  Beatriz ' }, cookie));
    expect(response.status).toBe(200);
    expect((await response.json()).firstName).toBe('Beatriz');
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row).toMatchObject({ firstName: 'Beatriz', lastName: 'Prueba', phone: '099 000 0000', email: 'ana@example.com' });
  });

  it('un teléfono vacío lo borra', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    expect((await routes.profile.PATCH(request('PATCH', '/api/auth/profile', { phone: '' }, cookie))).status).toBe(200);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row!.phone).toBeNull();
  });

  it('rechaza nombres cortos, teléfonos con letras, cuerpos vacíos y el correo', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    for (const body of [{ firstName: 'A' }, { phone: 'llámame' }, {}, { email: 'otro@example.com' }, { firstName: 'Ana', role: 'super_admin' }]) {
      const response = await routes.profile.PATCH(request('PATCH', '/api/auth/profile', body, cookie));
      expect([JSON.stringify(body), response.status]).toEqual([JSON.stringify(body), 400]);
    }
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row).toMatchObject({ firstName: 'Ana', email: 'ana@example.com', phone: '099 000 0000' });
  });

  it('solo cambia los datos del propio usuario', async () => {
    const ana = await createUser('ana@example.com');
    const beto = await createUser('beto@example.com');
    await routes.profile.PATCH(request('PATCH', '/api/auth/profile', { firstName: 'Cambiado' }, await cookieFor(ana.id)));
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, beto.id));
    expect(row!.firstName).toBe('Ana');
  });

  it('con la contraseña actual errónea responde 400 currentPassword/incorrect y no cambia nada', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    const other = await cookieFor(user.id);
    const response = await routes.password.POST(
      request('POST', '/api/auth/change-password', { currentPassword: randomSecret(), newPassword: NEW_PASSWORD }, cookie),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_input',
      fields: ['currentPassword'],
      issues: [{ field: 'currentPassword', code: 'incorrect' }],
    });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(await verifyPassword(PASSWORD, row!.passwordHash)).toBe(true);
    expect((await me(other)).status).toBe(200);
  });

  it('cambia la contraseña, revoca las demás sesiones y deja abierta la actual', async () => {
    const user = await createUser('ana@example.com');
    const other = await createUser('beto@example.com');
    const current = await cookieFor(user.id);
    const second = await cookieFor(user.id);
    const otherUser = await cookieFor(other.id);

    const response = await routes.password.POST(
      request('POST', '/api/auth/change-password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, current),
    );
    expect(response.status).toBe(204);

    expect((await me(current)).status).toBe(200);
    expect((await me(second)).status).toBe(401);
    expect((await me(otherUser)).status).toBe(200);

    const login = (password: string) =>
      routes.login.POST(request('POST', '/api/auth/login', { email: 'ana@example.com', password }));
    expect((await login(PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  }, 30_000);

  it('un login que verificó la contraseña vieja no crea sesión si el cambio terminó antes de insertarla', async () => {
    const user = await createUser('ana@example.com');
    const { token } = await createSession(db, user.id);
    const current = await findSession(db, token);
    const verified = await authenticate(db, 'ana@example.com', PASSWORD);

    expect(await changePassword(db, current!, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).toEqual({ ok: true });

    await expect(createLoginSession(db, user.id, verified.passwordHash)).rejects.toMatchObject({ status: 401 });
    const { rows } = await db.execute<{ total: number }>(sql`select count(*)::int as total from sessions where revoked_at is null`);
    expect(rows[0]!.total).toBe(1);
  }, 30_000);

  it('dos cambios simultáneos con la misma contraseña actual: solo uno gana', async () => {
    const user = await createUser('ana@example.com');
    const { token } = await createSession(db, user.id);
    const current = await findSession(db, token);
    let arrived = 0;
    const both = new Promise<void>((resolve) => {
      const tick = setInterval(() => arrived >= 2 && (clearInterval(tick), resolve()), 10);
      setTimeout(() => (clearInterval(tick), resolve()), 3_000);
    });
    const afterVerify = async () => {
      arrived += 1;
      await both;
    };
    const results = await Promise.all([
      changePassword(db, current!, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, { afterVerify }),
      changePassword(db, current!, { currentPassword: PASSWORD, newPassword: OTHER_PASSWORD }, { afterVerify }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  }, 30_000);

  it('rechaza una contraseña nueva de menos de 8 caracteres', async () => {
    const user = await createUser('ana@example.com');
    const response = await routes.password.POST(
      request('POST', '/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'x'.repeat(5) }, await cookieFor(user.id)),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual(['newPassword']);
  });

  it('el sexto intento en 15 minutos responde 429 con Retry-After', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    const attempt = () =>
      routes.password.POST(
        request('POST', '/api/auth/change-password', { currentPassword: randomSecret(), newPassword: NEW_PASSWORD }, cookie),
      );
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(400);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
  }, 30_000);

  it('cambiar la contraseña desde otro origen responde 403', async () => {
    const user = await createUser('ana@example.com');
    const cookie = await cookieFor(user.id);
    const response = await routes.password.POST(
      new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example.com', cookie },
        body: JSON.stringify({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
