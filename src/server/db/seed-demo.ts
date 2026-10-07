import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { appEnv } from '@/lib/app-env';
import { participantPrices, splitFullName } from '@/lib/temple-trips/constants';
import { hashPassword } from '@/server/auth/crypto';
import type { Database } from '@/server/db';
import * as schema from '@/server/db/schema';
import {
  appConfig,
  callings,
  organizations,
  roles,
  templeParticipants,
  templeRegistrations,
  templeTrips,
  users,
} from '@/server/db/schema';

// Semilla de datos 100% INVENTADOS (@example.com) para los ambientes staging y demo.
// Es idempotente: correrla dos veces no duplica ni rompe. Nunca lleva datos reales de
// personas (Manual General 33.8). Las contraseñas se generan al sembrar y se imprimen SOLO al
// final de la corrida; no se commitean ni viven en el repo.

export const DEMO_UNIT_NAME = 'Barrio de Prueba';

const DEMO_ORGS: { name: string; callings: string[] }[] = [
  {
    name: 'Quórum de Élderes de Prueba',
    callings: ['Presidente del Quórum de Élderes', 'Secretario del Quórum de Élderes'],
  },
  {
    name: 'Sociedad de Socorro de Prueba',
    callings: ['Presidenta de la Sociedad de Socorro', 'Maestra Orientadora de la Sociedad de Socorro'],
  },
  {
    name: 'Escuela Dominical de Prueba',
    callings: ['Presidente de la Escuela Dominical', 'Maestro de Doctrina del Evangelio'],
  },
];

const DEMO_USERS: { email: string; firstName: string; lastName: string; roleKey: string; phone: string }[] = [
  { email: 'admin.demo@example.com', firstName: 'Ana', lastName: 'Administradora', roleKey: 'super_admin', phone: '+593 99 000 0001' },
  { email: 'lider.demo@example.com', firstName: 'Luis', lastName: 'Líder', roleKey: 'leader', phone: '+593 99 000 0002' },
  { email: 'miembro1.demo@example.com', firstName: 'María', lastName: 'Miembro', roleKey: 'member', phone: '+593 99 000 0003' },
  { email: 'miembro2.demo@example.com', firstName: 'Mateo', lastName: 'Miembro', roleKey: 'member', phone: '+593 99 000 0004' },
  { email: 'amigo.demo@example.com', firstName: 'Andrés', lastName: 'Amigo', roleKey: 'friend', phone: '+593 99 000 0005' },
];

const DEMO_TRIP = {
  date: '2026-12-20',
  registrationDeadline: '2026-12-01',
  templeName: 'Templo de Guayaquil Ecuador',
  includesTransport: true,
  includesLodging: true,
  includesBreakfast: true,
  includesLunch: true,
  quotaTransport: 50,
  quotaLodging: 50,
  costTransport: '10.00',
  costBreakfast: '3.00',
  costLunch: '5.00',
  ordinanceQuota: 10,
} as const;

type DemoParticipant = {
  idNumber: string;
  fullName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  birthDate: string;
  ordinances: string[];
  wantsTransport: boolean;
  needsLodging: boolean;
  wantsBreakfast: boolean;
  wantsLunch: boolean;
  approved: boolean;
};

const DEMO_PARTICIPANTS: DemoParticipant[] = [
  { idNumber: 'DEMO0000001', fullName: 'Carlos Inventado Pérez', email: 'participante01@example.com', phone: '+593 98 000 0001', gender: 'male', birthDate: '1988-04-12', ordinances: ['endowment'], wantsTransport: true, needsLodging: true, wantsBreakfast: true, wantsLunch: true, approved: true },
  { idNumber: 'DEMO0000002', fullName: 'Lucía Inventada Gómez', email: 'participante02@example.com', phone: '+593 98 000 0002', gender: 'female', birthDate: '1990-09-03', ordinances: ['endowment', 'sealing'], wantsTransport: true, needsLodging: true, wantsBreakfast: true, wantsLunch: false, approved: true },
  { idNumber: 'DEMO0000003', fullName: 'Pedro Inventado Suárez', email: 'participante03@example.com', phone: '+593 98 000 0003', gender: 'male', birthDate: '1975-01-20', ordinances: ['sealing'], wantsTransport: false, needsLodging: false, wantsBreakfast: true, wantsLunch: true, approved: true },
  { idNumber: 'DEMO0000004', fullName: 'Sofía Inventada Torres', email: 'participante04@example.com', phone: '+593 98 000 0004', gender: 'female', birthDate: '1995-06-30', ordinances: ['baptism'], wantsTransport: true, needsLodging: false, wantsBreakfast: false, wantsLunch: true, approved: true },
  { idNumber: 'DEMO0000005', fullName: 'Diego Inventado Rojas', email: 'participante05@example.com', phone: '+593 98 000 0005', gender: 'male', birthDate: '2008-11-05', ordinances: ['baptism', 'initiatory'], wantsTransport: true, needsLodging: false, wantsBreakfast: true, wantsLunch: true, approved: true },
  { idNumber: 'DEMO0000006', fullName: 'Valentina Inventada Mora', email: 'participante06@example.com', phone: '+593 98 000 0006', gender: 'female', birthDate: '1983-02-14', ordinances: ['initiatory'], wantsTransport: false, needsLodging: true, wantsBreakfast: false, wantsLunch: false, approved: true },
  { idNumber: 'DEMO0000007', fullName: 'Jorge Inventado Vega', email: 'participante07@example.com', phone: '+593 98 000 0007', gender: 'male', birthDate: '1999-07-19', ordinances: [], wantsTransport: true, needsLodging: true, wantsBreakfast: true, wantsLunch: true, approved: false },
  { idNumber: 'DEMO0000008', fullName: 'Camila Inventada Luna', email: 'participante08@example.com', phone: '+593 98 000 0008', gender: 'female', birthDate: '2001-03-27', ordinances: ['baptism'], wantsTransport: false, needsLodging: false, wantsBreakfast: true, wantsLunch: false, approved: false },
  { idNumber: 'DEMO0000009', fullName: 'Ricardo Inventado Paz', email: 'participante09@example.com', phone: '+593 98 000 0009', gender: 'male', birthDate: '1969-12-08', ordinances: ['sealing'], wantsTransport: true, needsLodging: true, wantsBreakfast: false, wantsLunch: true, approved: false },
  { idNumber: 'DEMO0000010', fullName: 'Daniela Inventada Ríos', email: 'participante10@example.com', phone: '+593 98 000 0010', gender: 'female', birthDate: '1992-10-16', ordinances: ['endowment'], wantsTransport: false, needsLodging: false, wantsBreakfast: false, wantsLunch: false, approved: false },
];

