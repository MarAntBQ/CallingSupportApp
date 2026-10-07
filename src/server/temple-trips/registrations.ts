import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  GENDERS,
  MIN_AGE_ORDINANCES,
  ORDINANCES,
  QUOTA_KEYS,
  calculateAge,
  normalizeIdNumber,
  participantPrices,
  quotaKey,
  type Gender,
  type QuotaKey,
} from '@/lib/temple-trips/constants';
import { todayInZone } from '@/lib/time';
import type { RegistrationInput } from '@/lib/validation/registrations';
import type { Database } from '@/server/db';
import { templeParticipants, templeRegistrations, templeTrips } from '@/server/db/schema';

type Quotas = { transport: number; lodging: number } & Record<QuotaKey, number>;

export type PublicTripView = {
  id: string;
  date: string;
  registrationDeadline: string;
  dateConfirmed: boolean;
  includesTransport: boolean;
  includesLodging: boolean;
  includesBreakfast: boolean;
  includesLunch: boolean;
  costTransport: string;
  costBreakfast: string;
  costLunch: string;
  registrationOpen: boolean;
  remainingQuotas: Quotas;
};

type ApprovedRow = { wantsTransport: boolean; needsLodging: boolean; gender: string; ordinances: string[] };

function approvedParticipants(db: Database, tripId: string): Promise<ApprovedRow[]> {
  return db
    .select({
      wantsTransport: templeParticipants.wantsTransport,
      needsLodging: templeParticipants.needsLodging,
      gender: templeParticipants.gender,
      ordinances: templeParticipants.ordinances,
    })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(and(eq(templeRegistrations.tripId, tripId), eq(templeParticipants.approved, true)));
}

function usedQuotas(rows: ApprovedRow[]): Quotas {
  const used = { transport: 0, lodging: 0 } as Quotas;
  for (const key of QUOTA_KEYS) used[key] = 0;
  for (const row of rows) {
    if (row.wantsTransport) used.transport += 1;
    if (row.needsLodging) used.lodging += 1;
    if ((GENDERS as readonly string[]).includes(row.gender)) {
      for (const ordinance of ORDINANCES) {
        if (row.ordinances.includes(ordinance)) used[quotaKey(ordinance, row.gender as Gender)] += 1;
      }
    }
  }
  return used;
}

export async function getPublicActiveTrip(db: Database, timeZone: string): Promise<PublicTripView | null> {
  const [trip] = await db.select().from(templeTrips).where(eq(templeTrips.active, true)).limit(1);
  if (!trip) return null;
  const used = usedQuotas(await approvedParticipants(db, trip.id));
  const remainingQuotas = {
    transport: Math.max(0, trip.quotaTransport - used.transport),
    lodging: Math.max(0, trip.quotaLodging - used.lodging),
  } as Quotas;
  for (const key of QUOTA_KEYS) remainingQuotas[key] = Math.max(0, trip[key] - used[key]);
  return {
    id: trip.id,
    date: trip.date,
    registrationDeadline: trip.registrationDeadline,
    dateConfirmed: trip.dateConfirmed,
    includesTransport: trip.includesTransport,
    includesLodging: trip.includesLodging,
    includesBreakfast: trip.includesBreakfast,
    includesLunch: trip.includesLunch,
    costTransport: trip.costTransport,
    costBreakfast: trip.costBreakfast,
    costLunch: trip.costLunch,
    registrationOpen: todayInZone(timeZone) <= trip.registrationDeadline,
    remainingQuotas,
  };
}

export type RegistrationContext = {
  ip: string | null;
  locale: string;
  policyVersion: string;
  createdByUserId?: string | null;
};

export type RegistrationResult =
  | { ok: true; count: number }
  | { ok: false; status: 404; code: 'no_active_trip' }
  | {
      ok: false;
      status: 400;
      code: 'registration_closed' | 'empty_id' | 'age_ordinance' | 'duplicate_in_submission' | 'duplicate_existing' | 'quota_exceeded';
      resource?: string;
    };

