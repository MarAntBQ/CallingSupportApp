import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { campRegistrationSchema } from '@/lib/validation/camps';
import { hashPassword } from '@/server/auth/crypto';
import { createSession, sessionCookieName } from '@/server/auth/sessions';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { setApproval, updateParticipant } from './participants';
import { createPublicRegistration, getPersonalLink } from './registrations';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const PASSWORD = randomBytes(12).toString('hex');
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

type Grant = Partial<Record<'canRead' | 'canCreate' | 'canUpdate' | 'canDelete', boolean>>;

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const youth = (fullName: string, gender = 'female') => ({
  fullName,
  birthDate: '2011-05-01',
  gender,
  emergencyContactName: 'Tía Prueba',
  emergencyContactPhone: '0990000002',
});

describe.skipIf(!url)('participantes del campamento contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    list: typeof import('@/app/api/camps/[id]/participants/route');
    register: typeof import('@/app/api/camps/[id]/registrations/route');
    participant: typeof import('@/app/api/camp-participants/[id]/route');
    approval: typeof import('@/app/api/camp-participants/[id]/approval/route');
    link: typeof import('@/app/api/camp-participants/[id]/access-link/route');
  };

  async function createUser(email: string, role: 'super_admin' | 'leader' | 'member') {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.key, role));
    const [user] = await db
      .insert(schema.users)
      .values({ firstName: 'Ana', lastName: 'Prueba', email, passwordHash: await hashPassword(PASSWORD), roleId: roleRow!.id, mfaEnabled: roleRow!.level >= 100, status: 'active' })
      .returning();
    return user!;
  }

  async function cookieFor(userId: string) {
    const { token } = await createSession(db, userId);
    return `${sessionCookieName()}=${token}`;
  }

  async function leaderCookie(grant: Grant) {
    const user = await createUser(`lider-${randomBytes(3).toString('hex')}@example.com`, 'leader');
    const [organization] = await db.insert(schema.organizations).values({ name: `Org ${randomBytes(4).toString('hex')}` }).returning();
    const [calling] = await db.insert(schema.callings).values({ organizationId: organization!.id, name: 'Presidenta de Mujeres Jóvenes' }).returning();
    await db.insert(schema.userCallings).values({ userId: user.id, callingId: calling!.id });
    await db.insert(schema.modulePermissions).values({ module: 'camps', callingId: calling!.id, ...grant });
    return cookieFor(user.id);
  }

  async function createCamp(over: Partial<typeof schema.camps.$inferInsert> = {}) {
    const [camp] = await db
      .insert(schema.camps)
      .values({ slug: 'campamento', name: 'Campamento de prueba', location: 'Bosque', startDate: day(40), endDate: day(42), registrationDeadline: day(30), open: true, ...over })
      .returning();
    return camp!;
  }

  async function registerYouth(names: [string, string?][]) {
    const input = campRegistrationSchema.parse({
      guardian: { name: 'Mamá Prueba', phone: '0990000001', email: 'mama.prueba@example.com' },
      participants: names.map(([name, gender]) => youth(name, gender)),
      consent: true,
    });
    const result = await createPublicRegistration(db, 'campamento', input, { ip: null, locale: 'es', policyVersion: '2026-10' }, 'America/Guayaquil');
    if (!result.ok) throw new Error('la inscripción debía pasar');
    return result.links;
  }

  async function idOf(fullName: string) {
    const [row] = await db.select({ id: schema.campParticipants.id }).from(schema.campParticipants).where(eq(schema.campParticipants.fullName, fullName));
    return row!.id;
  }

  const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });
  const list = (campId: string, cookie: string) => routes.list.GET(request('GET', `/api/camps/${campId}/participants`, undefined, cookie), ctx({ id: campId }));
  const approve = (id: string, approved: boolean, cookie: string) =>
    routes.approval.POST(request('POST', `/api/camp-participants/${id}/approval`, { approved }, cookie), ctx({ id }));
  const patch = (id: string, body: unknown, cookie: string) => routes.participant.PATCH(request('PATCH', `/api/camp-participants/${id}`, body, cookie), ctx({ id }));
  const adminRegister = (campId: string, body: unknown, cookie: string) =>
    routes.register.POST(request('POST', `/api/camps/${campId}/registrations`, body, cookie), ctx({ id: campId }));
  const newLink = (id: string, cookie: string) => routes.link.POST(request('POST', `/api/camp-participants/${id}/access-link`, {}, cookie), ctx({ id }));

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
      list: await import('@/app/api/camps/[id]/participants/route'),
      register: await import('@/app/api/camps/[id]/registrations/route'),
      participant: await import('@/app/api/camp-participants/[id]/route'),
      approval: await import('@/app/api/camp-participants/[id]/approval/route'),
      link: await import('@/app/api/camp-participants/[id]/access-link/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table camps, email_log, module_permissions, user_callings, callings, organizations, sessions, users restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('la lista del panel trae contacto de emergencia y tutor, avance de la lista y nunca el token', async () => {
    const camp = await createCamp();
    await db.insert(schema.campPackingItems).values([
      { campId: camp.id, name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all', position: 1 },
      { campId: camp.id, name: 'Linterna', category: 'Otros', appliesTo: 'youth', position: 2 },
      { campId: camp.id, name: 'Botiquín', category: 'Otros', appliesTo: 'leader', position: 3 },
    ]);
    await registerYouth([['Joven Uno']]);
    const [item] = await db.select({ id: schema.campPackingItems.id }).from(schema.campPackingItems).where(eq(schema.campPackingItems.name, 'Saco de dormir'));
    await db.insert(schema.campPackingChecks).values({ participantId: await idOf('Joven Uno'), itemId: item!.id });
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    const [person] = await (await list(camp.id, cookie)).json();
    expect(person).toMatchObject({ fullName: 'Joven Uno', emergencyContactName: 'Tía Prueba', guardianEmail: 'mama.prueba@example.com', approved: false, packingDone: 1, packingTotal: 2 });
    expect(person).not.toHaveProperty('accessTokenHash');
    expect((await list('00000000-0000-4000-8000-000000000000', cookie)).status).toBe(404);
  });

  it('el cupo de mujeres jóvenes lleno impide aprobar a una más (409), pero sigue inscrita como pendiente; los líderes no cuentan', async () => {
    const camp = await createCamp({ quotaYouthFemale: 1 });
    await registerYouth([['Joven Uno'], ['Joven Dos'], ['Joven Tres', 'male']]);
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect((await approve(await idOf('Joven Uno'), true, cookie)).status).toBe(200);
    const full = await approve(await idOf('Joven Dos'), true, cookie);
    expect(full.status).toBe(409);
    expect((await full.json()).issues).toEqual([{ field: 'approved', code: 'quota_full' }]);
    expect((await approve(await idOf('Joven Tres'), true, cookie)).status).toBe(200);
    expect((await adminRegister(camp.id, { participants: [{ type: 'leader', fullName: 'Líder Prueba', gender: 'female' }], consentConfirmed: true }, cookie)).status).toBe(201);
    expect((await approve(await idOf('Líder Prueba'), true, cookie)).status).toBe(200);
    // Quitar la aprobación libera el cupo.
    expect((await approve(await idOf('Joven Uno'), false, cookie)).status).toBe(200);
    expect((await approve(await idOf('Joven Dos'), true, cookie)).status).toBe(200);
  });

  it('dos aprobaciones simultáneas con cupo 1 dejan solo una aprobada', async () => {
    await createCamp({ quotaYouthFemale: 1 });
    await registerYouth([['Joven Uno'], ['Joven Dos']]);
    const other = new Pool({ connectionString: url!, max: 1 });
    const db2 = drizzle(other, { schema });
    try {
      const results = await Promise.all([setApproval(db, await idOf('Joven Uno'), true), setApproval(db2, await idOf('Joven Dos'), true)]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const approved = await db.select().from(schema.campParticipants).where(eq(schema.campParticipants.approved, true));
      expect(approved).toHaveLength(1);
    } finally {
      await other.end();
    }
  });

  it('aprobar a una joven y, a la vez, aprobar a otra que cambia a ese género no exceden el cupo', async () => {
    await createCamp({ quotaYouthFemale: 1 });
    await registerYouth([['Joven Uno'], ['Joven Dos', 'male']]);
    const admin = await createUser('admin@example.com', 'super_admin');
    await setApproval(db, await idOf('Joven Dos'), true);
    const other = new Pool({ connectionString: url!, max: 1 });
    const db2 = drizzle(other, { schema });
    try {
      await Promise.all([setApproval(db, await idOf('Joven Uno'), true), updateParticipant(db2, await idOf('Joven Dos'), { gender: 'female' }, admin.id)]);
      const approvedFemale = await db
        .select()
        .from(schema.campParticipants)
        .where(sql`${schema.campParticipants.approved} and ${schema.campParticipants.gender} = 'female'`);
      expect(approvedFemale).toHaveLength(1);
    } finally {
      await other.end();
    }
  });

  it('un PATCH parcial no borra el teléfono ni el correo; mandarlos vacíos sí los borra', async () => {
    const camp = await createCamp();
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    await adminRegister(camp.id, { participants: [{ type: 'leader', fullName: 'Líder Prueba', gender: 'male', phone: '0990000009', email: 'lider@example.com' }], consentConfirmed: true }, cookie);
    const id = await idOf('Líder Prueba');
    expect((await patch(id, { fullName: 'Líder Renombrado' }, cookie)).status).toBe(200);
    const [kept] = await db.select().from(schema.campParticipants).where(eq(schema.campParticipants.id, id));
    expect(kept).toMatchObject({ fullName: 'Líder Renombrado', phone: '0990000009', email: 'lider@example.com' });
    expect((await patch(id, { phone: '', email: '' }, cookie)).status).toBe(200);
    const [cleared] = await db.select().from(schema.campParticipants).where(eq(schema.campParticipants.id, id));
    expect(cleared).toMatchObject({ phone: null, email: null });
  });

  it('cambiar el género de un joven aprobado revalida el cupo; el formulario médico recibido registra quién y cuándo', async () => {
    await createCamp({ quotaYouthMale: 1 });
    await registerYouth([['Joven Uno', 'male'], ['Joven Dos']]);
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    await approve(await idOf('Joven Uno'), true, cookie);
    await approve(await idOf('Joven Dos'), true, cookie);
    expect((await patch(await idOf('Joven Dos'), { gender: 'male' }, cookie)).status).toBe(409);
    expect((await patch(await idOf('Joven Dos'), { permissionFormReceived: true }, cookie)).status).toBe(200);
    const [received] = await db.select().from(schema.campParticipants).where(eq(schema.campParticipants.fullName, 'Joven Dos'));
    expect(received!.permissionFormReceivedAt).toBeTruthy();
    expect(received!.permissionFormReceivedBy).toBeTruthy();
    await patch(await idOf('Joven Dos'), { permissionFormReceived: false }, cookie);
    const [cleared] = await db.select().from(schema.campParticipants).where(eq(schema.campParticipants.fullName, 'Joven Dos'));
    expect(cleared).toMatchObject({ permissionFormReceived: false, permissionFormReceivedAt: null, permissionFormReceivedBy: null });
  });

  it('desde el panel: un líder sin fecha de nacimiento entra con el aporte de líder; un joven sin contacto de emergencia o sin consentimiento, no', async () => {
    const camp = await createCamp({ feeYouth: '30.00', feeLeader: '10.00', feeAuthorized: true, feeAuthorizedAt: new Date() });
    const admin = await createUser('admin@example.com', 'super_admin');
    const cookie = await cookieFor(admin.id);
    const leader = { type: 'leader', fullName: 'Líder Prueba', gender: 'male', email: 'Lider.Prueba@Example.com' };
    expect((await adminRegister(camp.id, { participants: [leader], consentConfirmed: true }, cookie)).status).toBe(201);
    const [saved] = await db.select().from(schema.campParticipants);
    expect(saved).toMatchObject({ type: 'leader', birthDate: null, email: 'lider.prueba@example.com', suggestedContribution: '10.00', approved: false });
    const [registration] = await db.select().from(schema.campRegistrations);
    expect(registration!.createdByUserId).toBe(admin.id);

    const noContact = await adminRegister(camp.id, { participants: [{ type: 'youth', fullName: 'Joven Prueba', gender: 'male', birthDate: '2011-01-01' }], consentConfirmed: true }, cookie);
    expect((await noContact.json()).issues).toEqual([{ field: 'participants.0.emergencyContactName', code: 'emergency_contact_required' }]);
    expect((await adminRegister(camp.id, { participants: [leader] }, cookie)).status).toBe(400);
    expect(await db.select().from(schema.campParticipants)).toHaveLength(1);
  });

  it('un enlace nuevo invalida el anterior y se envía con el destinatario enmascarado; sin correo responde 400', async () => {
    const camp = await createCamp();
    const [link] = await registerYouth([['Joven Uno']]);
    const cookie = await cookieFor((await createUser('admin@example.com', 'super_admin')).id);
    expect(await getPersonalLink(db, link!.token)).not.toBeNull();
    const response = await newLink(await idOf('Joven Uno'), cookie);
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(/[A-Za-z0-9_-]{43}/);
    expect(await getPersonalLink(db, link!.token)).toBeNull();

    await adminRegister(camp.id, { participants: [{ type: 'leader', fullName: 'Líder Sin Correo', gender: 'male' }], consentConfirmed: true }, cookie);
    const noEmail = await newLink(await idOf('Líder Sin Correo'), cookie);
    expect(noEmail.status).toBe(400);
    expect((await noEmail.json()).issues).toEqual([{ field: 'email', code: 'no_email' }]);

    let logs: { emailTo: string }[] = [];
    for (let i = 0; i < 50 && logs.length === 0; i += 1) {
      logs = await db.select({ emailTo: schema.emailLog.emailTo }).from(schema.emailLog).where(eq(schema.emailLog.source, 'camps-access-link'));
      if (logs.length === 0) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(logs).toEqual([{ emailTo: 'm***@example.com' }]);
  });

  it('el enlace personal muestra el aporte congelado solo mientras el obispado lo tenga autorizado', async () => {
    const camp = await createCamp({ feeYouth: '30.00', feeAuthorized: true, feeAuthorizedAt: new Date(), donationCategoryName: 'Campamento' });
    const [link] = await registerYouth([['Joven Uno']]);
    expect((await getPersonalLink(db, link!.token))!.contribution).toEqual({ suggested: '30.00', categoryName: 'Campamento', instructions: null });
    await db.update(schema.camps).set({ feeYouth: '0', feeAuthorized: false, feeAuthorizedAt: null }).where(eq(schema.camps.id, camp.id));
    expect((await getPersonalLink(db, link!.token))!.contribution).toBeNull();
  });

  it('cada acción exige su permiso: leer no aprueba ni inscribe; editar no inscribe; un Miembro no ve nada', async () => {
    const camp = await createCamp();
    await registerYouth([['Joven Uno']]);
    const id = await idOf('Joven Uno');
    const reader = await leaderCookie({ canRead: true });
    expect((await list(camp.id, reader)).status).toBe(200);
    expect((await approve(id, true, reader)).status).toBe(403);
    expect((await patch(id, { fullName: 'Otro Nombre' }, reader)).status).toBe(403);
    expect((await newLink(id, reader)).status).toBe(403);
    expect((await adminRegister(camp.id, { participants: [{ type: 'leader', fullName: 'Líder Prueba', gender: 'male' }], consentConfirmed: true }, reader)).status).toBe(403);
    const editor = await leaderCookie({ canUpdate: true });
    expect((await approve(id, true, editor)).status).toBe(200);
    expect((await adminRegister(camp.id, { participants: [{ type: 'leader', fullName: 'Líder Prueba', gender: 'male' }], consentConfirmed: true }, editor)).status).toBe(403);
    const member = await cookieFor((await createUser('miembro@example.com', 'member')).id);
    expect((await list(camp.id, member)).status).toBe(403);
  });
});
