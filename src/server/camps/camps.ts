import 'server-only';
import { desc, eq, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { nextFreeSlug, slugify } from '@/lib/camps/constants';
import type { CampInput, CampItem } from '@/lib/validation/camps';
import type { Database } from '@/server/db';
import { campParticipants, campRegistrations, camps, users } from '@/server/db/schema';

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

// Quién y cuándo autorizó el aporte (Manual General 20.6.2): se fija la primera vez que se marca
// y se borra si se desmarca. Cambiar los montos con la casilla ya marcada no cambia el registro.
function authorization(input: CampInput, previous: { feeAuthorized: boolean } | null, userId: string, now: Date) {
  if (!input.feeAuthorized) return { feeAuthorized: false, feeAuthorizedBy: null, feeAuthorizedAt: null };
  if (previous?.feeAuthorized) return { feeAuthorized: true };
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

// El slug no cambia al renombrar: el enlace público ya pudo compartirse.
export async function updateCamp(db: Database, id: string, input: CampInput, userId: string, now = new Date()): Promise<CampItem | null> {
  const updated = await db.transaction(async (tx) => {
    const [previous] = await tx.select({ feeAuthorized: camps.feeAuthorized }).from(camps).where(eq(camps.id, id)).for('update');
    if (!previous) return false;
    await tx
      .update(camps)
      .set({ ...input, ...authorization(input, previous, userId, now) })
      .where(eq(camps.id, id));
    return true;
  });
  return updated ? getCamp(db, id) : null;
}