const DEMO_PARTICIPANT_IDS = DEMO_PARTICIPANTS.map((person) => person.idNumber);

export type SeededUser = {
  email: string;
  roleKey: string;
  firstName: string;
  lastName: string;
  created: boolean;
  password: string | null;
};

export type SeedSummary = {
  unitName: string;
  organizations: number;
  callings: number;
  users: SeededUser[];
  trip: { id: string; created: boolean };
  registration: { created: boolean };
  participants: number;
};

function generatePassword(): string {
  return `Demo-${randomBytes(9).toString('base64url')}`;
}

export async function seedDemo(db: Database): Promise<SeedSummary> {
  if (appEnv() === 'production') {
    throw new Error('La semilla demo no se ejecuta en producción (APP_ENV=production): solo en staging, demo o desarrollo local.');
  }

  await db
    .insert(appConfig)
    .values({ id: 1, unitName: DEMO_UNIT_NAME, allowRegistration: true })
    .onConflictDoUpdate({ target: appConfig.id, set: { unitName: DEMO_UNIT_NAME } });

  const [config] = await db.select({ policyVersion: appConfig.policyVersion }).from(appConfig).where(eq(appConfig.id, 1));
  const policyVersion = config?.policyVersion ?? '2026-10';

  let callingCount = 0;
  for (const org of DEMO_ORGS) {
    await db.insert(organizations).values({ name: org.name }).onConflictDoNothing();
    const [orgRow] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, org.name));
    if (!orgRow) throw new Error(`No se pudo asegurar la organización "${org.name}".`);
    for (const callingName of org.callings) {
      await db.insert(callings).values({ organizationId: orgRow.id, name: callingName }).onConflictDoNothing();
      callingCount += 1;
    }
  }

  const roleRows = await db.select({ id: roles.id, key: roles.key }).from(roles);
  const roleByKey = new Map(roleRows.map((role) => [role.key, role.id]));

  const seededUsers: SeededUser[] = [];
  for (const demoUser of DEMO_USERS) {
    const roleId = roleByKey.get(demoUser.roleKey);
    if (!roleId) throw new Error(`Falta el rol "${demoUser.roleKey}": corre las migraciones.`);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, demoUser.email));
    if (existing) {
      seededUsers.push({ ...demoUser, created: false, password: null });
      continue;
    }
    const password = generatePassword();
    const inserted = await db
      .insert(users)
      .values({
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        email: demoUser.email,
        phone: demoUser.phone,
        passwordHash: await hashPassword(password),
        roleId,
        status: 'active',
        locale: 'es',
        consentAt: new Date(),
        consentPolicyVersion: policyVersion,
        consentLocale: 'es',
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    seededUsers.push({ ...demoUser, created: inserted.length > 0, password: inserted.length > 0 ? password : null });
  }

  const [existingTrip] = await db
    .select()
    .from(templeTrips)
    .where(and(eq(templeTrips.templeName, DEMO_TRIP.templeName), eq(templeTrips.date, DEMO_TRIP.date)));
  let trip = existingTrip;
  let tripCreated = false;
  if (!trip) {
    const [inserted] = await db
      .insert(templeTrips)
      .values({
        date: DEMO_TRIP.date,
        registrationDeadline: DEMO_TRIP.registrationDeadline,
        dateConfirmed: true,
        includesTransport: DEMO_TRIP.includesTransport,
        includesLodging: DEMO_TRIP.includesLodging,
        includesBreakfast: DEMO_TRIP.includesBreakfast,
        includesLunch: DEMO_TRIP.includesLunch,
        quotaTransport: DEMO_TRIP.quotaTransport,
        quotaLodging: DEMO_TRIP.quotaLodging,
        costTransport: DEMO_TRIP.costTransport,
        costBreakfast: DEMO_TRIP.costBreakfast,
        costLunch: DEMO_TRIP.costLunch,
        quotaBaptismMale: DEMO_TRIP.ordinanceQuota,
        quotaBaptismFemale: DEMO_TRIP.ordinanceQuota,
        quotaInitiatoryMale: DEMO_TRIP.ordinanceQuota,
        quotaInitiatoryFemale: DEMO_TRIP.ordinanceQuota,
        quotaEndowmentMale: DEMO_TRIP.ordinanceQuota,
        quotaEndowmentFemale: DEMO_TRIP.ordinanceQuota,
        quotaSealingMale: DEMO_TRIP.ordinanceQuota,
        quotaSealingFemale: DEMO_TRIP.ordinanceQuota,
        templeName: DEMO_TRIP.templeName,
        inAssignedDistrict: true,
        scheduledWithTemple: true,
        active: true,
      })
      .returning();
    trip = inserted;
    tripCreated = true;
  }
  if (!trip) throw new Error('No se pudo asegurar el viaje al templo de la semilla.');

  const adminId = (await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_USERS[0]!.email)))[0]?.id ?? null;

  const existingParticipants = await db
    .select({ id: templeParticipants.id })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(and(eq(templeRegistrations.tripId, trip.id), inArray(templeParticipants.idNumber, DEMO_PARTICIPANT_IDS)));

  let registrationCreated = false;
  let participantCount = existingParticipants.length;
  if (existingParticipants.length === 0) {
    const [registration] = await db
      .insert(templeRegistrations)
      .values({
        tripId: trip.id,
        ip: '203.0.113.10',
        consent: true,
        policyVersion,
        locale: 'es',
        createdByUserId: adminId,
      })
      .returning({ id: templeRegistrations.id });
    if (!registration) throw new Error('No se pudo crear la inscripción de la semilla.');

    const rows = DEMO_PARTICIPANTS.map((person) => {
      const wantsTransport = trip!.includesTransport && person.wantsTransport;
      const needsLodging = trip!.includesLodging && person.needsLodging;
      const wantsBreakfast = trip!.includesBreakfast && person.wantsBreakfast;
      const wantsLunch = trip!.includesLunch && person.wantsLunch;
      const prices = participantPrices(trip!, { wantsTransport, wantsBreakfast, wantsLunch });
      const { lastNames, firstNames } = splitFullName(person.fullName);
      return {
        registrationId: registration.id,
        idNumber: person.idNumber,
        birthDate: person.birthDate,
        fullName: person.fullName,
        phone: person.phone,
        email: person.email,
        gender: person.gender,
        wantsTransport,
        needsLodging,
        wantsBreakfast,
        wantsLunch,
        ordinances: person.ordinances,
        approved: person.approved,
        priceTransport: prices.priceTransport.toFixed(2),
        priceBreakfast: prices.priceBreakfast.toFixed(2),
        priceLunch: prices.priceLunch.toFixed(2),
        totalCost: prices.totalCost.toFixed(2),
        lastNames,
        firstNames,
        nationality: 'Ecuatoriana',
      };
    });
    await db.insert(templeParticipants).values(rows);
    registrationCreated = true;
    participantCount = rows.length;
  }

  return {
    unitName: DEMO_UNIT_NAME,
    organizations: DEMO_ORGS.length,
    callings: callingCount,
    users: seededUsers,
    trip: { id: trip.id, created: tripCreated },
    registration: { created: registrationCreated },
    participants: participantCount,
  };
}

