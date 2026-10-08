import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/i18n/config';
import type { ModuleKey } from '@/lib/modules';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import type { MailMessage } from '@/server/mail/service';
import { notifyModuleEvent } from '@/server/notifications/service';
import { setModulePermissions } from '@/server/permissions/matrix';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

type RoleKey = 'super_admin' | 'leader' | 'member';
type Flags = { canRead?: boolean; canCreate?: boolean; canUpdate?: boolean; canDelete?: boolean; canNotify?: boolean };

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const row = (callingId: string, flags: Flags = {}) => ({
  callingId,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canNotify: false,
  ...flags,
});

describe.skipIf(!url)('matriz de permisos y avisos por módulo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    matrix: typeof import('@/app/api/module-permissions/route');
    moduleMatrix: typeof import('@/app/api/module-permissions/[module]/route');
    organization: typeof import('@/app/api/organizations/[id]/route');
  };

  async function createUser(email: string, role: RoleKey, extra: { locale?: Locale; firstName?: string; phone?: string } = {}) {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({
        firstName: extra.firstName ?? 'Ana',
        lastName: 'Prueba',
        email,
        phone: extra.phone ?? null,
        locale: extra.locale ?? null,
        passwordHash: await hashPassword(PASSWORD),
        roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100,
        status: 'active',
      })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  async function createCalling(organizationName: string, name: string) {
    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: organizationName })
      .onConflictDoNothing()
      .returning();
    const organizationId =
      organization?.id ??
      (await db.select().from(schema.organizations).where(eq(schema.organizations.name, organizationName)))[0]!.id;
    const [calling] = await db.insert(schema.callings).values({ organizationId, name }).returning();
    return { organizationId, callingId: calling!.id };
  }

  async function assign(userId: string, callingId: string) {
    await db.insert(schema.userCallings).values({ userId, callingId });
  }

  async function grant(module: ModuleKey, callingId: string, flags: Flags) {
    await db.insert(schema.modulePermissions).values({ module, callingId, ...flags });
  }

  function put(module: string, permissions: unknown[], cookie: string) {
    return routes.moduleMatrix.PUT(request('PUT', `/api/module-permissions/${module}`, { permissions }, cookie), {
      params: Promise.resolve({ module }),
    });
  }

  async function storedRows(module: ModuleKey) {
    return db
      .select({ callingId: schema.modulePermissions.callingId, canRead: schema.modulePermissions.canRead })
      .from(schema.modulePermissions)
      .where(eq(schema.modulePermissions.module, module));
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
      matrix: await import('@/app/api/module-permissions/route'),
      moduleMatrix: await import('@/app/api/module-permissions/[module]/route'),
      organization: await import('@/app/api/organizations/[id]/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`drop trigger if exists module_permissions_fail on module_permissions`);
    await db.execute(
      sql`truncate table module_permissions, user_callings, callings, organizations, sessions, users, rate_limits, email_log restart identity cascade`,
    );
    await db.update(schema.appConfig).set({ defaultLocale: 'es' });
  });

  afterAll(async () => {
    await db.execute(sql`drop trigger if exists module_permissions_fail on module_permissions`);
    await db.execute(sql`drop function if exists module_permissions_fail()`);
    await pool.end();
  });

  describe('GET /api/module-permissions', () => {
    it('sin el módulo permissions responde 403; el SuperAdmin recibe los 4 módulos con los llamamientos', async () => {
      const leader = await createUser('lider@example.com', 'leader');
      expect((await routes.matrix.GET(request('GET', '/api/module-permissions', undefined, await cookieFor(leader.id)))).status).toBe(403);

      const { callingId } = await createCalling('Obispado', 'Secretario');
      await grant('callings', callingId, { canRead: true, canNotify: true });
      const admin = await createUser('admin@example.com', 'super_admin');
      const response = await routes.matrix.GET(request('GET', '/api/module-permissions', undefined, await cookieFor(admin.id)));
      expect(response.status).toBe(200);
      const matrix = await response.json();
      expect(Object.keys(matrix)).toEqual(['temple-trips', 'users', 'callings', 'permissions']);
      expect(matrix.callings).toEqual([
        {
          callingId,
          callingName: 'Secretario',
          organizationName: 'Obispado',
          active: true,
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          canNotify: true,
        },
      ]);
      expect(matrix.users[0]).toMatchObject({ callingId, canRead: false, canNotify: false });
    });

    it('marca como inactivo el llamamiento desactivado o de una organización desactivada', async () => {
      const first = await createCalling('Obispado', 'Secretario');
      const second = await createCalling('Primaria', 'Presidenta');
      await db.update(schema.callings).set({ active: false }).where(eq(schema.callings.id, first.callingId));
      await db.update(schema.organizations).set({ active: false }).where(eq(schema.organizations.id, second.organizationId));
      const admin = await createUser('admin@example.com', 'super_admin');
      const matrix = await (await routes.matrix.GET(request('GET', '/api/module-permissions', undefined, await cookieFor(admin.id)))).json();
      expect(matrix.users.map((item: { active: boolean }) => item.active)).toEqual([false, false]);
    });
  });

  describe('PUT /api/module-permissions/:module', () => {
    it('marcar "Editar" le da acceso de edición a un Líder titular, sin volver a iniciar sesión', async () => {
      const { organizationId, callingId } = await createCalling('Obispado', 'Secretario');
      const leader = await createUser('lider@example.com', 'leader');
      await assign(leader.id, callingId);
      const leaderCookie = await cookieFor(leader.id);
      const rename = () =>
        routes.organization.PATCH(request('PATCH', `/api/organizations/${organizationId}`, { name: 'Obispado del barrio' }, leaderCookie), {
          params: Promise.resolve({ id: organizationId }),
        });
      expect((await rename()).status).toBe(403);

      const admin = await createUser('admin@example.com', 'super_admin');
      const saved = await put('callings', [row(callingId, { canRead: true, canUpdate: true })], await cookieFor(admin.id));
      expect(saved.status).toBe(200);
      expect(await saved.json()).toEqual([expect.objectContaining({ callingId, canRead: true, canUpdate: true, canDelete: false })]);

      expect((await rename()).status).toBe(200);
    });

    it('reemplaza todas las filas del módulo y no guarda las que vienen todo en false', async () => {
      const first = await createCalling('Obispado', 'Secretario');
      const second = await createCalling('Obispado', 'Consejero');
      await grant('callings', first.callingId, { canRead: true });
      await grant('users', first.callingId, { canRead: true });
      const admin = await createUser('admin@example.com', 'super_admin');
      const response = await put('callings', [row(first.callingId), row(second.callingId, { canCreate: true })], await cookieFor(admin.id));
      expect(response.status).toBe(200);
      const rows = await db.select().from(schema.modulePermissions).where(eq(schema.modulePermissions.module, 'callings'));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ callingId: second.callingId, canCreate: true });
      expect(await storedRows('users')).toEqual([{ callingId: first.callingId, canRead: true }]);
    });

    it('400 si el módulo no existe, si un llamamiento se repite, si sobra un campo o si el llamamiento no existe', async () => {
      const { callingId } = await createCalling('Obispado', 'Secretario');
      const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
      const unknownModule = await put('camp', [row(callingId, { canRead: true })], cookie);
      expect(unknownModule.status).toBe(400);
      expect((await unknownModule.json()).fields).toEqual(['module']);
      expect((await put('callings', [row(callingId), row(callingId, { canRead: true })], cookie)).status).toBe(400);
      expect((await put('callings', [{ ...row(callingId, { canRead: true }), level: 100 }], cookie)).status).toBe(400);
      const missing = await put('callings', [row('00000000-0000-4000-8000-000000000000', { canRead: true })], cookie);
      expect(missing.status).toBe(400);
      expect((await missing.json()).issues).toEqual([{ field: 'permissions', code: 'unknown_calling' }]);
    });

    it('un Líder con permissions de solo lectura puede leer la matriz pero no cambiarla', async () => {
      const { callingId } = await createCalling('Obispado', 'Secretario');
      const leader = await createUser('lider@example.com', 'leader');
      await assign(leader.id, callingId);
      await grant('permissions', callingId, { canRead: true });
      const cookie = await cookieFor(leader.id);
      expect((await routes.matrix.GET(request('GET', '/api/module-permissions', undefined, cookie))).status).toBe(200);
      const response = await put('permissions', [row(callingId, { canRead: true, canUpdate: true })], cookie);
      expect(response.status).toBe(403);
      expect(await storedRows('permissions')).toEqual([{ callingId, canRead: true }]);
    });

    it('si la inserción falla a mitad, la matriz anterior queda intacta', async () => {
      const first = await createCalling('Obispado', 'Secretario');
      const second = await createCalling('Obispado', 'Consejero');
      await grant('callings', first.callingId, { canRead: true });
      await db.execute(sql`
        create or replace function module_permissions_fail() returns trigger language plpgsql as $$
        begin
          if new.can_delete then raise exception 'falla simulada'; end if;
          return new;
        end $$`);
      await db.execute(
        sql`create trigger module_permissions_fail before insert on module_permissions for each row execute function module_permissions_fail()`,
      );
      const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
      const response = await put('callings', [row(second.callingId, { canRead: true }), row(first.callingId, { canDelete: true })], cookie);
      expect(response.status).toBe(500);
      expect(await storedRows('callings')).toEqual([{ callingId: first.callingId, canRead: true }]);
    });

    it('dos reemplazos concurrentes del mismo módulo se serializan: queda el de uno, nunca la unión', async () => {
      const a = await createCalling('Obispado', 'Secretario');
      const b = await createCalling('Obispado', 'Consejero');
      const other = new Pool({ connectionString: url!, max: 1 });
      const db2 = drizzle(other, { schema });
      try {
        const [resA, resB] = await Promise.all([
          setModulePermissions(db, 'callings', { permissions: [row(a.callingId, { canRead: true })] }),
          setModulePermissions(db2, 'callings', { permissions: [row(b.callingId, { canRead: true })] }),
        ]);
        expect(resA).toEqual({ ok: true });
        expect(resB).toEqual({ ok: true });
        const ids = (await storedRows('callings')).map((stored) => stored.callingId).sort();
        expect(ids).not.toEqual([a.callingId, b.callingId].sort());
        expect([[a.callingId], [b.callingId]]).toContainEqual(ids);
      } finally {
        await other.end();
      }
    });
  });

  describe('notifyModuleEvent', () => {
    function collect() {
      const sent: { source: string; message: MailMessage }[] = [];
      const mailer = async (source: string, message: MailMessage) => {
        sent.push({ source, message });
        return { sent: true };
      };
      return { sent, mailer };
    }

    const build = (locale: Locale) => ({
      subject: `[${locale}] Hay 2 inscripciones nuevas`,
      html: `<p>[${locale}] Hay 2 inscripciones nuevas. <a href="https://example.com/admin">Abrir el panel</a></p>`,
      telegramText: `[${locale}] Hay 2 inscripciones nuevas`,
    });

    async function notifiableCalling(module: ModuleKey = 'temple-trips') {
      const { callingId } = await createCalling('Obispado', `Secretario ${randomBytes(3).toString('hex')}`);
      await grant(module, callingId, { canNotify: true });
      return callingId;
    }

    it('dos destinatarios reciben dos correos separados y ninguno ve el correo del otro', async () => {
      const callingId = await notifiableCalling();
      const ana = await createUser('ana@example.com', 'leader', { firstName: 'Ana', phone: '099 111 1111' });
      const beto = await createUser('beto@example.com', 'leader', { firstName: 'Beto', phone: '099 222 2222' });
      await assign(ana.id, callingId);
      await assign(beto.id, callingId);
      const { sent, mailer } = collect();
      expect(await notifyModuleEvent('temple-trips', build, { db, mailer })).toEqual({ recipients: 2, sent: 2 });
      expect(sent.map((item) => item.message.to).sort()).toEqual(['ana@example.com', 'beto@example.com']);
      for (const { source, message } of sent) {
        expect(source).toBe('temple-trips');
        const other = message.to === 'ana@example.com' ? 'beto@example.com' : 'ana@example.com';
        expect(JSON.stringify(message)).not.toContain(other);
      }
    });

    it('ningún aviso lleva nombres, teléfonos ni correos: solo el resumen que arma el módulo', async () => {
      const callingId = await notifiableCalling();
      const ana = await createUser('ana@example.com', 'leader', { firstName: 'Ana', phone: '099 111 1111' });
      await assign(ana.id, callingId);
      const { sent, mailer } = collect();
      await notifyModuleEvent('temple-trips', build, { db, mailer });
      const message = sent[0]!.message;
      expect({ subject: message.subject, html: message.html, text: message.text }).toEqual({
        subject: build('es').subject,
        html: build('es').html,
        text: build('es').telegramText,
      });
      const body = [message.subject, message.html, message.text].join(' ');
      for (const personal of ['Ana', 'Prueba', '099 111 1111', 'ana@example.com']) expect(body).not.toContain(personal);
    });

    it('un Miembro con un llamamiento marcado "Notificar" no recibe avisos', async () => {
      const callingId = await notifiableCalling();
      const member = await createUser('miembro@example.com', 'member');
      await assign(member.id, callingId);
      const { sent, mailer } = collect();
      expect(await notifyModuleEvent('temple-trips', build, { db, mailer })).toEqual({ recipients: 0, sent: 0 });
      expect(sent).toEqual([]);
    });

    it('sin duplicados, solo el módulo pedido, solo llamamientos activos y solo usuarios activos', async () => {
      const first = await notifiableCalling();
      const second = await notifiableCalling();
      const otherModule = await notifiableCalling('users');
      const inactive = await notifiableCalling();
      await db.update(schema.callings).set({ active: false }).where(eq(schema.callings.id, inactive));
      const ana = await createUser('ana@example.com', 'leader');
      await assign(ana.id, first);
      await assign(ana.id, second);
      const beto = await createUser('beto@example.com', 'leader');
      await assign(beto.id, otherModule);
      const carla = await createUser('carla@example.com', 'leader');
      await assign(carla.id, inactive);
      const dani = await createUser('dani@example.com', 'leader');
      await assign(dani.id, first);
      await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, dani.id));
      const { sent, mailer } = collect();
      await notifyModuleEvent('temple-trips', build, { db, mailer });
      expect(sent.map((item) => item.message.to)).toEqual(['ana@example.com']);
    });

    it('cada destinatario lo recibe en su idioma, o en el de la instalación; arma el aviso una vez por idioma', async () => {
      const callingId = await notifiableCalling();
      await db.update(schema.appConfig).set({ defaultLocale: 'pt' });
      for (const [email, locale] of [['en@example.com', 'en'], ['es@example.com', 'es'], ['sin@example.com', undefined], ['en2@example.com', 'en']] as const) {
        await assign((await createUser(email, 'leader', { locale })).id, callingId);
      }
      const { sent, mailer } = collect();
      const calls: Locale[] = [];
      await notifyModuleEvent('temple-trips', (locale) => (calls.push(locale), build(locale)), { db, mailer });
      const byEmail = Object.fromEntries(sent.map((item) => [item.message.to, item.message.locale]));
      expect(byEmail).toEqual({ 'en@example.com': 'en', 'en2@example.com': 'en', 'es@example.com': 'es', 'sin@example.com': 'pt' });
      expect(calls.sort()).toEqual(['en', 'es', 'pt']);
    });

    it('nunca lanza: si un envío falla, sigue con los demás', async () => {
      const callingId = await notifiableCalling();
      await assign((await createUser('ana@example.com', 'leader')).id, callingId);
      await assign((await createUser('beto@example.com', 'leader')).id, callingId);
      const delivered: string[] = [];
      const mailer = async (_source: string, message: MailMessage) => {
        if (message.to === 'ana@example.com') throw new Error('smtp caído');
        delivered.push(message.to);
        return { sent: true };
      };
      await expect(notifyModuleEvent('temple-trips', build, { db, mailer })).resolves.toEqual({ recipients: 2, sent: 1 });
      expect(delivered).toEqual(['beto@example.com']);
    });

    it('con el envío real (sendMail) deja un registro por destinatario', async () => {
      const callingId = await notifiableCalling();
      await assign((await createUser('ana@example.com', 'leader')).id, callingId);
      await assign((await createUser('beto@example.com', 'leader')).id, callingId);
      await notifyModuleEvent('temple-trips', build, { db });
      const logs = await db.select().from(schema.emailLog);
      expect(logs.map((log) => [log.source, log.emailTo, log.errorMessage]).sort()).toEqual([
        ['temple-trips', 'ana@example.com', 'smtp_not_configured'],
        ['temple-trips', 'beto@example.com', 'smtp_not_configured'],
      ]);
    });
  });
});
