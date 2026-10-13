import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { PackingItemInput } from '@/lib/validation/camps';
import type { Database } from '@/server/db';
import { campParticipants, campPackingChecks, campPackingItems, campRegistrations, camps } from '@/server/db/schema';
import { hashAccessToken, TOKEN_FORMAT } from './registrations';

export type PackingItem = {
  id: string;
  name: string;
  detail: string | null;
  category: string;
  appliesTo: string;
  position: number;
};

const itemColumns = {
  id: campPackingItems.id,
  name: campPackingItems.name,
  detail: campPackingItems.detail,
  category: campPackingItems.category,
  appliesTo: campPackingItems.appliesTo,
  position: campPackingItems.position,
};

// Admin: todos los ítems del campamento, en orden. null si el campamento no existe (404).
export async function listPackingItems(db: Database, campId: string): Promise<PackingItem[] | null> {
  const [camp] = await db.select({ id: camps.id }).from(camps).where(eq(camps.id, campId)).limit(1);
  if (!camp) return null;
  return db
    .select(itemColumns)
    .from(campPackingItems)
    .where(eq(campPackingItems.campId, campId))
    .orderBy(asc(campPackingItems.position), asc(campPackingItems.name));
}

// Admin: agrega un ítem. null si el campamento no existe (404).
export async function createPackingItem(
  db: Database,
  campId: string,
  input: PackingItemInput,
): Promise<PackingItem | null> {
  const [camp] = await db.select({ id: camps.id }).from(camps).where(eq(camps.id, campId)).limit(1);
  if (!camp) return null;
  const [row] = await db
    .insert(campPackingItems)
    .values({
      campId,
      name: input.name,
      detail: input.detail,
      category: input.category,
      appliesTo: input.appliesTo,
      position: input.position ?? 0,
    })
    .returning(itemColumns);
  return row!;
}

// Admin: borra un ítem del campamento (los checks se borran en cascada). false si no existe.
export async function deletePackingItem(db: Database, campId: string, itemId: string): Promise<boolean> {
  const deleted = await db
    .delete(campPackingItems)
    .where(and(eq(campPackingItems.id, itemId), eq(campPackingItems.campId, campId)))
    .returning({ id: campPackingItems.id });
  return deleted.length > 0;
}

export type TogglePackingResult = { ok: true } | { ok: false; status: 404 };

function isForeignKeyViolation(error: unknown) {
  const own = (error as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return own === '23503' || cause === '23503';
}

// Enlace personal: el participante marca/desmarca un ítem SUYO. El ítem debe ser de su campamento
// y aplicarle (all o su tipo); si no, 404 (no se filtra que el ítem exista en otro campamento).
export async function togglePackingByToken(
  db: Database,
  token: string,
  itemId: string,
  checked: boolean,
): Promise<TogglePackingResult> {
  if (!TOKEN_FORMAT.test(token)) return { ok: false, status: 404 };
  const [participant] = await db
    .select({ id: campParticipants.id, type: campParticipants.type, campId: campRegistrations.campId })
    .from(campParticipants)
    .innerJoin(campRegistrations, eq(campParticipants.registrationId, campRegistrations.id))
    .where(eq(campParticipants.accessTokenHash, hashAccessToken(token)))
    .limit(1);
  if (!participant) return { ok: false, status: 404 };

  const [item] = await db
    .select({ id: campPackingItems.id })
    .from(campPackingItems)
    .where(
      and(
        eq(campPackingItems.id, itemId),
        eq(campPackingItems.campId, participant.campId),
        inArray(campPackingItems.appliesTo, ['all', participant.type]),
      ),
    )
    .limit(1);
  if (!item) return { ok: false, status: 404 };

  if (checked) {
    try {
      await db.insert(campPackingChecks).values({ participantId: participant.id, itemId }).onConflictDoNothing();
    } catch (error) {
      // Carrera: borran el ítem entre la verificación de arriba y este insert. El FK falla
      // (23503), que onConflictDoNothing no cubre; se trata como no encontrado, no como 500.
      if (isForeignKeyViolation(error)) return { ok: false, status: 404 };
      throw error;
    }
  } else {
    await db
      .delete(campPackingChecks)
      .where(and(eq(campPackingChecks.participantId, participant.id), eq(campPackingChecks.itemId, itemId)));
  }
  return { ok: true };
}