export async function createRegistration(
  db: Database,
  input: RegistrationInput,
  context: RegistrationContext,
  timeZone: string,
): Promise<RegistrationResult> {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(templeTrips).where(eq(templeTrips.active, true)).limit(1);
    if (!trip) return { ok: false, status: 404, code: 'no_active_trip' } as const;

    // Serializa las inscripciones del mismo viaje: evita que dos envíos simultáneos pasen el
    // chequeo de cupos/duplicados a la vez y lo excedan.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`temple-registrations:${trip.id}`}))`);

    if (todayInZone(timeZone) > trip.registrationDeadline) return { ok: false, status: 400, code: 'registration_closed' } as const;

    const prepared = [];
    const seen = new Set<string>();
    for (const person of input.participants) {
      const idNumber = normalizeIdNumber(person.idNumber);
      if (!idNumber) return { ok: false, status: 400, code: 'empty_id' } as const;
      if (person.ordinances.length > 0 && calculateAge(person.birthDate, trip.date) < MIN_AGE_ORDINANCES) {
        return { ok: false, status: 400, code: 'age_ordinance' } as const;
      }
      if (seen.has(idNumber)) return { ok: false, status: 400, code: 'duplicate_in_submission' } as const;
      seen.add(idNumber);
      const wantsTransport = trip.includesTransport && person.wantsTransport;
      const needsLodging = trip.includesLodging && person.needsLodging;
      const wantsBreakfast = trip.includesBreakfast && person.wantsBreakfast;
      const wantsLunch = trip.includesLunch && person.wantsLunch;
      const ordinances = [...new Set(person.ordinances)];
      const prices = participantPrices(trip, { wantsTransport, wantsBreakfast, wantsLunch });
      prepared.push({ person, idNumber, wantsTransport, needsLodging, wantsBreakfast, wantsLunch, ordinances, prices });
    }

    const ids = prepared.map((item) => item.idNumber);
    const existing = await tx
      .select({ idNumber: templeParticipants.idNumber })
      .from(templeParticipants)
      .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
      .where(and(eq(templeRegistrations.tripId, trip.id), inArray(templeParticipants.idNumber, ids)));
    if (existing.length > 0) return { ok: false, status: 400, code: 'duplicate_existing' } as const;

    const used = usedQuotas(await approvedParticipants(tx, trip.id));
    let reqTransport = 0;
    let reqLodging = 0;
    const reqQuota = {} as Record<QuotaKey, number>;
    for (const item of prepared) {
      if (item.wantsTransport) reqTransport += 1;
      if (item.needsLodging) reqLodging += 1;
      for (const ordinance of item.ordinances) {
        const key = quotaKey(ordinance, item.person.gender);
        reqQuota[key] = (reqQuota[key] ?? 0) + 1;
      }
    }
    if (trip.includesTransport && used.transport + reqTransport > trip.quotaTransport) {
      return { ok: false, status: 400, code: 'quota_exceeded', resource: 'transport' } as const;
    }
    if (trip.includesLodging && used.lodging + reqLodging > trip.quotaLodging) {
      return { ok: false, status: 400, code: 'quota_exceeded', resource: 'lodging' } as const;
    }
    for (const ordinance of ORDINANCES) {
      for (const gender of GENDERS) {
        const key = quotaKey(ordinance, gender);
        if (used[key] + (reqQuota[key] ?? 0) > trip[key]) {
          return { ok: false, status: 400, code: 'quota_exceeded', resource: key } as const;
        }
      }
    }

    const [registration] = await tx
      .insert(templeRegistrations)
      .values({
        tripId: trip.id,
        ip: context.ip,
        consent: true,
        policyVersion: context.policyVersion,
        locale: context.locale,
        createdByUserId: context.createdByUserId ?? null,
      })
      .returning();
    await tx.insert(templeParticipants).values(
      prepared.map((item) => ({
        registrationId: registration!.id,
        idNumber: item.idNumber,
        birthDate: item.person.birthDate,
        fullName: item.person.fullName,
        phone: item.person.phone,
        email: item.person.email,
        gender: item.person.gender,
        wantsTransport: item.wantsTransport,
        needsLodging: item.needsLodging,
        wantsBreakfast: item.wantsBreakfast,
        wantsLunch: item.wantsLunch,
        ordinances: item.ordinances,
        approved: false,
        priceTransport: item.prices.priceTransport.toFixed(2),
        priceBreakfast: item.prices.priceBreakfast.toFixed(2),
        priceLunch: item.prices.priceLunch.toFixed(2),
        totalCost: item.prices.totalCost.toFixed(2),
      })),
    );
    return { ok: true, count: prepared.length } as const;
  });
}

// Borrado físico (Manual General 33.9.3): una inscripción se borra cuando
// max(created_at + retention_months, fecha del viaje) < hoy, con hoy en la zona de la config.
// Los participantes caen en cascada. El viaje no se borra. Idempotente.
export async function purgeExpiredRegistrations(
  db: Database,
  { timeZone, retentionMonths }: { timeZone: string; retentionMonths: number },
): Promise<{ purgedRegistrations: number; purgedParticipants: number }> {
  const today = todayInZone(timeZone);
  return db.transaction(async (tx) => {
    const expired = await tx.execute<{ id: string }>(sql`
      select r.id
      from temple_registrations r
      join temple_trips t on t.id = r.trip_id
      where greatest(
        ((r.created_at at time zone ${timeZone})::date + (${retentionMonths} * interval '1 month'))::date,
        t.date
      ) < ${today}::date
    `);
    const ids = expired.rows.map((row) => row.id);
    if (ids.length === 0) return { purgedRegistrations: 0, purgedParticipants: 0 };
    const participants = await tx
      .select({ id: templeParticipants.id })
      .from(templeParticipants)
      .where(inArray(templeParticipants.registrationId, ids));
    await tx.delete(templeRegistrations).where(inArray(templeRegistrations.id, ids));
    return { purgedRegistrations: ids.length, purgedParticipants: participants.length };
  });
}
