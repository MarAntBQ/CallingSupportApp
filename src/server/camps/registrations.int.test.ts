import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { campRegistrationSchema } from '@/lib/validation/camps';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import { accessLinkEmail, campRegistrationNotice } from './emails';
import { createPublicRegistration } from './registrations';

const url = process.env.TEST_DATABASE_URL;
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const youth = (over: Record<string, unknown> = {}) => ({
  fullName: 'Joven Prueba',
  birthDate: '2011-05-01',
  gender: 'female',
  emergencyContactName: 'Tía Prueba',
  emergencyContactPhone: '0990000002',
  ...over,
});

const registration = (over: Record<string, unknown> = {}) => ({
  guardian: { name: 'Mamá Prueba', phone: '0990000001', email: 'Mama.Prueba@Example.com' },
  participants: [youth()],
  consent: true,
  ...over,
});

describe.skipIf(!url)('inscripción pública al campamento contra Postgres', () => {
  let pool: Pool;
  let db: Database;
  let routes: {
    camp: typeof import('@/app/api/public/camps/[slug]/route');
    register: typeof import('@/app/api/public/camps/[slug]/registrations/route');
    me: typeof import('@/app/api/public/camps/me/[token]/route');
  };

  async function createCamp(over: Partial<typeof schema.camps.$inferInsert> = {}) {
    const [camp] = await db
      .insert(schema.camps)
      .values({ slug: 'campamento', name: 'Campamento de prueba', location: 'Bosque de prueba', startDate: day(40), endDate: day(42), registrationDeadline: day(30), open: true, ...over })
      .returning();
    return camp!;
  }

  const getCamp = (slug: string) => routes.camp.GET(request('GET', `/api/public/camps/${slug}`), { params: Promise.resolve({ slug }) });
  const register = (slug: string, body: unknown, headers?: Record<string, string>) =>
    routes.register.POST(request('POST', `/api/public/camps/${slug}/registrations`, body, headers), { params: Promise.resolve({ slug }) });
  const me = (token: string) => routes.me.GET(request('GET', `/api/public/camps/me/${token}`), { params: Promise.resolve({ token }) });

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
      camp: await import('@/app/api/public/camps/[slug]/route'),
      register: await import('@/app/api/public/camps/[slug]/registrations/route'),
      me: await import('@/app/api/public/camps/me/[token]/route'),
    };
  }, 60_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table camps, rate_limits, email_log restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('la página pública no tiene participantes; el aporte solo aparece si el obispado lo autorizó', async () => {
    const camp = await createCamp({ feeYouth: '30.00', feeAuthorized: true, feeAuthorizedAt: new Date(), donationCategoryName: 'Campamento' });
    await db.insert(schema.campPackingItems).values([
      { campId: camp.id, name: 'Saco de dormir', category: 'Dormir', appliesTo: 'all', position: 1 },
      { campId: camp.id, name: 'Botiquín de líderes', category: 'Otros', appliesTo: 'leader', position: 2 },
    ]);
    const view = await (await getCamp('campamento')).json();
    expect(view).toMatchObject({ registrationOpen: true, suggestedContributionYouth: '30.00', donationCategoryName: 'Campamento' });
    expect(view.packing.map((item: { name: string }) => item.name)).toEqual(['Saco de dormir']);
    expect(view).not.toHaveProperty('id');

    await db.update(schema.camps).set({ feeYouth: '0', feeAuthorized: false, feeAuthorizedAt: null }).where(eq(schema.camps.id, camp.id));
    expect(await (await getCamp('campamento')).json()).toMatchObject({ suggestedContributionYouth: null, donationCategoryName: null });
    expect((await getCamp('no-existe')).status).toBe(404);
  });

  it('un tutor inscribe a 2 hermanos: 201 sin tokens, quedan pendientes con el aporte congelado y el token solo como hash', async () => {
    await createCamp({ feeYouth: '30.00', feeAuthorized: true, feeAuthorizedAt: new Date() });
    const response = await register('campamento', registration({ participants: [youth(), youth({ fullName: 'Hermano Prueba', gender: 'male' })] }), { cookie: 'csa_locale=pt' });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ ok: true, count: 2 });

    const [saved] = await db.select().from(schema.campRegistrations);
    expect(saved).toMatchObject({ guardianEmail: 'mama.prueba@example.com', consent: true, locale: 'pt', ip: '203.0.113.7' });
    expect(saved!.policyVersion).toBeTruthy();
    const participants = await db.select().from(schema.campParticipants);
    expect(participants).toHaveLength(2);
    for (const participant of participants) {
      expect(participant).toMatchObject({ type: 'youth', approved: false, suggestedContribution: '30.00' });
      expect(participant.accessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('cada joven genera su correo (camps-access-link) aunque no haya SMTP, y el registro guarda al tutor enmascarado', async () => {
    await createCamp();
    // Correo propio de esta prueba: los envíos en segundo plano de otras pruebas pueden llegar tarde.
    const guardian = { name: 'Papá Prueba', phone: '0990000003', email: 'papa.correo@example.com' };
    expect(await db.select().from(schema.emailLog).where(eq(schema.emailLog.emailTo, 'papa.correo@example.com'))).toHaveLength(0);
    expect((await register('campamento', registration({ guardian, participants: [youth(), youth({ fullName: 'Hermano Prueba' })] }))).status).toBe(201);
    let logs: { source: string; emailTo: string }[] = [];
    for (let i = 0; i < 50 && logs.length < 2; i += 1) {
      logs = await db
        .select({ source: schema.emailLog.source, emailTo: schema.emailLog.emailTo })
        .from(schema.emailLog)
        .where(eq(schema.emailLog.emailTo, 'p***@example.com'));
      if (logs.length < 2) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(logs).toEqual([
      { source: 'camps-access-link', emailTo: 'p***@example.com' },
      { source: 'camps-access-link', emailTo: 'p***@example.com' },
    ]);
  });

  it('sin consentimiento, sin contacto de emergencia o con una fecha futura responde 400 y no guarda nada', async () => {
    await createCamp();
    expect((await register('campamento', registration({ consent: false }))).status).toBe(400);
    expect((await register('campamento', registration({ participants: [youth({ emergencyContactPhone: '' })] }))).status).toBe(400);
    const future = await register('campamento', registration({ participants: [youth({ birthDate: day(30) })] }));
    expect((await future.json()).issues).toEqual([{ field: 'participants.0.birthDate', code: 'future_date' }]);
    expect(await db.select().from(schema.campRegistrations)).toHaveLength(0);
  });

  it('en producción sin APP_URL ni APP_ORIGINS no manda correos con el host de la petición; la inscripción queda guardada', async () => {
    await createCamp();
    const env = process.env as Record<string, string | undefined>;
    const previous = { NODE_ENV: env.NODE_ENV, APP_URL: env.APP_URL, APP_ORIGINS: env.APP_ORIGINS };
    env.NODE_ENV = 'production';
    delete env.APP_URL;
    delete env.APP_ORIGINS;
    try {
      const guardian = { name: 'Papá Prueba', phone: '0990000003', email: 'sin.url@example.com' };
      const response = await register('campamento', registration({ guardian }), { host: 'atacante.example.com' });
      expect(response.status).toBe(201);
    } finally {
      Object.assign(env, previous);
      for (const [key, value] of Object.entries(previous)) if (value === undefined) delete env[key];
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await db.select().from(schema.emailLog).where(eq(schema.emailLog.emailTo, 's***@example.com'))).toHaveLength(0);
    expect(await db.select().from(schema.campParticipants)).toHaveLength(1);
  });

  it('un campamento cerrado o con la fecha límite vencida responde 400 registration_closed; uno inexistente, 404', async () => {
    await createCamp({ open: false });
    const closed = await register('campamento', registration());
    expect((await closed.json()).issues).toEqual([{ field: 'camp', code: 'registration_closed' }]);
    await db.update(schema.camps).set({ open: true, registrationDeadline: day(-1), startDate: day(-1) });
    expect((await register('campamento', registration())).status).toBe(400);
    expect((await register('no-existe', registration())).status).toBe(404);
    expect(await db.select().from(schema.campRegistrations)).toHaveLength(0);
  });

  it('el enlace personal muestra solo lo del joven; un token inválido o con otro formato responde 404', async () => {
    const camp = await createCamp();
    const result = await createPublicRegistration(db, camp.slug, campRegistrationSchema.parse(registration()), { ip: null, locale: 'es', policyVersion: '2026-10' }, 'America/Guayaquil');
    if (!result.ok) throw new Error('la inscripción debía pasar');
    const response = await me(result.links[0]!.token);
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(view).toEqual({
      camp: { name: 'Campamento de prueba', startDate: camp.startDate, endDate: camp.endDate, location: 'Bosque de prueba' },
      participant: { fullName: 'Joven Prueba', type: 'youth', approved: false },
      contribution: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/Tía|0990000002|mama\.prueba|Mamá/);
    expect((await me('A'.repeat(43))).status).toBe(404);
    expect((await me('corto')).status).toBe(404);
  });

  it('la inscripción pública tiene límite por IP (#28): la undécima en una hora responde 429', async () => {
    await createCamp({ open: false });
    for (let i = 0; i < 10; i += 1) expect((await register('campamento', registration())).status).toBe(400);
    expect((await register('campamento', registration())).status).toBe(429);
  });

  it('el correo nombra al propio joven y lleva el enlace; el aviso a organizadores no nombra a nadie', () => {
    const mail = accessLinkEmail('mama.prueba@example.com', 'es', 'Campamento de prueba', 'Joven Prueba', 'https://example.com/camps/me/abc');
    expect(mail.html).toContain('Joven Prueba');
    expect(mail.html).toContain('https://example.com/camps/me/abc');
    expect(mail.html).not.toMatch(/Tía|0990000002/);
    for (const locale of ['es', 'pt', 'en'] as const) {
      const notice = campRegistrationNotice(locale, 'Campamento de prueba', 2, 'https://example.com/admin/camps');
      expect(`${notice.subject} ${notice.html} ${notice.telegramText}`).not.toMatch(/Joven|Mamá|Prueba@|0990/);
    }
  });
});
