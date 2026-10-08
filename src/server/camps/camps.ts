import 'server-only';
import { desc, eq, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { nextFreeSlug, slugify } from '@/lib/camps/constants';
import type { CampInput, CampItem } from '@/lib/validation/camps';
import type { Database } from '@/server/db';
import { campParticipants, campRegistrations, camps, users } from '@/server/db/schema';
import { approvedYouthByGender } from './participants';

const authorizer = alias(users, 'fee_authorizer');

// Conteos agregados por campamento: solo números, nada de participantes (eso llega en el PR 3).
const counts = {
  youthCount: sql<number>`count(${campParticipants.id}) filter (where ${campParticipants.type} = 'youth')::int`,
  leaderCount: sql<number>`count(${campParticipants.id}) filter (where ${campParticipants.type} = 'leader')::int`,
  approvedCount: sql<number>`count(${campParticipants.id}) filter (where ${campParticipants.approved})::int`,
  pendingCount: sql<number>`count(${campParticipants.id}) filter (where not ${campParticipants.approved})::int`,
};

function listQuery(db: Database) {
  return db
    .select({
      camp: camps,
      feeAuthorizedByName: sql<string | null>`case when ${authorizer.id} is null then null else ${authorizer.firstName} || ' ' || ${authorizer.lastName} end`,
      ...counts,
    })
    .from(camps)
    .leftJoin(authorizer, eq(camps.feeAuthorizedBy, authorizer.id))
    .leftJoin(campRegistrations, eq(campRegistrations.campId, camps.id))
    .leftJoin(campParticipants, eq(campParticipants.registrationId, campRegistrations.id))
    .groupBy(camps.id, authorizer.id);
}

type ListRow = Awaited<ReturnType<ReturnType<typeof listQuery>['execute']>>[number];

// Columnas explícitas: el id de quien autorizó no sale, solo su nombre para el panel.
function toItem({ camp, feeAuthorizedByName, ...counts }: ListRow): CampItem {
  return {
    id: camp.id,
    slug: camp.slug,
    name: camp.name,
    description: camp.description,
    startDate: camp.startDate,
    endDate: camp.endDate,
    location: camp.location,
    registrationDeadline: camp.registrationDeadline,
    feeYouth: camp.feeYouth,
    feeLeader: camp.feeLeader,
    feeAuthorized: camp.feeAuthorized,
    feeAuthorizedAt: camp.feeAuthorizedAt ? camp.feeAuthorizedAt.toISOString() : null,
    feeAuthorizedByName,
    donationCategoryName: camp.donationCategoryName,
    donationInstructions: camp.donationInstructions,
    quotaYouthMale: camp.quotaYouthMale,
    quotaYouthFemale: camp.quotaYouthFemale,
    open: camp.open,
    ...counts,
    createdAt: camp.createdAt.toISOString(),
    updatedAt: camp.updatedAt.toISOString(),
  };
}

export async function listCamps(db: Database): Promise<CampItem[]> {
  const rows = await listQuery(db).orderBy(desc(camps.startDate), desc(camps.createdAt));
  return rows.map(toItem);
}

async function getCamp(db: Database, id: string): Promise<CampItem> {
  const [row] = await listQuery(db).where(eq(camps.id, id));
  return toItem(row!);
}

// Quién y cuándo autorizó el aporte (Manual General 20.6.2). Se registra al marcar la casilla y
// también cada vez que cambia un monto con la casilla marcada: quien guarda el monto nuevo es quien
// confirma que el obispado lo autorizó. Desmarcarla borra el registro.
type PreviousFee = { feeAuthorized: boolean; feeYouth: string; feeLeader: string };

function authorization(input: CampInput, previous: PreviousFee | null, userId: string, now: Date) {
  if (!input.feeAuthorized) return { feeAuthorized: false, feeAuthorizedBy: null, feeAuthorizedAt: null };
  const sameAmounts = previous?.feeAuthorized && Number(previous.feeYouth) === Number(input.feeYouth) && Number(previous.feeLeader) === Number(input.feeLeader);
  if (sameAmounts) return { feeAuthorized: true };
  return { feeAuthorized: true, feeAuthorizedBy: userId, feeAuthorizedAt: now };
}

// Serializa las altas para que dos campamentos con el mismo nombre no compitan por el slug.
const SLUG_LOCK = sql`select pg_advisory_xact_lock(hashtext('camps-slug'))`;

export async function createCamp(db: Database, input: CampInput, userId: string, now = new Date()): Promise<CampItem> {
  const id = await db.transaction(async (tx) => {
    await tx.execute(SLUG_LOCK);
    const base = slugify(input.name);
    const taken = await tx.select({ slug: camps.slug }).from(camps).where(like(camps.slug, `${base}%`));
    const slug = nextFreeSlug(base, new Set(taken.map((row) => row.slug)));
    const [camp] = await tx
      .insert(camps)
      .values({ ...input, ...authorization(input, null, userId, now), slug })
      .returning({ id: camps.id });
    return camp!.id;
  });
  return getCamp(db, id);
}

export type UpdateCampResult = { ok: true; camp: CampItem } | { ok: false; status: 404 } | { ok: false; status: 409; field: 'quotaYouthMale' | 'quotaYouthFemale' };

// El slug no cambia al renombrar: el enlace público ya pudo compartirse. Con el campamento
// bloqueado, no se puede bajar un cupo por debajo de los jóvenes de ese género ya aprobados.
export async function updateCamp(db: Database, id: string, input: CampInput, userId: string, now = new Date()): Promise<UpdateCampResult> {
  const result = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ feeAuthorized: camps.feeAuthorized, feeYouth: camps.feeYouth, feeLeader: camps.feeLeader })
      .from(camps)
      .where(eq(camps.id, id))
      .for('update');
    if (!previous) return { ok: false, status: 404 } as const;
    for (const [gender, field, quota] of [
      ['male', 'quotaYouthMale', input.quotaYouthMale],
      ['female', 'quotaYouthFemale', input.quotaYouthFemale],
    ] as const) {
      if (quota > 0 && (await approvedYouthByGender(tx, id, gender)) > quota) return { ok: false, status: 409, field } as const;
    }
    await tx
      .update(camps)
      .set({ ...input, ...authorization(input, previous, userId, now) })
      .where(eq(camps.id, id));
    return { ok: true } as const;
  });
  return result.ok ? { ok: true, camp: await getCamp(db, id) } : result;
}
