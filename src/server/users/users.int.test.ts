import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import type { MailMessage } from '@/server/mail/service';
import { createUser, listUsers, resetPassword, updateUser } from '@/server/users/users';

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

describe.skipIf(!url)('usuarios y consejo de barrio contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let route: typeof import('@/app/api/users/route');

  async function roleId(key: string) {
    const [role] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.key, key));
    return role!.id;
  }

  async function createRawUser(email: string, key: string) {
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: await roleId(key), status: 'active' })
      .returning();
    return user!;
  }

  function capturingMailer() {
    const sent: { source: string; message: MailMessage }[] = [];
    return { sent, mailer: async (source: string, message: MailMessage) => void sent.push({ source, message }) };
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
    route = await import('@/app/api/users/route');
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table user_callings, module_permissions, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('crear un usuario envía "Establece tu contraseña" y NO manda ninguna contraseña por correo', async () => {
    const { sent, mailer } = capturingMailer();
    const result = await createUser(db, { firstName: 'Luis', lastName: 'Líder', email: 'lider@example.com', roleId: await roleId('leader') }, { baseUrl: 'http://localhost', mailer });
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.source).toBe('users-invite');
    expect(sent[0]!.message.html).toContain('/forgot-password?email=lider%40example.com');
    // el correo lleva solo un enlace, nunca el valor de la contraseña (el hash guardado no aparece)
    const [credential] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.email, 'lider@example.com'));
    expect(sent[0]!.message.html ?? '').not.toContain(credential!.hash);
    expect(sent[0]!.message.text ?? '').not.toContain(credential!.hash);
  });

  it('con rol Miembro el servidor guarda [] aunque reciba llamamientos', async () => {
    const [org] = await db.insert(schema.organizations).values({ name: 'Presidencia' }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: org!.id, name: 'Secretario' }).returning();
    const { mailer } = capturingMailer();
    const result = await createUser(db, { firstName: 'María', lastName: 'Miembro', email: 'miembro@example.com', roleId: await roleId('member'), callingIds: [calling!.id] }, { baseUrl: 'http://localhost', mailer });
    expect(result.ok).toBe(true);
    const assigned = await db.select().from(schema.userCallings);
    expect(assigned).toHaveLength(0);
  });

  it('suspender a un usuario con sesión abierta revoca sus sesiones', async () => {
    const user = await createRawUser('susp@example.com', 'leader');
    await createSession(db, user.id);
    const live = await db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));
    expect(live).toHaveLength(1);
    const result = await updateUser(db, user.id, { status: 'suspended' });
    expect(result.ok).toBe(true);
    const stillLive = await db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));
    expect(stillLive).toHaveLength(0);
  });

  it('restablecer la contraseña devuelve una temporal (una vez) y revoca las sesiones', async () => {
    const user = await createRawUser('reset@example.com', 'leader');
    await createSession(db, user.id);
    const before = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
    const result = await resetPassword(db, user.id);
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.password).toHaveLength(14);
    const after = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
    expect(after[0]!.hash).not.toBe(before[0]!.hash);
    const live = await db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));
    expect(live).toHaveLength(0);
  });

  it('el listado no expone el hash de contraseña ni los códigos', async () => {
    await createRawUser('ver@example.com', 'leader');
    const list = await listUsers(db);
    expect(list).toHaveLength(1);
    const json = JSON.stringify(list[0]);
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('otpHash');
    expect(json).not.toContain('resetTokenHash');
    expect(list[0]!.telegramLinked).toBe(false);
  });

  it('GET /api/users: sin permiso del módulo users, 403', async () => {
    const member = await createRawUser('sinpermiso@example.com', 'member');
    const { token } = await createSession(db, member.id);
    const response = await route.GET(request('GET', '/api/users', undefined, `${sessionCookieName()}=${token}`), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
  });
});
