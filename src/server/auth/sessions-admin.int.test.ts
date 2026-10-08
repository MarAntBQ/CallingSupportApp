import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, findSession, listActiveSessions, revokeOtherSessions, revokeSessionChecked, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';

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

describe.skipIf(!url)('sesiones activas contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    list: typeof import('@/app/api/sessions/route');
    revoke: typeof import('@/app/api/sessions/[id]/revoke/route');
    revokeMine: typeof import('@/app/api/sessions/revoke-mine/route');
  };

  async function createUser(email: string, role: 'super_admin' | 'leader' | 'member') {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100, status: 'active' })
      .returning();
    return user!;
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
      list: await import('@/app/api/sessions/route'),
      revoke: await import('@/app/api/sessions/[id]/revoke/route'),
      revokeMine: await import('@/app/api/sessions/revoke-mine/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, user_callings, module_permissions, callings, organizations, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('revocar una sesión expulsa a ese usuario en su siguiente petición', async () => {
    const user = await createUser('a@example.com', 'member');
    const { token } = await createSession(db, user.id);
    expect(await findSession(db, token)).not.toBeNull();
    const [row] = await db.select({ id: schema.sessions.id }).from(schema.sessions).limit(1);
    expect(await revokeSessionChecked(db, row!.id)).toBe(true);
    expect(await findSession(db, token)).toBeNull();
  });

  it('revocar una sesión inexistente devuelve false (404)', async () => {
    expect(await revokeSessionChecked(db, randomUUID())).toBe(false);
  });

  it('cerrar mis otras sesiones no toca las de otros usuarios', async () => {
    const a = await createUser('a@example.com', 'member');
    const b = await createUser('b@example.com', 'member');
    const current = await createSession(db, a.id);
    await createSession(db, a.id);
    await createSession(db, a.id);
    const bToken = (await createSession(db, b.id)).token;
    // La sesión actual de A se identifica por su token.
    const currentId = (await findSession(db, current.token))!.id;
    const revoked = await revokeOtherSessions(db, a.id, currentId);
    expect(revoked).toBe(2);
    expect(await findSession(db, current.token)).not.toBeNull();
    expect(await findSession(db, bToken)).not.toBeNull();
    const activeOfA = await db.select().from(schema.sessions).where(sql`${schema.sessions.userId} = ${a.id} and ${schema.sessions.revokedAt} is null`);
    expect(activeOfA).toHaveLength(1);
  });

  it('listActiveSessions no incluye el hash del token ni sesiones revocadas o vencidas', async () => {
    const user = await createUser('a@example.com', 'super_admin');
    await createSession(db, user.id);
    await createSession(db, user.id, { now: new Date(Date.now() - 2 * 60 * 60 * 1000) }); // vencida (TTL 1h)
    const toRevoke = await createSession(db, user.id);
    const revokedId = (await findSession(db, toRevoke.token))!.id;
    await revokeSessionChecked(db, revokedId);
    const list = await listActiveSessions(db);
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0]!).sort()).toEqual(['createdAt', 'email', 'expiresAt', 'id', 'name', 'userAgent', 'userId']);
    expect(JSON.stringify(list)).not.toContain('token');
  });

  it('GET /api/sessions responde 403 a quien no es SuperAdmin y 200 sin token_hash al SuperAdmin', async () => {
    const member = await createUser('m@example.com', 'member');
    const admin = await createUser('admin@example.com', 'super_admin');
    await createSession(db, admin.id);
    const memberCookie = `${sessionCookieName()}=${(await createSession(db, member.id)).token}`;
    const adminCookie = `${sessionCookieName()}=${(await createSession(db, admin.id)).token}`;
    expect((await routes.list.GET(request('GET', '/api/sessions', undefined, memberCookie))).status).toBe(403);
    const ok = await routes.list.GET(request('GET', '/api/sessions', undefined, adminCookie));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(JSON.stringify(body)).not.toContain('token_hash');
  });

  it('POST /api/sessions/revoke-mine revoca las demás del usuario y responde { revoked }', async () => {
    const user = await createUser('a@example.com', 'member');
    const current = await createSession(db, user.id);
    await createSession(db, user.id);
    const cookie = `${sessionCookieName()}=${current.token}`;
    const response = await routes.revokeMine.POST(request('POST', '/api/sessions/revoke-mine', {}, cookie));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: 1 });
    expect(await findSession(db, current.token)).not.toBeNull();
  });

  it('POST /api/sessions/:id/revoke: 200 revoca, 404 si no existe, 403 si no es SuperAdmin', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const member = await createUser('m@example.com', 'member');
    const adminCookie = `${sessionCookieName()}=${(await createSession(db, admin.id)).token}`;
    const memberCookie = `${sessionCookieName()}=${(await createSession(db, member.id)).token}`;
    const victim = await createSession(db, member.id);
    const victimId = (await findSession(db, victim.token))!.id;

    const forbidden = await routes.revoke.POST(request('POST', `/api/sessions/${victimId}/revoke`, {}, memberCookie), { params: Promise.resolve({ id: victimId }) });
    expect(forbidden.status).toBe(403);

    const ok = await routes.revoke.POST(request('POST', `/api/sessions/${victimId}/revoke`, {}, adminCookie), { params: Promise.resolve({ id: victimId }) });
    expect(ok.status).toBe(200);
    expect(await findSession(db, victim.token)).toBeNull();

    const missing = randomUUID();
    const notFound = await routes.revoke.POST(request('POST', `/api/sessions/${missing}/revoke`, {}, adminCookie), { params: Promise.resolve({ id: missing }) });
    expect(notFound.status).toBe(404);
  });

  it('GET /api/sessions devuelve las sesiones en orden createdAt descendente', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    await db.insert(schema.sessions).values([
      { userId: admin.id, tokenHash: randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000), createdAt: new Date('2026-01-01T00:00:00Z') },
      { userId: admin.id, tokenHash: randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000), createdAt: new Date('2026-03-01T00:00:00Z') },
      { userId: admin.id, tokenHash: randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000), createdAt: new Date('2026-02-01T00:00:00Z') },
    ]);
    const adminCookie = `${sessionCookieName()}=${(await createSession(db, admin.id)).token}`;
    const body = (await (await routes.list.GET(request('GET', '/api/sessions', undefined, adminCookie))).json()) as { createdAt: string }[];
    const dates = body.map((row) => row.createdAt);
    expect(dates).toEqual([...dates].sort((x, y) => y.localeCompare(x)));
  });

  it('revoke-mine por ruta no toca las sesiones de otro usuario', async () => {
    const a = await createUser('a@example.com', 'member');
    const b = await createUser('b@example.com', 'member');
    const current = await createSession(db, a.id);
    await createSession(db, a.id);
    const bToken = (await createSession(db, b.id)).token;
    const cookie = `${sessionCookieName()}=${current.token}`;
    const response = await routes.revokeMine.POST(request('POST', '/api/sessions/revoke-mine', {}, cookie));
    expect(await response.json()).toEqual({ revoked: 1 });
    expect(await findSession(db, current.token)).not.toBeNull();
    expect(await findSession(db, bToken)).not.toBeNull();
  });
});
