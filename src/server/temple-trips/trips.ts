import 'server-only';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { TempleTripListItem } from '@/lib/temple-trips/types';
import type { TempleTripInput } from '@/lib/validation/temple-trips';
import type { Database } from '@/server/db';
import { templeTrips } from '@/server/db/schema';

export type TempleTripRow = typeof templeTrips.$inferSelect;

export async function listTempleTrips(db: Database): Promise<TempleTripListItem[]> {
  const trips = await db.select().from(templeTrips).orderBy(desc(templeTrips.date), desc(templeTrips.createdAt));
  // Los conteos salen en 0 hasta #20 (inscripciones): la lista nace de la tabla de viajes,
  // así los viajes sin inscripciones también aparecen.
  return trips.map(({ createdAt, updatedAt, ...trip }) => ({
    ...trip,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    registeredCount: 0,
    approvedCount: 0,
    pendingCount: 0,
  }));
}

// Serializa las mutaciones que tocan el viaje activo: sin esto, dos creaciones activas
// concurrentes chocan contra el índice único parcial y una termina en 500 en vez de
// que una desactive a la otra limpiamente (misma lección que la matriz de permisos).
const ACTIVE_TRIP_LOCK = sql`select pg_advisory_xact_lock(hashtext('temple-trips-active'))`;

export async function createTempleTrip(db: Database, input: TempleTripInput): Promise<TempleTripRow> {
  return db.transaction(async (tx) => {
    await tx.execute(ACTIVE_TRIP_LOCK);
    if (input.active) {
      await tx.update(templeTrips).set({ active: false }).where(eq(templeTrips.active, true));
    }
    const [trip] = await tx.insert(templeTrips).values(input).returning();
    return trip!;
  });
}

export type UpdateTripResult = { ok: true; trip: TempleTripRow } | { ok: false; reason: 'not_found' };

export async function updateTempleTrip(db: Database, id: string, input: TempleTripInput): Promise<UpdateTripResult> {
  return db.transaction(async (tx) => {
    await tx.execute(ACTIVE_TRIP_LOCK);
    const [existing] = await tx.select({ id: templeTrips.id }).from(templeTrips).where(eq(templeTrips.id, id)).for('update');
    if (!existing) return { ok: false, reason: 'not_found' } as const;
    if (input.active) {
      await tx.update(templeTrips).set({ active: false }).where(and(eq(templeTrips.active, true), ne(templeTrips.id, id)));
    }
    const [trip] = await tx.update(templeTrips).set(input).where(eq(templeTrips.id, id)).returning();
    return { ok: true, trip: trip! } as const;
  });
}
