import { randomBytes } from 'node:crypto';
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
import { decrypt } from '@/server/crypto/aes';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const SMTP_PASSWORD = randomBytes(12).toString('hex');

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

describe.skipIf(!url)('correo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let mail: typeof import('./service');
  let routes: {
    smtp: typeof import('@/app/api/config/smtp/route');
    test: typeof import('@/app/api/config/smtp/test/route');
    logs: typeof import('@/app/api/mail/logs/route');
    cron: typeof import('@/app/api/cron/daily/route');
  };

  async function cookieFor(roleKey: string, email: string) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, roleKey));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword('x'.repeat(12)), roleId: role!.id, status: 'active' })
      .returning();
    const { token } = await createSession(db, user!.id);
    return `${sessionCookieName()}=${token}`;
  }

  async function configureSmtp(cookie: string, overrides: Record<string, unknown> = {}) {
    return routes.smtp.POST(
      request('POST', '/api/config/smtp', { host: '127.0.0.1', port: 1, secure: false, user: 'avisos@example.com', password: SMTP_PASSWORD, ...overrides }, cookie),
    );
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "test": esta prueba la vacía.');
    }
    process.env.DATABASE_URL = url;
    process.env.ENC_KEY = randomBytes(32).toString('hex');
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    await admin.end();
    pool = new Pool({ connectionString: url, max: 1 });
    db = drizzle(pool, { schema });
    mail = await import('./service');
    routes = {
      smtp: await import('@/app/api/config/smtp/route'),
      test: await import('@/app/api/config/smtp/test/route'),
      logs: await import('@/app/api/mail/logs/route'),
      cron: await import('@/app/api/cron/daily/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits, email_log restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('sin SMTP configurado devuelve { sent: false } y lo registra como fallido', async () => {
    const result = await mail.sendMail('prueba', { to: 'ana@example.com', subject: 'Asunto', html: '<p>Cuerpo secreto</p>' }, { db });
    expect(result).toEqual({ sent: false, error: 'smtp_not_configured' });
    const [row] = await db.select().from(schema.emailLog);
    expect(row).toMatchObject({ source: 'prueba', emailTo: 'ana@example.com', emailSubject: 'Asunto', success: false, errorMessage: 'smtp_not_configured' });
  });

  it('con el SMTP caído (puerto cerrado) no lanza: registra el error', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    expect((await configureSmtp(admin)).status).toBe(200);
    const result = await mail.sendMail('prueba', { to: 'ana@example.com', subject: 'Asunto', html: '<p>x</p>' }, { db, timeoutMs: 5_000 });
    expect(result.sent).toBe(false);
    expect(result.error).toBeTruthy();
    const [row] = await db.select().from(schema.emailLog);
    expect(row).toMatchObject({ success: false });
    expect(row!.errorMessage).toBeTruthy();
  }, 20_000);

  it('un transporte que lanza tampoco hace fallar la operación', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await configureSmtp(admin);
    const result = await mail.sendMail(
      'prueba',
      { to: 'ana@example.com', subject: 'Asunto' },
      { db, transport: () => ({ sendMail: async () => Promise.reject(new Error('550 buzón inexistente')) }) },
    );
    expect(result).toEqual({ sent: false, error: '550 buzón inexistente' });
  });

  it('envía con la plantilla, el remitente de la unidad y registra el éxito sin guardar el cuerpo', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await configureSmtp(admin);
    await db.update(schema.appConfig).set({ unitName: 'Barrio de Prueba' });
    const sent: Record<string, unknown>[] = [];
    const result = await mail.sendMail(
      'prueba',
      { to: 'ana@example.com', subject: 'Asunto', html: '<p>Cuerpo secreto</p>', locale: 'pt' },
      {
        db,
        transport: (settings) => {
          expect(settings.password).toBe(SMTP_PASSWORD);
          return { sendMail: async (message) => (sent.push(message as Record<string, unknown>), {} as never) };
        },
      },
    );
    expect(result).toEqual({ sent: true });
    expect(sent[0]).toMatchObject({ to: 'ana@example.com', subject: 'Asunto', from: { name: 'Barrio de Prueba', address: 'avisos@example.com' } });
    expect(String(sent[0]!.html)).toContain('Atenciosamente, Barrio de Prueba');
    expect(String(sent[0]!.html)).toContain('<p>Cuerpo secreto</p>');
    const rows = await db.execute(sql`select * from email_log`);
    expect(rows.rows).toHaveLength(1);
    expect(JSON.stringify(rows.rows)).not.toContain('Cuerpo secreto');
    expect(Object.keys(rows.rows[0]!).sort()).toEqual(['created_at', 'email_subject', 'email_to', 'error_message', 'id', 'source', 'success']);
  });

  it('un destinatario inválido o un asunto con saltos de línea no se envían ni lanzan', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await configureSmtp(admin);
    let calls = 0;
    const transport = () => ({ sendMail: async () => ((calls += 1), {} as never) });
    for (const message of [
      { to: 'no-es-correo', subject: 'Asunto' },
      { to: 'ana@example.com\r\nBcc: otro@example.com', subject: 'Asunto' },
      { to: 'ana@example.com', subject: 'Asunto\r\nBcc: otro@example.com' },
    ]) {
      expect(await mail.sendMail('prueba', message, { db, transport })).toEqual({ sent: false, error: 'invalid_message' });
    }
    expect(calls).toBe(0);
    const rows = await db.select().from(schema.emailLog);
    expect(rows.every((row) => row.errorMessage === 'invalid_message' && !/[\r\n]/.test(row.emailTo + row.emailSubject))).toBe(true);
  });

  it('GET /api/cron/daily: sin CRON_SECRET o con un secreto equivocado responde 401 y no purga; con el correcto purga los vencidos', async () => {
    const day = 24 * 60 * 60 * 1000;
    await db.insert(schema.emailLog).values([
      { source: 'viejo', emailTo: 'a@example.com', emailSubject: 'Viejo', success: true, createdAt: new Date(Date.now() - 181 * day) },
      { source: 'reciente', emailTo: 'b@example.com', emailSubject: 'Reciente', success: true, createdAt: new Date(Date.now() - 179 * day) },
    ]);
    const cron = (authorization?: string) =>
      routes.cron.GET(new Request('http://localhost/api/cron/daily', { headers: authorization ? { authorization } : {} }));
    const secret = randomBytes(32).toString('hex');
    delete process.env.CRON_SECRET;
    expect((await cron(`Bearer ${secret}`)).status).toBe(401);
    expect((await cron('Bearer ')).status).toBe(401);
    process.env.CRON_SECRET = secret;
    expect((await cron()).status).toBe(401);
    expect((await cron(`Bearer ${secret}x`)).status).toBe(401);
    expect((await cron(secret)).status).toBe(401);
    expect(await db.select().from(schema.emailLog)).toHaveLength(2);
    const response = await cron(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedEmailLogs: 1 });
    expect((await db.select().from(schema.emailLog)).map((row) => row.source)).toEqual(['reciente']);
  });

  it('al consultar el registro también se borran los vencidos (180 días)', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await db.insert(schema.emailLog).values({
      source: 'viejo',
      emailTo: 'a@example.com',
      emailSubject: 'Viejo',
      success: true,
      createdAt: new Date(Date.now() - 181 * 24 * 60 * 60 * 1000),
    });
    expect(await (await routes.logs.GET(request('GET', '/api/mail/logs', undefined, admin))).json()).toEqual([]);
    expect(await db.select().from(schema.emailLog)).toHaveLength(0);
  });

  it('cada registro se borra a los 180 días: al escribir uno nuevo, se borran los vencidos', async () => {
    const day = 24 * 60 * 60 * 1000;
    await db.insert(schema.emailLog).values([
      { source: 'viejo', emailTo: 'a@example.com', emailSubject: 'Viejo', success: true, createdAt: new Date(Date.now() - 181 * day) },
      { source: 'reciente', emailTo: 'b@example.com', emailSubject: 'Reciente', success: true, createdAt: new Date(Date.now() - 179 * day) },
    ]);
    await mail.sendMail('nuevo', { to: 'c@example.com', subject: 'Nuevo' }, { db });
    const sources = (await db.select().from(schema.emailLog)).map((row) => row.source).sort();
    expect(sources).toEqual(['nuevo', 'reciente']);
  });

  it('la contraseña SMTP se guarda cifrada y ningún endpoint la devuelve', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    const saved = await configureSmtp(admin);
    expect(await saved.json()).toEqual({ host: '127.0.0.1', port: 1, secure: false, user: 'avisos@example.com', hasPassword: true });
    const [row] = await db.select().from(schema.appConfig);
    expect(row!.smtpPasswordEnc).not.toContain(SMTP_PASSWORD);
    expect(decrypt(row!.smtpPasswordEnc!)).toBe(SMTP_PASSWORD);

    const summary = await routes.smtp.GET(request('GET', '/api/config/smtp', undefined, admin));
    const text = await summary.text();
    expect(JSON.parse(text)).toEqual({ host: '127.0.0.1', port: 1, secure: false, user: 'avisos@example.com', hasPassword: true });
    expect(text).not.toContain(SMTP_PASSWORD);
    expect(text).not.toContain(row!.smtpPasswordEnc!);
    const publicConfig = await (await import('@/app/api/config/route')).GET(request('GET', '/api/config'));
    expect(await publicConfig.text()).not.toMatch(/smtp|password/i);
  });

  it('sin password conserva la guardada; port fuera de rango o host inválido → 400', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await configureSmtp(admin);
    const [before] = await db.select().from(schema.appConfig);
    const update = await routes.smtp.POST(
      request('POST', '/api/config/smtp', { host: 'smtp.example.com', port: 465, secure: true, user: 'avisos@example.com' }, admin),
    );
    expect(update.status).toBe(200);
    const [after] = await db.select().from(schema.appConfig);
    expect(after!.smtpPasswordEnc).toBe(before!.smtpPasswordEnc);
    expect(after).toMatchObject({ smtpHost: 'smtp.example.com', smtpPort: 465, smtpSecure: true });
    for (const body of [{ port: 0 }, { port: 70000 }, { host: 'http://smtp.example.com' }, { host: 'smtp example.com' }]) {
      expect((await configureSmtp(admin, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('un usuario sin SuperAdmin recibe 403 en todos los endpoints de correo; sin sesión, 401', async () => {
    const member = await cookieFor('leader', 'lider@example.com');
    expect((await routes.smtp.GET(request('GET', '/api/config/smtp', undefined, member))).status).toBe(403);
    expect((await configureSmtp(member)).status).toBe(403);
    expect((await routes.test.POST(request('POST', '/api/config/smtp/test', { to: 'ana@example.com' }, member))).status).toBe(403);
    expect((await routes.logs.GET(request('GET', '/api/mail/logs', undefined, member))).status).toBe(403);
    expect((await routes.logs.GET(request('GET', '/api/mail/logs'))).status).toBe(401);
    expect(await db.select().from(schema.appConfig)).toHaveLength(0);
  });

  it('el correo de prueba con un host inválido responde 400 con el error y queda como fallido', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    await configureSmtp(admin, { host: 'no-existe.invalid', port: 587 });
    const response = await routes.test.POST(request('POST', '/api/config/smtp/test', { to: 'ana@example.com' }, admin));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('smtp_failed');
    expect(body.message).toBeTruthy();
    const [row] = await db.select().from(schema.emailLog);
    expect(row).toMatchObject({ source: 'smtp-test', emailTo: 'ana@example.com', success: false });
  }, 30_000);

  it('GET /api/mail/logs devuelve del más nuevo al más viejo, como máximo 200', async () => {
    const admin = await cookieFor('super_admin', 'admin@example.com');
    const base = Date.now();
    await db.insert(schema.emailLog).values(
      Array.from({ length: 205 }, (_, i) => ({
        source: 'prueba',
        emailTo: `p${i}@example.com`,
        emailSubject: `Asunto ${i}`,
        success: i % 2 === 0,
        createdAt: new Date(base + i * 1000),
      })),
    );
    const logs = await (await routes.logs.GET(request('GET', '/api/mail/logs', undefined, admin))).json();
    expect(logs).toHaveLength(200);
    expect(logs[0].emailSubject).toBe('Asunto 204');
    expect(logs[199].emailSubject).toBe('Asunto 5');
  });
});
