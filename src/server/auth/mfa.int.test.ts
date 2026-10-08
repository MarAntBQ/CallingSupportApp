import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Secret, TOTP } from 'otpauth';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/server/auth/crypto';
import type { Mailer } from '@/server/auth/registration';
import { createSession, findSession, sessionCookieName, type Session } from '@/server/auth/sessions';
import { decrypt } from '@/server/crypto/aes';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');
const T0 = new Date('2026-10-08T12:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function codeAt(secret: string, when: Date) {
  return new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: when.getTime() });
}

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!url)('verificación en dos pasos contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let mfa: typeof import('@/server/auth/mfa');
  let routes: {
    login: typeof import('@/app/api/auth/login/route');
    verify: typeof import('@/app/api/auth/mfa/verify/route');
    me: typeof import('@/app/api/auth/me/route');
    dashboard: typeof import('@/app/api/dashboard/route');
    setup: typeof import('@/app/api/auth/mfa/setup/route');
    reset: typeof import('@/app/api/users/[id]/mfa/reset/route');
  };

  async function createUser(email: string, role: 'super_admin' | 'leader' | 'member') {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, status: 'active' })
      .returning();
    return user!;
  }

  async function sessionFor(userId: string) {
    const { token } = await createSession(db, userId);
    return { session: (await findSession(db, token)) as Session, cookie: `${sessionCookieName()}=${token}` };
  }

  // Activa la verificación a las T0 y devuelve el secreto en claro (como lo ve el usuario en su app).
  async function enableFor(userId: string, mailer?: Mailer) {
    const { session } = await sessionFor(userId);
    const { secret } = await mfa.startMfaSetup(db, session, 'Barrio de Prueba');
    const result = await mfa.enableMfa(db, session, codeAt(secret, T0), { now: T0, mailer });
    if (!result.ok) throw new Error(result.error);
    return { secret, codes: result.codes, session };
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) throw new Error('TEST_DATABASE_URL debe contener "test"');
    process.env.DATABASE_URL = url;
    process.env.ENC_KEY = process.env.ENC_KEY ?? randomBytes(32).toString('hex');
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;');
    await migrate(drizzle(admin), { migrationsFolder: MIGRATIONS });
    await admin.end();
    pool = new Pool({ connectionString: url, max: 2 });
    db = drizzle(pool, { schema });
    mfa = await import('@/server/auth/mfa');
    routes = {
      login: await import('@/app/api/auth/login/route'),
      verify: await import('@/app/api/auth/mfa/verify/route'),
      me: await import('@/app/api/auth/me/route'),
      dashboard: await import('@/app/api/dashboard/route'),
      setup: await import('@/app/api/auth/mfa/setup/route'),
      reset: await import('@/app/api/users/[id]/mfa/reset/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(
      sql`truncate table mfa_challenges, user_recovery_codes, sessions, rate_limits, user_callings, module_permissions, callings, organizations, users restart identity cascade`,
    );
    await db.update(schema.appConfig).set({ requireMfaForLeaders: false });
    delete process.env.APP_ENV;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('un SuperAdmin sin verificación recibe 403 mfa_required en el panel, pero puede ver quién es y empezar la activación', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { cookie } = await sessionFor(admin.id);

    const blocked = await routes.dashboard.GET(request('GET', '/api/dashboard', undefined, cookie));
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'mfa_required' });

    expect((await routes.me.GET(request('GET', '/api/auth/me', undefined, cookie))).status).toBe(200);
    const setup = await routes.setup.POST(request('POST', '/api/auth/mfa/setup', undefined, cookie));
    expect(setup.status).toBe(200);
    const body = await setup.json();
    expect(body.qrSvg).toMatch(/^<svg/);
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('activar muestra 10 códigos una sola vez; el secreto queda cifrado y los códigos como hash', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const mailer = vi.fn<Mailer>(async () => undefined);
    const { secret, codes, session } = await enableFor(admin.id, mailer);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, admin.id));
    expect(row!.mfaEnabled).toBe(true);
    expect(row!.mfaSecretEnc).not.toContain(secret);
    expect(decrypt(row!.mfaSecretEnc!)).toBe(secret);
    const stored = await db.select().from(schema.userRecoveryCodes).where(eq(schema.userRecoveryCodes.userId, admin.id));
    expect(stored).toHaveLength(10);
    for (const { codeHash } of stored) {
      expect(codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(codes).not.toContain(codeHash);
    }
    expect(mailer).toHaveBeenCalledWith('auth-mfa-enabled', expect.objectContaining({ to: 'admin@example.com' }));
    expect(JSON.stringify(mailer.mock.calls)).not.toContain(secret);

    // Después de activarla, ni el QR ni el secreto se vuelven a entregar.
    await expect(mfa.startMfaSetup(db, session, '')).rejects.toMatchObject({ status: 409, code: 'mfa_already_enabled' });
    const setupAgain = await routes.setup.POST(request('POST', '/api/auth/mfa/setup', undefined, (await sessionFor(admin.id)).cookie));
    expect(setupAgain.status).toBe(409);
  });

  it('activar con un código incorrecto no activa nada', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { session } = await sessionFor(admin.id);
    await mfa.startMfaSetup(db, session, '');
    expect(await mfa.enableMfa(db, session, '000000', { now: T0 })).toEqual({ ok: false, error: 'invalid_code' });
    const [row] = await db.select({ enabled: schema.users.mfaEnabled }).from(schema.users).where(eq(schema.users.id, admin.id));
    expect(row!.enabled).toBe(false);
  });

  it('con la verificación activa, la contraseña correcta no crea sesión hasta enviar el código', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    await enableFor(admin.id);
    const before = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, admin.id));

    const login = await routes.login.POST(request('POST', '/api/auth/login', { email: 'admin@example.com', password: PASSWORD }));
    expect(login.status).toBe(200);
    const body = await login.json();
    expect(body).toEqual({ mfaRequired: true, challengeId: expect.any(String) });
    expect(login.headers.get('set-cookie')).toBeNull();
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, admin.id))).toHaveLength(before.length);
  });

  it('acepta el código del paso anterior y del siguiente (±1), no el de dos pasos atrás', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const now = at(600);
    const challenge = () => mfa.createMfaChallenge(db, admin.id, false, now);

    expect((await mfa.verifyMfaChallenge(db, { challengeId: await challenge(), code: codeAt(secret, at(570)) }, { now })).ok).toBe(true);
    expect((await mfa.verifyMfaChallenge(db, { challengeId: await challenge(), code: codeAt(secret, at(630)) }, { now })).ok).toBe(true);
    expect(await mfa.verifyMfaChallenge(db, { challengeId: await challenge(), code: codeAt(secret, at(540)) }, { now })).toEqual({
      ok: false,
      error: 'invalid_code',
    });
  });

  it('el mismo código usado dos veces seguidas falla la segunda vez (reloj simulado)', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const now = at(300);
    const code = codeAt(secret, now);

    const first = await mfa.verifyMfaChallenge(db, { challengeId: await mfa.createMfaChallenge(db, admin.id, false, now), code }, { now });
    expect(first.ok).toBe(true);
    const later = at(310);
    const second = await mfa.verifyMfaChallenge(db, { challengeId: await mfa.createMfaChallenge(db, admin.id, false, later), code }, { now: later });
    expect(second).toEqual({ ok: false, error: 'invalid_code' });
  });

  it('el código de activación tampoco sirve para entrar en el mismo paso de tiempo', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const result = await mfa.verifyMfaChallenge(
      db,
      { challengeId: await mfa.createMfaChallenge(db, admin.id, false, T0), code: codeAt(secret, T0) },
      { now: at(5) },
    );
    expect(result).toEqual({ ok: false, error: 'invalid_code' });
  });

  it('un código de recuperación sirve una sola vez y avisa por correo', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { codes } = await enableFor(admin.id);
    const mailer = vi.fn<Mailer>(async () => undefined);
    const now = at(60);

    const first = await mfa.verifyMfaChallenge(
      db,
      { challengeId: await mfa.createMfaChallenge(db, admin.id, false, now), recoveryCode: codes[0]!.toUpperCase() },
      { now, mailer },
    );
    expect(first).toMatchObject({ ok: true, factor: 'recovery' });
    expect(mailer).toHaveBeenCalledWith('auth-mfa-recovery-used', expect.objectContaining({ to: 'admin@example.com' }));

    const second = await mfa.verifyMfaChallenge(
      db,
      { challengeId: await mfa.createMfaChallenge(db, admin.id, false, now), recoveryCode: codes[0]! },
      { now },
    );
    expect(second).toEqual({ ok: false, error: 'invalid_code' });
  });

  it('el sexto intento fallido sobre un mismo reto responde 429 y el reto deja de servir', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const login = await routes.login.POST(request('POST', '/api/auth/login', { email: 'admin@example.com', password: PASSWORD }));
    const { challengeId } = await login.json();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const wrong = await routes.verify.POST(request('POST', '/api/auth/mfa/verify', { challengeId, code: '000000' }));
      expect(wrong.status, `intento ${attempt}`).toBe(400);
    }
    const sixth = await routes.verify.POST(request('POST', '/api/auth/mfa/verify', { challengeId, code: '000000' }));
    expect(sixth.status).toBe(429);

    const good = await routes.verify.POST(request('POST', '/api/auth/mfa/verify', { challengeId, code: codeAt(secret, new Date()) }));
    expect(good.status).toBe(400);
    expect(await good.json()).toEqual({ error: 'challenge_expired' });
  });

  it('un reto vencido (más de 5 minutos) responde challenge_expired', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const challengeId = await mfa.createMfaChallenge(db, admin.id, false, at(60));
    const late = at(60 + 5 * 60 + 1);
    expect(await mfa.verifyMfaChallenge(db, { challengeId, code: codeAt(secret, late) }, { now: late })).toEqual({
      ok: false,
      error: 'challenge_expired',
    });
  });

  it('el código correcto crea la sesión con la cookie y respeta "recordar mi sesión"', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret } = await enableFor(admin.id);
    const login = await routes.login.POST(request('POST', '/api/auth/login', { email: 'admin@example.com', password: PASSWORD, rememberMe: true }));
    const { challengeId } = await login.json();

    const verified = await routes.verify.POST(request('POST', '/api/auth/mfa/verify', { challengeId, code: codeAt(secret, new Date()) }));
    expect(verified.status).toBe(200);
    expect((await verified.json()).email).toBe('admin@example.com');
    const cookie = verified.headers.get('set-cookie')!;
    expect(cookie).toContain(sessionCookieName());
    expect(cookie).toMatch(/Expires=/i);
    const token = cookie.split(';')[0]!.split('=')[1]!;
    const session = await findSession(db, token);
    expect(session?.mfaEnabled).toBe(true);
    expect((await routes.dashboard.GET(request('GET', '/api/dashboard', undefined, `${sessionCookieName()}=${token}`))).status).toBe(200);
  });

  it('desactivar sin contraseña correcta o sin código válido falla; con ambos funciona (cuando no es obligatoria)', async () => {
    const leader = await createUser('lider@example.com', 'leader');
    const { secret, session } = await enableFor(leader.id);
    const now = at(120);

    expect(await mfa.disableMfa(db, session, { password: 'incorrecta', code: codeAt(secret, now) }, { now })).toEqual({
      ok: false,
      error: 'invalid_password',
    });
    expect(await mfa.disableMfa(db, session, { password: PASSWORD, code: '000000' }, { now })).toEqual({ ok: false, error: 'invalid_code' });
    expect(await mfa.disableMfa(db, session, { password: PASSWORD, code: codeAt(secret, now) }, { now })).toEqual({ ok: true });

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, leader.id));
    expect(row).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null });
    expect(await db.select().from(schema.userRecoveryCodes).where(eq(schema.userRecoveryCodes.userId, leader.id))).toHaveLength(0);
  });

  it('el SuperAdmin no puede desactivarla: es obligatoria', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const { secret, session } = await enableFor(admin.id);
    await expect(mfa.disableMfa(db, session, { password: PASSWORD, code: codeAt(secret, at(60)) }, { now: at(60) })).rejects.toMatchObject({
      status: 403,
      code: 'mfa_required',
    });
  });

  it('generar códigos nuevos invalida los anteriores', async () => {
    const leader = await createUser('lider@example.com', 'leader');
    const { secret, codes, session } = await enableFor(leader.id);
    const now = at(90);
    const fresh = await mfa.regenerateRecoveryCodes(db, session, codeAt(secret, now), { now });
    expect(fresh.ok).toBe(true);
    const old = await mfa.verifyMfaChallenge(
      db,
      { challengeId: await mfa.createMfaChallenge(db, leader.id, false, now), recoveryCode: codes[0]! },
      { now },
    );
    expect(old).toEqual({ ok: false, error: 'invalid_code' });
  });

  it('tras restablecer la verificación de un usuario, sus sesiones abiertas dejan de servir', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const leader = await createUser('lider@example.com', 'leader');
    await enableFor(admin.id);
    await enableFor(leader.id);
    const { cookie: leaderCookie } = await sessionFor(leader.id);
    expect((await routes.me.GET(request('GET', '/api/auth/me', undefined, leaderCookie))).status).toBe(200);

    const { cookie: adminCookie } = await sessionFor(admin.id);
    const reset = await routes.reset.POST(request('POST', `/api/users/${leader.id}/mfa/reset`, undefined, adminCookie), {
      params: Promise.resolve({ id: leader.id }),
    });
    expect(reset.status).toBe(204);
    expect((await routes.me.GET(request('GET', '/api/auth/me', undefined, leaderCookie))).status).toBe(401);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, leader.id));
    expect(row).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null });
  });

  it('el SuperAdmin no restablece la suya por esta vía, y un no-SuperAdmin no restablece a nadie', async () => {
    const admin = await createUser('admin@example.com', 'super_admin');
    const leader = await createUser('lider@example.com', 'leader');
    await enableFor(admin.id);
    await enableFor(leader.id);
    const { cookie: adminCookie } = await sessionFor(admin.id);
    const self = await routes.reset.POST(request('POST', `/api/users/${admin.id}/mfa/reset`, undefined, adminCookie), {
      params: Promise.resolve({ id: admin.id }),
    });
    expect(self.status).toBe(403);

    const { cookie: leaderCookie } = await sessionFor(leader.id);
    const other = await routes.reset.POST(request('POST', `/api/users/${admin.id}/mfa/reset`, undefined, leaderCookie), {
      params: Promise.resolve({ id: admin.id }),
    });
    expect(other.status).toBe(403);
  });

  it('obligatoriedad: un Líder con módulos solo la tiene recomendada, salvo que la instalación la exija', async () => {
    const leader = await createUser('lider@example.com', 'leader');
    const [organization] = await db.insert(schema.organizations).values({ name: 'Obispado' }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: organization!.id, name: 'Secretario' }).returning();
    await db.insert(schema.userCallings).values({ userId: leader.id, callingId: calling!.id });
    await db.insert(schema.modulePermissions).values({ callingId: calling!.id, module: 'temple-trips', canRead: true });
    const { session, cookie } = await sessionFor(leader.id);

    expect(await mfa.mfaStatus(db, session)).toEqual({ enabled: false, required: false, recommended: true, demo: false });
    await expect(mfa.assertMfaSatisfied(db, session)).resolves.toBeUndefined();
    expect((await routes.me.GET(request('GET', '/api/auth/me', undefined, cookie))).status).toBe(200);

    await mfa.setMfaPolicy(db, true);
    expect(await mfa.mfaStatus(db, session)).toEqual({ enabled: false, required: true, recommended: false, demo: false });
    await expect(mfa.assertMfaSatisfied(db, session)).rejects.toMatchObject({ status: 403, code: 'mfa_required' });

    const member = await createUser('miembro@example.com', 'member');
    const { session: memberSession } = await sessionFor(member.id);
    expect(await mfa.mfaStatus(db, memberSession)).toEqual({ enabled: false, required: false, recommended: false, demo: false });
  });

  it('en la demo (APP_ENV=demo) no se exige ni se puede activar', async () => {
    process.env.APP_ENV = 'demo';
    const admin = await createUser('admin@example.com', 'super_admin');
    const { session, cookie } = await sessionFor(admin.id);
    expect(await mfa.mfaStatus(db, session)).toEqual({ enabled: false, required: false, recommended: false, demo: true });
    expect((await routes.dashboard.GET(request('GET', '/api/dashboard', undefined, cookie))).status).toBe(200);
    const setup = await routes.setup.POST(request('POST', '/api/auth/mfa/setup', undefined, cookie));
    expect(setup.status).toBe(403);
    expect(await setup.json()).toEqual({ error: 'mfa_disabled_in_demo' });
  });
});
