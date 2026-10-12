import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Locale } from '@/i18n/config';
import type { ParticipantType } from '@/lib/camps/constants';
import type { CampRegistrationInput, PersonalLinkView, PublicCampView } from '@/lib/validation/camps';
import { todayInZone } from '@/lib/time';
import type { Database } from '@/server/db';
import { campPackingItems, campParticipants, campRegistrations, camps } from '@/server/db/schema';

// Enlace personal (#30): 32 bytes aleatorios. En la base solo queda su SHA-256; el token solo
// viaja en el correo al padre, madre o tutor, nunca en una respuesta de la API.
export function newAccessToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashAccessToken(token) };
}

export function hashAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function contributionOf(camp: typeof camps.$inferSelect, type: ParticipantType) {
  if (!camp.feeAuthorized) return '0.00';
  return type === 'youth' ? camp.feeYouth : camp.feeLeader;
}

// Datos públicos del campamento: nada de participantes. El aporte solo aparece si el obispado lo
// autorizó (Manual General 20.6.2) y es mayor que 0.
export async function getPublicCamp(db: Database, slug: string, timeZone: string): Promise<PublicCampView | null> {
  const [camp] = await db.select().from(camps).where(eq(camps.slug, slug)).limit(1);
  if (!camp) return null;
  const packing = await db
    .select({ id: campPackingItems.id, name: campPackingItems.name, detail: campPackingItems.detail, category: campPackingItems.category })
    .from(campPackingItems)
    .where(and(eq(campPackingItems.campId, camp.id), inArray(campPackingItems.appliesTo, ['all', 'youth'])))
    .orderBy(asc(campPackingItems.position));
  const contribution = contributionOf(camp, 'youth');
  return {
    slug: camp.slug,
    name: camp.name,
    description: camp.description,
    startDate: camp.startDate,
    endDate: camp.endDate,
    location: camp.location,
    registrationDeadline: camp.registrationDeadline,
    registrationOpen: camp.open && todayInZone(timeZone) <= camp.registrationDeadline,
    suggestedContributionYouth: Number(contribution) > 0 ? contribution : null,
    donationCategoryName: Number(contribution) > 0 ? camp.donationCategoryName : null,
    donationInstructions: Number(contribution) > 0 ? camp.donationInstructions : null,
    packing,
  };
}

export type RegistrationContext = { ip: string | null; locale: Locale; policyVersion: string };

export type IssuedLink = { fullName: string; token: string };

export type CampRegistrationResult =
  | { ok: true; campName: string; links: IssuedLink[] }
  | { ok: false; status: 404 | 400; code: 'not_found' | 'registration_closed' };

// Inscripción pública: solo jóvenes, uno o varios por envío (hermanos). Todos quedan pendientes;
// el cupo se valida al aprobar (#30, criterio: «el cupo lleno impide aprobar… pero permite
// inscribirla como pendiente»).
export async function createPublicRegistration(
  db: Database,
  slug: string,
  input: CampRegistrationInput,
  context: RegistrationContext,
  timeZone: string,
): Promise<CampRegistrationResult> {
  return db.transaction(async (tx) => {
    const [camp] = await tx.select().from(camps).where(eq(camps.slug, slug)).for('share').limit(1);
    if (!camp) return { ok: false, status: 404, code: 'not_found' } as const;
    if (!camp.open || todayInZone(timeZone) > camp.registrationDeadline) return { ok: false, status: 400, code: 'registration_closed' } as const;

    const [registration] = await tx
      .insert(campRegistrations)
      .values({
        campId: camp.id,
        guardianName: input.guardian.name,
        guardianPhone: input.guardian.phone,
        guardianEmail: input.guardian.email,
        consent: true,
        policyVersion: context.policyVersion,
        locale: context.locale,
        ip: context.ip,
      })
      .returning({ id: campRegistrations.id });

    const links: IssuedLink[] = [];
    for (const person of input.participants) {
      const { token, hash } = newAccessToken();
      await tx.insert(campParticipants).values({
        registrationId: registration!.id,
        type: 'youth',
        fullName: person.fullName,
        birthDate: person.birthDate,
        gender: person.gender,
        emergencyContactName: person.emergencyContactName,
        emergencyContactPhone: person.emergencyContactPhone,
        suggestedContribution: contributionOf(camp, 'youth'),
        accessTokenHash: hash,
      });
      links.push({ fullName: person.fullName, token });
    }
    return { ok: true, campName: camp.name, links } as const;
  });
}

// Enlace personal: solo lo del propio participante. Sin contacto de emergencia ni datos del
// tutor. Un token con otro formato ni siquiera llega a la base. Inválido → null (404 sin pistas).
export async function getPersonalLink(db: Database, token: string): Promise<PersonalLinkView | null> {
  if (!TOKEN_FORMAT.test(token)) return null;
  const [row] = await db
    .select({
      campName: camps.name,
      startDate: camps.startDate,
      endDate: camps.endDate,
      location: camps.location,
      fullName: campParticipants.fullName,
      type: campParticipants.type,
      approved: campParticipants.approved,
      suggestedContribution: campParticipants.suggestedContribution,
      feeAuthorized: camps.feeAuthorized,
      donationCategoryName: camps.donationCategoryName,
      donationInstructions: camps.donationInstructions,
    })
    .from(campParticipants)
    .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
    .innerJoin(camps, eq(campRegistrations.campId, camps.id))
    .where(eq(campParticipants.accessTokenHash, hashAccessToken(token)))
    .limit(1);
  if (!row) return null;
  return {
    camp: { name: row.campName, startDate: row.startDate, endDate: row.endDate, location: row.location },
    participant: { fullName: row.fullName, type: row.type as ParticipantType, approved: row.approved },
    // El aporte congelado al inscribirse, y solo si el obispado sigue autorizándolo.
    contribution:
      row.feeAuthorized && Number(row.suggestedContribution) > 0
        ? { suggested: row.suggestedContribution, categoryName: row.donationCategoryName, instructions: row.donationInstructions }
        : null,
  };
}
