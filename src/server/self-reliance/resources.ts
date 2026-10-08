import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { isOfficialUrl, type ResourceCategory, type ResourceLocale } from '@/lib/self-reliance/constants';
import type { ResourceInput, ResourceItem, ResourceUpdateInput } from '@/lib/validation/self-reliance';
import type { Database } from '@/server/db';
import { selfRelianceResources } from '@/server/db/schema';

type ResourceRow = typeof selfRelianceResources.$inferSelect;

// Sin `createdBy`: quién creó el recurso queda en la base para control administrativo, pero
// la lista no lo necesita y no se envía al navegador (datos mínimos, Manual General 33.8).
function toItem(row: ResourceRow): ResourceItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    category: row.category as ResourceCategory,
    locale: row.locale as ResourceLocale,
    position: row.position,
    published: row.published,
    official: isOfficialUrl(row.url),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Serializa lo que toca `position` (crear al final y reordenar): sin esto, dos altas a la vez
// leen el mismo máximo y terminan con la misma posición.
const ORDER_LOCK = sql`select pg_advisory_xact_lock(hashtext('self-reliance-order'))`;

export async function listResources(db: Database): Promise<ResourceItem[]> {
  const rows = await db.select().from(selfRelianceResources).orderBy(asc(selfRelianceResources.position), asc(selfRelianceResources.createdAt));
  return rows.map(toItem);
}

export async function createResource(db: Database, input: ResourceInput, createdBy: string): Promise<ResourceItem> {
  return db.transaction(async (tx) => {
    await tx.execute(ORDER_LOCK);
    const [last] = await tx.select({ max: sql<number>`coalesce(max(${selfRelianceResources.position}), 0)` }).from(selfRelianceResources);
    const [row] = await tx
      .insert(selfRelianceResources)
      .values({ ...input, position: Number(last?.max ?? 0) + 1, createdBy })
      .returning();
    return toItem(row!);
  });
}

export async function updateResource(db: Database, id: string, input: ResourceUpdateInput): Promise<ResourceItem | null> {
  const [row] = await db.update(selfRelianceResources).set(input).where(eq(selfRelianceResources.id, id)).returning();
  return row ? toItem(row) : null;
}

export async function deleteResource(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(selfRelianceResources).where(eq(selfRelianceResources.id, id)).returning({ id: selfRelianceResources.id });
  return deleted.length > 0;
}

export type ReorderResult = { ok: true; resources: ResourceItem[] } | { ok: false; reason: 'stale' };

// Recibe TODOS los recursos en el orden nuevo. Si la lista no coincide con lo que hay en la
// base (alguien creó o eliminó uno mientras tanto), no se reordena nada: la pantalla recarga.
export async function reorderResources(db: Database, ids: string[]): Promise<ReorderResult> {
  return db.transaction(async (tx) => {
    await tx.execute(ORDER_LOCK);
    const current = await tx.select({ id: selfRelianceResources.id }).from(selfRelianceResources).for('update');
    const known = new Set(current.map((row) => row.id));
    if (known.size !== ids.length || ids.some((id) => !known.has(id))) return { ok: false, reason: 'stale' } as const;
    for (const [index, id] of ids.entries()) {
      await tx.update(selfRelianceResources).set({ position: index + 1 }).where(eq(selfRelianceResources.id, id));
    }
    const rows = await tx.select().from(selfRelianceResources).orderBy(asc(selfRelianceResources.position));
    return { ok: true, resources: rows.map(toItem) } as const;
  });
}