function printSummary(summary: SeedSummary): void {
  const created = summary.users.filter((user) => user.created);
  const existed = summary.users.filter((user) => !user.created);
  const lines = [
    '',
    '=== Semilla demo aplicada (datos 100% inventados) ===',
    `Unidad: ${summary.unitName}`,
    `Organizaciones aseguradas: ${summary.organizations} · Llamamientos: ${summary.callings}`,
    `Viaje al templo: ${summary.trip.created ? 'creado' : 'ya existía'} (${summary.trip.id})`,
    `Inscripción del viaje: ${summary.registration.created ? 'creada' : 'ya existía'} · Participantes: ${summary.participants}`,
    '',
    '--- Credenciales generadas (NO commitear, solo para el equipo) ---',
  ];
  if (created.length === 0) {
    lines.push('(ningún usuario nuevo: todos ya existían; las contraseñas no se cambiaron)');
  } else {
    for (const user of created) {
      lines.push(`${user.email}  |  ${user.roleKey}  |  ${user.password}`);
    }
  }
  if (existed.length > 0) {
    lines.push('');
    lines.push('Usuarios que ya existían (contraseña sin cambios):');
    for (const user of existed) lines.push(`${user.email}  |  ${user.roleKey}`);
  }
  lines.push('');
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está configurada.');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const summary = await seedDemo(drizzle(pool, { schema }));
    printSummary(summary);
  } finally {
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (invokedDirectly) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
