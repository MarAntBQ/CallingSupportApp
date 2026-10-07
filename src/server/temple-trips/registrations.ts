import 'server-only';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  GENDERS,
  MIN_AGE_ORDINANCES,
  ORDINANCES,
  QUOTA_KEYS,
  calculateAge,
  normalizeIdNumber,
  participantPrices,
  quotaKey,
  totalFromFrozen,
  type Gender,
  type Ordinance,
  type QuotaKey,
} from '@/lib/temple-trips/constants';
import { todayInZone } from '@/lib/time';
import type { ParticipantPatch, RegistrationInput } from '@/lib/validation/registrations';
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
  donationCategoryName: string | null;
  donationInstructions: string | null;
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
    donationCategoryName: trip.donationCategoryName,
    donationInstructions: trip.donationInstructions,
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

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type TripRow = typeof templeTrips.$inferSelect;

// Serializa las inscripciones del mismo viaje para que dos envios no superen el cupo.
function lockTrip(tx: Tx, tripId: string) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`temple-registrations:${tripId}`}))`);
}

// Nucleo compartido por el formulario publico y la inscripcion desde el panel: valida,
// revalida cupos (aprobados + pedidos) e inserta. El llamador ya tomo el lock del viaje.
async function registerInto(tx: Tx, trip: TripRow, input: RegistrationInput, context: RegistrationContext): Promise<RegistrationResult> {
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
}

// Formulario público: inscribe en el viaje ACTIVO, con plazo.
export async function createRegistration(
  db: Database,
  input: RegistrationInput,
  context: RegistrationContext,
  timeZone: string,
): Promise<RegistrationResult> {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(templeTrips).where(eq(templeTrips.active, true)).limit(1);
    if (!trip) return { ok: false, status: 404, code: 'no_active_trip' } as const;
    await lockTrip(tx, trip.id);
    if (todayInZone(timeZone) > trip.registrationDeadline) return { ok: false, status: 400, code: 'registration_closed' } as const;
    return registerInto(tx, trip, input, context);
  });
}

// Inscripción desde el panel: cualquier viaje, sin plazo ni reCAPTCHA, con created_by_user_id.
export async function adminRegister(
  db: Database,
  tripId: string,
  input: RegistrationInput,
  context: RegistrationContext,
): Promise<RegistrationResult> {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(templeTrips).where(eq(templeTrips.id, tripId)).limit(1);
    if (!trip) return { ok: false, status: 404, code: 'no_active_trip' } as const;
    await lockTrip(tx, trip.id);
    return registerInto(tx, trip, input, context);
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

// --- #21: panel de participantes ---

export type ParticipantListItem = {
  id: string;
  idNumber: string;
  birthDate: string;
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  wantsTransport: boolean;
  needsLodging: boolean;
  wantsBreakfast: boolean;
  wantsLunch: boolean;
  ordinances: string[];
  approved: boolean;
  priceTransport: string;
  priceBreakfast: string;
  priceLunch: string;
  totalCost: string;
  registrationId: string;
  registrationDate: string;
  consent: boolean;
  policyVersion: string;
  ip: string | null;
};

// La IP solo va a SuperAdmin (includeIp); el resto la recibe en null.
export async function listTripParticipants(db: Database, tripId: string, { includeIp }: { includeIp: boolean }): Promise<ParticipantListItem[]> {
  const rows = await db
    .select({
      id: templeParticipants.id,
      idNumber: templeParticipants.idNumber,
      birthDate: templeParticipants.birthDate,
      fullName: templeParticipants.fullName,
      phone: templeParticipants.phone,
      email: templeParticipants.email,
      gender: templeParticipants.gender,
      wantsTransport: templeParticipants.wantsTransport,
      needsLodging: templeParticipants.needsLodging,
      wantsBreakfast: templeParticipants.wantsBreakfast,
      wantsLunch: templeParticipants.wantsLunch,
      ordinances: templeParticipants.ordinances,
      approved: templeParticipants.approved,
      priceTransport: templeParticipants.priceTransport,
      priceBreakfast: templeParticipants.priceBreakfast,
      priceLunch: templeParticipants.priceLunch,
      totalCost: templeParticipants.totalCost,
      registrationId: templeRegistrations.id,
      registrationDate: templeRegistrations.createdAt,
      consent: templeRegistrations.consent,
      policyVersion: templeRegistrations.policyVersion,
      ip: templeRegistrations.ip,
    })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(eq(templeRegistrations.tripId, tripId))
    .orderBy(asc(templeParticipants.fullName));
  return rows.map((row) => ({ ...row, registrationDate: row.registrationDate.toISOString(), ip: includeIp ? row.ip : null }));
}

type ParticipantUsage = { wantsTransport: boolean; needsLodging: boolean; gender: string; ordinances: string[] };

// Recurso cuyo cupo se superaría al sumar `delta`, o null si hay cupo.
function quotaBlocker(trip: TripRow, used: Quotas, person: ParticipantUsage, delta: number): string | null {
  if (person.wantsTransport && trip.includesTransport && used.transport + delta > trip.quotaTransport) return 'transport';
  if (person.needsLodging && trip.includesLodging && used.lodging + delta > trip.quotaLodging) return 'lodging';
  if ((GENDERS as readonly string[]).includes(person.gender)) {
    for (const ordinance of person.ordinances) {
      if ((ORDINANCES as readonly string[]).includes(ordinance)) {
        const key = quotaKey(ordinance as Ordinance, person.gender as Gender);
        if (used[key] + delta > trip[key]) return key;
      }
    }
  }
  return null;
}

async function participantWithTrip(tx: Tx, participantId: string) {
  const [row] = await tx
    .select({
      id: templeParticipants.id,
      fullName: templeParticipants.fullName,
      gender: templeParticipants.gender,
      ordinances: templeParticipants.ordinances,
      wantsTransport: templeParticipants.wantsTransport,
      needsLodging: templeParticipants.needsLodging,
      wantsBreakfast: templeParticipants.wantsBreakfast,
      wantsLunch: templeParticipants.wantsLunch,
      approved: templeParticipants.approved,
      idNumber: templeParticipants.idNumber,
      birthDate: templeParticipants.birthDate,
      priceTransport: templeParticipants.priceTransport,
      priceBreakfast: templeParticipants.priceBreakfast,
      priceLunch: templeParticipants.priceLunch,
      tripId: templeRegistrations.tripId,
    })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(eq(templeParticipants.id, participantId))
    .limit(1);
  return row;
}

async function approvedUsage(tx: Tx, tripId: string, exceptId?: string): Promise<Quotas> {
  const rows = await tx
    .select({
      wantsTransport: templeParticipants.wantsTransport,
      needsLodging: templeParticipants.needsLodging,
      gender: templeParticipants.gender,
      ordinances: templeParticipants.ordinances,
    })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(and(eq(templeRegistrations.tripId, tripId), eq(templeParticipants.approved, true), ...(exceptId ? [ne(templeParticipants.id, exceptId)] : [])));
  return usedQuotas(rows);
}

export type ApprovalResult = { ok: true } | { ok: false; status: 404 } | { ok: false; status: 409; resource: string; name: string };

// Aprobar revalida el cupo en una transacción con SELECT ... FOR UPDATE del viaje, para que dos
// aprobaciones simultáneas no superen el cupo. Desaprobar no valida.
export async function setApproval(db: Database, participantId: string, approved: boolean): Promise<ApprovalResult> {
  if (!approved) {
    const updated = await db.update(templeParticipants).set({ approved: false }).where(eq(templeParticipants.id, participantId)).returning({ id: templeParticipants.id });
    return updated.length > 0 ? { ok: true } : { ok: false, status: 404 };
  }
  return db.transaction(async (tx) => {
    const person = await participantWithTrip(tx, participantId);
    if (!person) return { ok: false, status: 404 } as const;
    const [trip] = await tx.select().from(templeTrips).where(eq(templeTrips.id, person.tripId)).limit(1).for('update');
    if (!trip) return { ok: false, status: 404 } as const;
    const used = await approvedUsage(tx, person.tripId, participantId);
    const blocker = quotaBlocker(trip, used, person, 1);
    if (blocker) return { ok: false, status: 409, resource: blocker, name: person.fullName } as const;
    await tx.update(templeParticipants).set({ approved: true }).where(eq(templeParticipants.id, participantId));
    return { ok: true } as const;
  });
}

export type UpdateParticipantResult =
  | { ok: true }
  | { ok: false; status: 404 }
  | { ok: false; status: 400; code: 'empty_id' | 'age_ordinance' | 'duplicate_existing' }
  | { ok: false; status: 409; resource: string; name: string };

// Editar no cambia los precios congelados; el total se recalcula con ellos. Si ya está aprobado,
// revalida el cupo excluyéndolo a él.
export async function updateParticipant(db: Database, participantId: string, patch: ParticipantPatch): Promise<UpdateParticipantResult> {
  return db.transaction(async (tx) => {
    const current = await participantWithTrip(tx, participantId);
    if (!current) return { ok: false, status: 404 } as const;
    const [trip] = await tx.select().from(templeTrips).where(eq(templeTrips.id, current.tripId)).limit(1).for('update');
    if (!trip) return { ok: false, status: 404 } as const;

    const gender = patch.gender ?? current.gender;
    const birthDate = patch.birthDate ?? current.birthDate;
    const ordinances = patch.ordinances ? [...new Set(patch.ordinances)] : (current.ordinances as Ordinance[]);
    const wantsTransport = trip.includesTransport && (patch.wantsTransport ?? current.wantsTransport);
    const needsLodging = trip.includesLodging && (patch.needsLodging ?? current.needsLodging);
    const wantsBreakfast = trip.includesBreakfast && (patch.wantsBreakfast ?? current.wantsBreakfast);
    const wantsLunch = trip.includesLunch && (patch.wantsLunch ?? current.wantsLunch);

    let idNumber = current.idNumber;
    if (patch.idNumber !== undefined) {
      idNumber = normalizeIdNumber(patch.idNumber);
      if (!idNumber) return { ok: false, status: 400, code: 'empty_id' } as const;
      const clash = await tx
        .select({ id: templeParticipants.id })
        .from(templeParticipants)
        .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
        .where(and(eq(templeRegistrations.tripId, current.tripId), eq(templeParticipants.idNumber, idNumber), ne(templeParticipants.id, participantId)));
      if (clash.length > 0) return { ok: false, status: 400, code: 'duplicate_existing' } as const;
    }

    if (ordinances.length > 0 && calculateAge(birthDate, trip.date) < MIN_AGE_ORDINANCES) {
      return { ok: false, status: 400, code: 'age_ordinance' } as const;
    }

    if (current.approved) {
      const used = await approvedUsage(tx, current.tripId, participantId);
      const blocker = quotaBlocker(trip, used, { wantsTransport, needsLodging, gender, ordinances }, 1);
      if (blocker) return { ok: false, status: 409, resource: blocker, name: patch.fullName ?? current.fullName } as const;
    }

    const totalCost = totalFromFrozen(
      { priceTransport: Number(current.priceTransport), priceBreakfast: Number(current.priceBreakfast), priceLunch: Number(current.priceLunch) },
      { wantsTransport, wantsBreakfast, wantsLunch },
    );

    await tx
      .update(templeParticipants)
      .set({
        idNumber,
        birthDate,
        gender,
        ordinances,
        wantsTransport,
        needsLodging,
        wantsBreakfast,
        wantsLunch,
        totalCost: totalCost.toFixed(2),
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      })
      .where(eq(templeParticipants.id, participantId));
    return { ok: true } as const;
  });
}
