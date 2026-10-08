import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { moduleHome, type ModuleKey } from '@/lib/modules';
import { hashPassword } from '@/server/auth/crypto';
import { AuthError } from '@/server/auth/errors';
import { createSession, findSession, sessionCookieName, type Session } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { allowedModules, assertModulePermission } from './service';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');

type RoleKey = 'super_admin' | 'leader' | 'member' | 'friend';
type Grant = Partial<Record<'canRead' | 'canCreate' | 'canUpdate' | 'canDelete' | 'canNotify', boolean>>;

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!url)('organizaciones, llamamientos y permisos por módulo contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    organizations: typeof import('@/app/api/organizations/route');
    organization: typeof import('@/app/api/organizations/[id]/route');
    callings: typeof import('@/app/api/callings/route');
    calling: typeof import('@/app/api/callings/[id]/route');
    me: typeof import('@/app/api/auth/me/route');
  };

  async function createUser(email: string, role: RoleKey) {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({
        firstName: 'Ana',
        lastName: 'Prueba',
        email,
        passwordHash: await hashPassword(PASSWORD),
        roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100,
        status: 'active',
      })
      .returning();
    return user!;
  }

  async function sessionFor(userId: string) {
    const { token } = await createSession(db, userId);
    const session = (await findSession(db, token)) as Session;
    return { session, cookie: `${sessionCookieName()}=${token}` };
  }

  async function grantCalling(userId: string, module: ModuleKey, grant: Grant, name = 'Secretario') {
    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: `Org ${randomBytes(4).toString('hex')}` })
      .returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: organization!.id, name }).returning();
    await db.insert(schema.userCallings).values({ userId, callingId: calling!.id });
    await db.insert(schema.modulePermissions).values({ module, callingId: calling!.id, ...grant });
    return { organization: organization!, calling: calling! };
  }

  async function forbiddenCode(work: Promise<unknown>) {
    const error = await work.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(AuthError);
    return { status: (error as AuthError).status, code: (error as AuthError).code };
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
      organizations: await import('@/app/api/organizations/route'),
      organization: await import('@/app/api/organizations/[id]/route'),
      callings: await import('@/app/api/callings/route'),
      calling: await import('@/app/api/callings/[id]/route'),
      me: await import('@/app/api/auth/me/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(
      sql`truncate table module_permissions, user_callings, callings, organizations, sessions, users, rate_limits restart identity cascade`,
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('las migraciones no siembran organizaciones: el catálogo arranca vacío', async () => {
    const admin = new Pool({ connectionString: url, max: 1 });
    try {
      const { rows } = await admin.query('select count(*)::int as total from organizations');
      expect(rows[0].total).toBe(0);
    } finally {
      await admin.end();
    }
  });

  describe('assertModulePermission', () => {
    it('SuperAdmin pasa siempre, aunque no tenga llamamientos', async () => {
      const user = await createUser('admin@example.com', 'super_admin');
      const { session } = await sessionFor(user.id);
      await expect(assertModulePermission(db, session, 'callings', 'delete')).resolves.toBe(session);
    });

    it('nivel 10 con un llamamiento que tiene permiso recibe 403 (piso de Líder)', async () => {
      const user = await createUser('miembro@example.com', 'member');
      await grantCalling(user.id, 'callings', { canRead: true, canCreate: true });
      const { session } = await sessionFor(user.id);
      expect(await forbiddenCode(assertModulePermission(db, session, 'callings', 'read'))).toEqual({
        status: 403,
        code: 'no_admin_calling',
      });
    });

    it('Líder sin llamamientos recibe 403', async () => {
      const user = await createUser('lider@example.com', 'leader');
      const { session } = await sessionFor(user.id);
      expect(await forbiddenCode(assertModulePermission(db, session, 'callings', 'read'))).toEqual({
        status: 403,
        code: 'forbidden',
      });
    });

    it('Líder con permiso de leer pasa en read y recibe 403 en create', async () => {
      const user = await createUser('lider@example.com', 'leader');
      await grantCalling(user.id, 'callings', { canRead: true });
      const { session } = await sessionFor(user.id);
      await expect(assertModulePermission(db, session, 'callings', 'read')).resolves.toBe(session);
      expect((await forbiddenCode(assertModulePermission(db, session, 'callings', 'create'))).status).toBe(403);
      expect((await forbiddenCode(assertModulePermission(db, session, 'users', 'read'))).status).toBe(403);
    });

    it('un llamamiento desactivado no da permisos', async () => {
      const user = await createUser('lider@example.com', 'leader');
      const { calling } = await grantCalling(user.id, 'callings', { canRead: true });
      await db.update(schema.callings).set({ active: false }).where(eq(schema.callings.id, calling.id));
      const { session } = await sessionFor(user.id);
      expect((await forbiddenCode(assertModulePermission(db, session, 'callings', 'read'))).status).toBe(403);
    });

    it('un llamamiento de una organización desactivada tampoco da permisos', async () => {
      const user = await createUser('lider@example.com', 'leader');
      const { organization } = await grantCalling(user.id, 'callings', { canRead: true });
      await db.update(schema.organizations).set({ active: false }).where(eq(schema.organizations.id, organization.id));
      const { session } = await sessionFor(user.id);
      expect((await forbiddenCode(assertModulePermission(db, session, 'callings', 'read'))).status).toBe(403);
    });

    it('can_notify no da acceso a nada', async () => {
      const user = await createUser('lider@example.com', 'leader');
      await grantCalling(user.id, 'callings', { canNotify: true });
      const { session } = await sessionFor(user.id);
      for (const action of ['read', 'create', 'update', 'delete'] as const) {
        expect((await forbiddenCode(assertModulePermission(db, session, 'callings', action))).status).toBe(403);
      }
      expect(await allowedModules(db, session.user)).toEqual([]);
    });

    it('suma los permisos de varios llamamientos activos', async () => {
      const user = await createUser('lider@example.com', 'leader');
      await grantCalling(user.id, 'callings', { canRead: true }, 'Consejero');
      await grantCalling(user.id, 'callings', { canCreate: true }, 'Secretario');
      const { session } = await sessionFor(user.id);
      await expect(assertModulePermission(db, session, 'callings', 'read')).resolves.toBe(session);
      await expect(assertModulePermission(db, session, 'callings', 'create')).resolves.toBe(session);
    });
  });

  describe('allowedModules en GET /api/auth/me', () => {
    async function meModules(cookie: string) {
      const response = await routes.me.GET(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
      expect(response.status).toBe(200);
      return (await response.json()).allowedModules as ModuleKey[];
    }

    it('SuperAdmin recibe todos los módulos', async () => {
      const user = await createUser('admin@example.com', 'super_admin');
      const { cookie } = await sessionFor(user.id);
      expect(await meModules(cookie)).toEqual(['temple-trips', 'users', 'callings', 'permissions', 'self-reliance', 'camps']);
    });

    it('nivel menor que 50 recibe [] aunque tenga llamamientos con permiso', async () => {
      const user = await createUser('miembro@example.com', 'member');
      await grantCalling(user.id, 'callings', { canRead: true });
      const { cookie } = await sessionFor(user.id);
      expect(await meModules(cookie)).toEqual([]);
    });

    it('un Líder con solo el módulo permissions lo recibe y aterriza en /admin/organizations', async () => {
      const user = await createUser('lider@example.com', 'leader');
      await grantCalling(user.id, 'permissions', { canRead: true });
      const { cookie } = await sessionFor(user.id);
      const modules = await meModules(cookie);
      expect(modules).toEqual(['permissions']);
      expect(moduleHome(modules)).toBe('/admin/organizations');
    });
  });

  it('quitar un llamamiento quita el acceso en la siguiente petición, sin volver a iniciar sesión', async () => {
    const user = await createUser('lider@example.com', 'leader');
    const { calling } = await grantCalling(user.id, 'callings', { canRead: true, canCreate: true });
    const { cookie } = await sessionFor(user.id);
    const first = await routes.organizations.POST(request('POST', '/api/organizations', { name: 'Primaria' }, cookie));
    expect(first.status).toBe(201);
    await db
      .delete(schema.userCallings)
      .where(and(eq(schema.userCallings.userId, user.id), eq(schema.userCallings.callingId, calling.id)));
    const second = await routes.organizations.POST(request('POST', '/api/organizations', { name: 'Escuela Dominical' }, cookie));
    expect(second.status).toBe(403);
  });

  describe('endpoints del catálogo', () => {
    async function adminCookie() {
      const user = await createUser('admin@example.com', 'super_admin');
      return (await sessionFor(user.id)).cookie;
    }

    async function createOrganization(cookie: string, name: string) {
      const response = await routes.organizations.POST(request('POST', '/api/organizations', { name }, cookie));
      return { status: response.status, body: await response.json() };
    }

    it('sin sesión los GET responden 401', async () => {
      expect((await routes.organizations.GET(request('GET', '/api/organizations'))).status).toBe(401);
      expect((await routes.callings.GET(request('GET', '/api/callings'))).status).toBe(401);
    });

    it('cualquier sesión puede leer el catálogo, pero un Miembro no puede crear', async () => {
      const member = await createUser('miembro@example.com', 'member');
      const { cookie } = await sessionFor(member.id);
      expect((await routes.organizations.GET(request('GET', '/api/organizations', undefined, cookie))).status).toBe(200);
      const created = await routes.organizations.POST(request('POST', '/api/organizations', { name: 'Primaria' }, cookie));
      expect(created.status).toBe(403);
      expect(await created.json()).toEqual({ error: 'no_admin_calling' });
    });

    it('el SuperAdmin crea la primera organización y el nombre se guarda sin espacios de más', async () => {
      const cookie = await adminCookie();
      const { status, body } = await createOrganization(cookie, '  Presidencia   de rama ');
      expect(status).toBe(201);
      expect(body).toMatchObject({ name: 'Presidencia de rama', active: true });
      const list = await (await routes.organizations.GET(request('GET', '/api/organizations', undefined, cookie))).json();
      expect(list).toEqual([body]);
    });

    it('un nombre repetido (sin importar mayúsculas) responde 400 con el campo name', async () => {
      const cookie = await adminCookie();
      await createOrganization(cookie, 'Primaria');
      const { status, body } = await createOrganization(cookie, 'PRIMARIA');
      expect(status).toBe(400);
      expect(body).toEqual({ error: 'invalid_input', fields: ['name'], issues: [{ field: 'name', code: 'taken' }] });
    });

    it('valida el nombre: muy corto, muy largo o campos de más responden 400', async () => {
      const cookie = await adminCookie();
      expect((await createOrganization(cookie, 'A')).status).toBe(400);
      expect((await createOrganization(cookie, 'x'.repeat(81))).status).toBe(400);
      const extra = await routes.organizations.POST(request('POST', '/api/organizations', { name: 'Primaria', active: false }, cookie));
      expect(extra.status).toBe(400);
    });

    it('renombra y desactiva una organización; renombrar a un nombre existente responde 400', async () => {
      const cookie = await adminCookie();
      const { body: primary } = await createOrganization(cookie, 'Primaria');
      await createOrganization(cookie, 'Sociedad de Socorro');
      const patch = (body: unknown) =>
        routes.organization.PATCH(request('PATCH', `/api/organizations/${primary.id}`, body, cookie), {
          params: Promise.resolve({ id: primary.id }),
        });
      const renamed = await patch({ name: 'Primaria del barrio' });
      expect(renamed.status).toBe(200);
      expect(await renamed.json()).toMatchObject({ name: 'Primaria del barrio', active: true });
      expect((await patch({ active: false })).status).toBe(200);
      const taken = await patch({ name: 'sociedad de socorro' });
      expect(taken.status).toBe(400);
      expect((await patch({})).status).toBe(400);
    });

    it('PATCH con un id inexistente o mal formado responde 404', async () => {
      const cookie = await adminCookie();
      const missing = '00000000-0000-4000-8000-000000000000';
      const notFound = await routes.organization.PATCH(
        request('PATCH', `/api/organizations/${missing}`, { name: 'Primaria' }, cookie),
        { params: Promise.resolve({ id: missing }) },
      );
      expect(notFound.status).toBe(404);
      const malformed = await routes.calling.PATCH(request('PATCH', '/api/callings/abc', { name: 'Primaria' }, cookie), {
        params: Promise.resolve({ id: 'abc' }),
      });
      expect(malformed.status).toBe(404);
    });

    it('los llamamientos son únicos dentro de su organización, no entre organizaciones', async () => {
      const cookie = await adminCookie();
      const { body: primary } = await createOrganization(cookie, 'Primaria');
      const { body: youth } = await createOrganization(cookie, 'Hombres Jóvenes');
      const create = (organizationId: string, name: string) =>
        routes.callings.POST(request('POST', '/api/callings', { organizationId, name }, cookie));
      const first = await create(primary.id, 'Secretario');
      expect(first.status).toBe(201);
      expect(await first.json()).toMatchObject({ organizationId: primary.id, organizationName: 'Primaria', name: 'Secretario' });
      const repeated = await create(primary.id, 'secretario');
      expect(repeated.status).toBe(400);
      expect((await repeated.json()).issues).toEqual([{ field: 'name', code: 'taken' }]);
      expect((await create(youth.id, 'Secretario')).status).toBe(201);
      const clerk = await (await create(primary.id, 'Consejero')).json();
      const renamed = await routes.calling.PATCH(
        request('PATCH', `/api/callings/${clerk.id}`, { name: 'SECRETARIO' }, cookie),
        { params: Promise.resolve({ id: clerk.id }) },
      );
      expect(renamed.status).toBe(400);
      expect((await renamed.json()).issues).toEqual([{ field: 'name', code: 'taken' }]);
    });

    it('no se agregan llamamientos a una organización inactiva o inexistente', async () => {
      const cookie = await adminCookie();
      const { body: primary } = await createOrganization(cookie, 'Primaria');
      await db.update(schema.organizations).set({ active: false }).where(eq(schema.organizations.id, primary.id));
      const inactive = await routes.callings.POST(
        request('POST', '/api/callings', { organizationId: primary.id, name: 'Secretario' }, cookie),
      );
      expect(inactive.status).toBe(400);
      expect((await inactive.json()).issues).toEqual([{ field: 'organizationId', code: 'inactive' }]);
      const missing = await routes.callings.POST(
        request('POST', '/api/callings', { organizationId: '00000000-0000-4000-8000-000000000000', name: 'Secretario' }, cookie),
      );
      expect(missing.status).toBe(400);
      expect((await missing.json()).issues).toEqual([{ field: 'organizationId', code: 'not_found' }]);
    });

    it('renombra y desactiva un llamamiento; GET /api/callings lo devuelve con su organización', async () => {
      const cookie = await adminCookie();
      const { body: primary } = await createOrganization(cookie, 'Primaria');
      const created = await (
        await routes.callings.POST(request('POST', '/api/callings', { organizationId: primary.id, name: 'Secretario' }, cookie))
      ).json();
      const response = await routes.calling.PATCH(
        request('PATCH', `/api/callings/${created.id}`, { name: 'Secretaria', active: false }, cookie),
        { params: Promise.resolve({ id: created.id }) },
      );
      expect(response.status).toBe(200);
      const list = await (await routes.callings.GET(request('GET', '/api/callings', undefined, cookie))).json();
      expect(list).toEqual([
        { id: created.id, organizationId: primary.id, organizationName: 'Primaria', name: 'Secretaria', active: false },
      ]);
    });

    it('un Líder con permiso de crear pero no de editar no puede renombrar', async () => {
      const leader = await createUser('lider@example.com', 'leader');
      const { organization } = await grantCalling(leader.id, 'callings', { canRead: true, canCreate: true });
      const { cookie } = await sessionFor(leader.id);
      const response = await routes.organization.PATCH(
        request('PATCH', `/api/organizations/${organization.id}`, { name: 'Otra' }, cookie),
        { params: Promise.resolve({ id: organization.id }) },
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
    });

    it('rechaza peticiones de otro origen (CSRF)', async () => {
      const cookie = await adminCookie();
      const response = await routes.organizations.POST(
        new Request('http://localhost/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example.com', cookie },
          body: JSON.stringify({ name: 'Primaria' }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });
});
