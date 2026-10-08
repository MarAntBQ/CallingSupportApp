import 'server-only';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import type { Gender } from '@/lib/camps/constants';
import type { AdminRegistrationInput, CampParticipantItem, ParticipantPatch } from '@/lib/validation/camps';
import type { Database } from '@/server/db';
import { campPackingChecks, campPackingItems, campParticipants, campRegistrations, camps } from '@/server/db/schema';
import { newAccessToken } from './registrations';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// Lista del panel (permiso de lectura del módulo): incluye el contacto de emergencia y los datos
// del tutor, que solo ven quienes tienen el permiso. Sin token ni IP.
export async function listParticipants(db: Database, campId: string): Promise<CampParticipantItem[] | null> {
  const [camp] = await db.select({ id: camps.id }).from(camps).where(eq(camps.id, campId)).limit(1);
  if (!camp) return null;
  const rows = await db
    .select({
      id: campParticipants.id,
      type: campParticipants.type,
      fullName: campParticipants.fullName,
      birthDate: campParticipants.birthDate,
      gender: campParticipants.gender,
      phone: campParticipants.phone,
      email: campParticipants.email,
      emergencyContactName: campParticipants.emergencyContactName,
      emergencyContactPhone: campParticipants.emergencyContactPhone,
      guardianName: campRegistrations.guardianName,
      guardianPhone: campRegistrations.guardianPhone,
      guardianEmail: campRegistrations.guardianEmail,
      permissionFormReceived: campParticipants.permissionFormReceived,
      permissionFormReceivedAt: campParticipants.permissionFormReceivedAt,
      approved: campParticipants.approved,
      suggestedContribution: campParticipants.suggestedContribution,
      createdAt: campParticipants.createdAt,
      packingDone: sql<number>`(select count(*)::int from ${campPackingChecks} c join ${campPackingItems} i on i.id = c.item_id
        where c.participant_id = ${campParticipants.id} and (i.applies_to = 'all' or i.applies_to = ${campParticipants.type}))`,
      packingTotal: sql<number>`(select count(*)::int from ${campPackingItems} i
        where i.camp_id = ${campId} and (i.applies_to = 'all' or i.applies_to = ${campParticipants.type}))`,
    })
    .from(campParticipants)
    .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
    .where(eq(campRegistrations.campId, campId))
    .orderBy(asc(campParticipants.fullName));
  return rows.map((row) => ({
    ...row,
    type: row.type as CampParticipantItem['type'],
    gender: row.gender as Gender,
    permissionFormReceivedAt: row.permissionFormReceivedAt ? row.permissionFormReceivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function campOfParticipant(tx: Tx, participantId: string) {
  const [row] = await tx
    .select({ campId: campRegistrations.campId })
    .from(campParticipants)
    .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
    .where(eq(campParticipants.id, participantId))
    .limit(1);
  return row?.campId ?? null;
}

// Bloquea el campamento FOR UPDATE y, ya con el bloqueo, relee al participante: aprobar, editar el
// género y cambiar el cupo del campamento se serializan, y cada uno decide con el estado vigente.
async function lockForParticipant(tx: Tx, participantId: string) {
  const campId = await campOfParticipant(tx, participantId);
  if (!campId) return null;
  const [camp] = await tx
    .select({ male: camps.quotaYouthMale, female: camps.quotaYouthFemale })
    .from(camps)
    .where(eq(camps.id, campId))
    .for('update')
    .limit(1);
  const [person] = await tx
    .select({ type: campParticipants.type, gender: campParticipants.gender, approved: campParticipants.approved })
    .from(campParticipants)
    .where(eq(campParticipants.id, participantId))
    .limit(1);
  if (!camp || !person) return null;
  return { campId, quotas: camp, person };
}

export async function approvedYouthByGender(tx: Tx | Database, campId: string, gender: string, excludeId?: string) {
  const [used] = await tx
    .select({ n: count() })
    .from(campParticipants)
    .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
    .where(
      and(
        eq(campRegistrations.campId, campId),
        eq(campParticipants.type, 'youth'),
        eq(campParticipants.gender, gender),
        eq(campParticipants.approved, true),
        ...(excludeId ? [ne(campParticipants.id, excludeId)] : []),
      ),
    );
  return Number(used!.n);
}

// Cupo por género de jóvenes (0 = sin límite). Solo cuentan los aprobados.
async function quotaFull(tx: Tx, locked: NonNullable<Awaited<ReturnType<typeof lockForParticipant>>>, gender: string, participantId: string) {
  const quota = gender === 'male' ? locked.quotas.male : locked.quotas.female;
  if (quota <= 0) return false;
  return (await approvedYouthByGender(tx, locked.campId, gender, participantId)) >= quota;
}

export type ParticipantResult = { ok: true } | { ok: false; status: 404 } | { ok: false; status: 409; code: 'quota_full' };

export async function setApproval(db: Database, participantId: string, approved: boolean): Promise<ParticipantResult> {
  return db.transaction(async (tx) => {
    const locked = await lockForParticipant(tx, participantId);
    if (!locked) return { ok: false, status: 404 } as const;
    if (approved && locked.person.type === 'youth' && (await quotaFull(tx, locked, locked.person.gender, participantId))) {
      return { ok: false, status: 409, code: 'quota_full' } as const;
    }
    await tx.update(campParticipants).set({ approved }).where(eq(campParticipants.id, participantId));
    return { ok: true } as const;
  });
}

// Editar a un joven aprobado y cambiarle el género revalida el cupo del género nuevo.
export async function updateParticipant(db: Database, participantId: string, patch: ParticipantPatch, userId: string, now = new Date()): Promise<ParticipantResult> {
  return db.transaction(async (tx) => {
    const locked = await lockForParticipant(tx, participantId);
    if (!locked) return { ok: false, status: 404 } as const;
    const { person } = locked;
    const gender = patch.gender ?? person.gender;
    if (person.approved && person.type === 'youth' && gender !== person.gender && (await quotaFull(tx, locked, gender, participantId))) {
      return { ok: false, status: 409, code: 'quota_full' } as const;
    }
    const { permissionFormReceived, ...fields } = patch;
    const form =
      permissionFormReceived === undefined
        ? {}
        : permissionFormReceived
          ? { permissionFormReceived: true, permissionFormReceivedAt: now, permissionFormReceivedBy: userId }
          : { permissionFormReceived: false, permissionFormReceivedAt: null, permissionFormReceivedBy: null };
    await tx
      .update(campParticipants)
      .set({ ...fields, ...form })
      .where(eq(campParticipants.id, participantId));
    return { ok: true } as const;
  });
}

export type IssuedAdminLink = { participantId: string; fullName: string; email: string | null; token: string };

export type AdminRegistrationResult = { ok: true; campName: string; locale: string; links: IssuedAdminLink[] } | { ok: false; status: 404 };

// Inscripción desde el panel: cualquier campamento, sin fecha límite ni reCAPTCHA. Quien inscribe
// confirma el consentimiento; queda su usuario en `created_by_user_id`. Quedan pendientes.
export async function adminRegister(
  db: Database,
  campId: string,
  input: AdminRegistrationInput,
  context: { userId: string; policyVersion: string; locale: string },
): Promise<AdminRegistrationResult> {
  return db.transaction(async (tx) => {
    const [camp] = await tx.select().from(camps).where(eq(camps.id, campId)).for('share').limit(1);
    if (!camp) return { ok: false, status: 404 } as const;
    const [registration] = await tx
      .insert(campRegistrations)
      .values({ campId, consent: true, policyVersion: context.policyVersion, locale: context.locale, createdByUserId: context.userId })
      .returning({ id: campRegistrations.id });
    const links: IssuedAdminLink[] = [];
    for (const person of input.participants) {
      const { token, hash } = newAccessToken();
      const contribution = !camp.feeAuthorized ? '0.00' : person.type === 'youth' ? camp.feeYouth : camp.feeLeader;
      const [row] = await tx
        .insert(campParticipants)
        .values({
          registrationId: registration!.id,
          type: person.type,
          fullName: person.fullName,
          birthDate: person.birthDate ?? null,
          gender: person.gender,
          phone: person.phone,
          email: person.email,
          emergencyContactName: person.emergencyContactName,
          emergencyContactPhone: person.emergencyContactPhone,
          suggestedContribution: contribution,
          accessTokenHash: hash,
        })
        .returning({ id: campParticipants.id });
      links.push({ participantId: row!.id, fullName: person.fullName, email: person.email, token });
    }
    return { ok: true, campName: camp.name, locale: context.locale, links } as const;
  });
}

export type NewLinkResult =
  | { ok: true; campName: string; fullName: string; email: string; locale: string; token: string }
  | { ok: false; status: 404 }
  | { ok: false; status: 400; code: 'no_email' };

// Enlace nuevo: solo se guarda el hash, así que no se puede reenviar el anterior. Se genera uno
// nuevo (el anterior deja de funcionar) y se envía al correo del participante o, si no tiene, al
// del padre, madre o tutor que lo inscribió.
export async function issueNewLink(db: Database, participantId: string): Promise<NewLinkResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        campName: camps.name,
        fullName: campParticipants.fullName,
        email: campParticipants.email,
        guardianEmail: campRegistrations.guardianEmail,
        locale: campRegistrations.locale,
      })
      .from(campParticipants)
      .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
      .innerJoin(camps, eq(campRegistrations.campId, camps.id))
      .where(eq(campParticipants.id, participantId))
      .limit(1);
    if (!row) return { ok: false, status: 404 } as const;
    const email = row.email ?? row.guardianEmail;
    if (!email) return { ok: false, status: 400, code: 'no_email' } as const;
    const { token, hash } = newAccessToken();
    await tx.update(campParticipants).set({ accessTokenHash: hash }).where(eq(campParticipants.id, participantId));
    return { ok: true, campName: row.campName, fullName: row.fullName, email, locale: row.locale, token } as const;
  });
}
