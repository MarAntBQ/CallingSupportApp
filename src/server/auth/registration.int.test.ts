import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import type { MailMessage } from '@/server/mail/service';
import { verifyPassword } from './crypto';
import { createSession, findSession } from './sessions';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');
const NEW_PASSWORD = randomBytes(12).toString('hex');
const EMAIL = 'ana.prueba@example.com';

const registerInput = {
  firstName: 'Ana',
  lastName: 'Prueba',
  email: EMAIL,
  phone: null,
  password: PASSWORD,
  privacyConsent: true as const,
  locale: 'pt' as const,
};

function post(path: string, body: unknown, ip = '203.0.113.7') {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'x-real-ip': ip },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!url)('registro y recuperación de contraseña contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let svc: typeof import('./registration');
  let routes: {
    register: typeof import('@/app/api/auth/register/route');
    verify: typeof import('@/app/api/auth/verify-otp/route');
    forgot: typeof import('@/app/api/auth/forgot-password/route');
    verifyReset: typeof import('@/app/api/auth/verify-reset-otp/route');
    reset: typeof import('@/app/api/auth/reset-password/route');
    login: typeof import('@/app/api/auth/login/route');
  };
  let sent: { source: string; message: MailMessage }[] = [];
  const mailer = async (source: string, message: MailMessage) => {
    sent.push({ source, message });
  };
  const lastCode = () => String(sent.at(-1)?.message.text).match(/\b(\d{6})\b/)?.[1] ?? '';
  const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');
  const user = async () => (await db.select().from(schema.users).where(eq(schema.users.email, EMAIL)))[0]!;

  async function openRegistration(allow = true) {
    await db
      .insert(schema.appConfig)
      .values({ id: 1, allowRegistration: allow, policyVersion: '2026-11' })
      .onConflictDoUpdate({ target: schema.appConfig.id, set: { allowRegistration: allow } });
  }

  async function registeredAndActive() {
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    expect(await svc.verifyOtp(db, { email: EMAIL, code: lastCode() }, { mailer })).toEqual({ ok: true });
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
    svc = await import('./registration');
    routes = {
      register: await import('@/app/api/auth/register/route'),
      verify: await import('@/app/api/auth/verify-otp/route'),
      forgot: await import('@/app/api/auth/forgot-password/route'),
      verifyReset: await import('@/app/api/auth/verify-reset-otp/route'),
      reset: await import('@/app/api/auth/reset-password/route'),
      login: await import('@/app/api/auth/login/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    sent = [];
    await db.execute(sql`truncate table sessions, users, installation, app_config, rate_limits, email_log restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('con el registro cerrado responde 403 y no crea nada', async () => {
    await openRegistration(false);
    expect((await routes.register.POST(post('/api/auth/register', registerInput))).status).toBe(403);
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it('exige la casilla del aviso de datos (sin premarcar) y guarda la evidencia del consentimiento', async () => {
    await openRegistration();
    const response = await routes.register.POST(post('/api/auth/register', { ...registerInput, privacyConsent: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toContain('privacyConsent');
    expect((await routes.register.POST(post('/api/auth/register', registerInput))).status).toBe(201);
    expect(await user()).toMatchObject({
      status: 'pending',
      locale: 'pt',
      consentPolicyVersion: '2026-11',
      consentLocale: 'pt',
      email: EMAIL,
    });
    expect((await user()).consentAt).toBeInstanceOf(Date);
  });

  it('crea el usuario pendiente con rol Miembro, guarda el hash del código (nunca el código) y lo envía en su idioma', async () => {
    await openRegistration();
    expect(await svc.register(db, registerInput, { mailer })).toEqual({ ok: true });
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(sent[0]).toMatchObject({ source: 'auth-register', message: { to: EMAIL, subject: 'Seu código para ativar a conta' } });
    expect(sent[0]!.message.subject).not.toContain(code);
    const row = await user();
    expect(row.otpHash).toBeTruthy();
    expect(row.otpHash).not.toContain(code);
    expect(JSON.stringify(row)).not.toContain(`"${code}"`);
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, row.roleId));
    expect(role!.key).toBe('member');
  });

  it('un correo que ya existe responde 400 email_taken', async () => {
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    const response = await routes.register.POST(post('/api/auth/register', { ...registerInput, email: 'ANA.PRUEBA@EXAMPLE.COM' }));
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: 'email', code: 'email_taken' }]);
  });

  it('flujo completo: registro → código → la cuenta queda activa → login', async () => {
    await registeredAndActive();
    expect((await user()).status).toBe('active');
    expect((await user()).otpHash).toBeNull();
    const login = await routes.login.POST(post('/api/auth/login', { email: EMAIL, password: PASSWORD }));
    expect(login.status).toBe(200);
  });

  it('un código ya usado no sirve otra vez', async () => {
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    const code = lastCode();
    expect(await svc.verifyOtp(db, { email: EMAIL, code }, { mailer })).toEqual({ ok: true });
    expect(await svc.verifyOtp(db, { email: EMAIL, code }, { mailer })).toEqual({ ok: false, reason: 'already_active' });
  });

  it('el tercer código erróneo genera y envía uno nuevo; el viejo deja de servir', async () => {
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    const first = lastCode();
    expect(await svc.verifyOtp(db, { email: EMAIL, code: wrongCode(first) }, { mailer })).toEqual({ ok: false, reason: 'wrong_code', remaining: 2 });
    expect(await svc.verifyOtp(db, { email: EMAIL, code: wrongCode(first) }, { mailer })).toEqual({ ok: false, reason: 'wrong_code', remaining: 1 });
    expect(await svc.verifyOtp(db, { email: EMAIL, code: wrongCode(first) }, { mailer })).toEqual({ ok: false, reason: 'code_renewed' });
    expect(sent).toHaveLength(2);
    expect(sent[1]!.source).toBe('auth-verify-otp');
    const second = lastCode();
    expect((await user()).otpTries).toBe(0);
    if (second !== first) {
      expect(await svc.verifyOtp(db, { email: EMAIL, code: first }, { mailer })).toMatchObject({ reason: 'wrong_code' });
    }
    expect(await svc.verifyOtp(db, { email: EMAIL, code: second }, { mailer })).toEqual({ ok: true });
  });

  it('verify-otp: 404 si no existe; 400 con los intentos que quedan', async () => {
    expect((await routes.verify.POST(post('/api/auth/verify-otp', { email: 'nadie@example.com', code: '123456' }))).status).toBe(404);
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    const response = await routes.verify.POST(post('/api/auth/verify-otp', { email: EMAIL, code: wrongCode(lastCode()) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_input', fields: ['code'], issues: [{ field: 'code', code: 'wrong_code' }], remaining: 2 });
  });

  it('"olvidé mi contraseña" responde igual exista o no el correo, y solo envía a usuarios activos', async () => {
    await registeredAndActive();
    sent = [];
    const existing = await routes.forgot.POST(post('/api/auth/forgot-password', { email: EMAIL }));
    const missing = await routes.forgot.POST(post('/api/auth/forgot-password', { email: 'nadie@example.com' }));
    expect([existing.status, await existing.text()]).toEqual([missing.status, await missing.text()]);
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    await svc.forgotPassword(db, { email: 'nadie@example.com' }, { mailer });
    expect(sent.map((entry) => entry.source)).toEqual(['auth-forgot-password']);
    expect((await user()).resetOtpHash).toBeTruthy();
  });

  it('"olvidé mi contraseña" ejecuta la misma única sentencia exista o no la cuenta (sin oráculo de tiempo)', async () => {
    await registeredAndActive();
    const statements: string[] = [];
    const spy = new Proxy(db, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          statements.push(String(prop));
          return value.apply(target, args);
        };
      },
    }) as Database;
    const calls: string[] = [];
    await svc.forgotPassword(spy, { email: EMAIL }, { mailer: async (source) => void calls.push(source) });
    const existing = [...statements];
    statements.length = 0;
    await svc.forgotPassword(spy, { email: 'nadie@example.com' }, { mailer: async (source) => void calls.push(source) });
    expect(statements).toEqual(existing);
    expect(existing).toEqual(['update']);
    expect(calls).toEqual(['auth-forgot-password']);
  });

  it('restablecer: código → token → contraseña nueva; las sesiones abiertas dejan de servir', async () => {
    await registeredAndActive();
    const { token: sessionToken } = await createSession(db, (await user()).id);
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    const verified = await svc.verifyResetOtp(db, { email: EMAIL, code: lastCode() });
    expect(verified.ok).toBe(true);
    const token = (verified as { token: string }).token;
    expect((await user()).resetTokenHash).not.toContain(token);
    expect(await svc.resetPassword(db, { email: EMAIL, token, newPassword: NEW_PASSWORD }, { mailer })).toEqual({ ok: true });
    expect(await verifyPassword(NEW_PASSWORD, (await user()).passwordHash)).toBe(true);
    expect(await findSession(db, sessionToken)).toBeNull();
    expect(await db.select().from(schema.sessions).where(isNull(schema.sessions.revokedAt))).toHaveLength(0);
    expect(sent.at(-1)!.source).toBe('auth-reset-password');
    expect(await svc.resetPassword(db, { email: EMAIL, token, newPassword: PASSWORD }, { mailer })).toEqual({ ok: false });
  });

  it('restablecer 16 minutos después de verificar el código falla (reloj simulado)', async () => {
    await registeredAndActive();
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    const verifiedAt = new Date('2026-10-07T10:00:00Z');
    const verified = (await svc.verifyResetOtp(db, { email: EMAIL, code: lastCode() }, { now: verifiedAt })) as { token: string };
    const late = new Date(verifiedAt.getTime() + 16 * 60 * 1000);
    expect(await svc.resetPassword(db, { email: EMAIL, token: verified.token, newPassword: NEW_PASSWORD }, { mailer, now: late })).toEqual({ ok: false });
    const inTime = new Date(verifiedAt.getTime() + 14 * 60 * 1000);
    expect(await svc.resetPassword(db, { email: EMAIL, token: verified.token, newPassword: NEW_PASSWORD }, { mailer, now: inTime })).toEqual({ ok: true });
  });

  it('sin el token del código verificado, conocer el correo no basta para cambiar la contraseña', async () => {
    await registeredAndActive();
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    await svc.verifyResetOtp(db, { email: EMAIL, code: lastCode() });
    const forged = randomBytes(32).toString('base64url');
    const response = await routes.reset.POST(post('/api/auth/reset-password', { email: EMAIL, token: forged, newPassword: NEW_PASSWORD }));
    expect(response.status).toBe(400);
    expect(await verifyPassword(PASSWORD, (await user()).passwordHash)).toBe(true);
  });

  it('código de recuperación: sin pendiente → no_pending_code; el tercer error lo borra; un código usado no sirve otra vez', async () => {
    await registeredAndActive();
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code: '123456' })).toEqual({ ok: false, reason: 'no_pending_code' });
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    const code = lastCode();
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code: wrongCode(code) })).toEqual({ ok: false, reason: 'wrong_code', remaining: 2 });
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code: wrongCode(code) })).toEqual({ ok: false, reason: 'wrong_code', remaining: 1 });
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code: wrongCode(code) })).toEqual({ ok: false, reason: 'too_many_tries' });
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code })).toEqual({ ok: false, reason: 'no_pending_code' });
    await svc.forgotPassword(db, { email: EMAIL }, { mailer });
    const fresh = lastCode();
    expect((await svc.verifyResetOtp(db, { email: EMAIL, code: fresh })).ok).toBe(true);
    expect(await svc.verifyResetOtp(db, { email: EMAIL, code: fresh })).toEqual({ ok: false, reason: 'no_pending_code' });
  });

  it('límite de intentos: verify-otp y forgot-password responden 429 con Retry-After', async () => {
    await openRegistration();
    await svc.register(db, registerInput, { mailer });
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) last = await routes.verify.POST(post('/api/auth/verify-otp', { email: EMAIL, code: '000000' }));
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toBeTruthy();
    for (let i = 0; i < 6; i++) last = await routes.forgot.POST(post('/api/auth/forgot-password', { email: 'otra@example.com' }, '198.51.100.9'));
    expect(last!.status).toBe(429);
    for (let i = 0; i < 11; i++) last = await routes.verifyReset.POST(post('/api/auth/verify-reset-otp', { email: 'tercera@example.com', code: '000000' }, '198.51.100.10'));
    expect(last!.status).toBe(429);
  }, 60_000);
});
