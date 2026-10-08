import 'server-only';
import { count, eq, sql } from 'drizzle-orm';
import type { Database } from '@/server/db';
import { roles, templeParticipants, templeRegistrations, templeTrips, users } from '@/server/db/schema';

export type Dashboard = {
  users: { total: number; active: number; pending: number; byRole: { role: string; count: number }[] };
  trips: { total: number; active: { id: string; date: string; dateConfirmed: boolean; registrationDeadline: string } | null };
  participantsPendingApproval: number;
  estimatedCost: number;
};

// Todo se calcula en el servidor con agregados; no se traen listas al navegador (#25).
export async function getDashboard(db: Database): Promise<Dashboard> {
  const [userTotals] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${users.status} = 'active')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${users.status} = 'pending')`.mapWith(Number),
    })
    .from(users);

  // leftJoin para que un rol sin usuarios salga con 0; ordenado por nivel del rol.
  const byRole = await db
    .select({ role: roles.key, count: count(users.id) })
    .from(roles)
    .leftJoin(users, eq(users.roleId, roles.id))
    .groupBy(roles.key, roles.level)
    .orderBy(roles.level);

  const [tripTotals] = await db.select({ total: count() }).from(templeTrips);
  const [active] = await db
    .select({ id: templeTrips.id, date: templeTrips.date, dateConfirmed: templeTrips.dateConfirmed, registrationDeadline: templeTrips.registrationDeadline })
    .from(templeTrips)
    .where(eq(templeTrips.active, true))
    .limit(1);

  let participantsPendingApproval = 0;
  let estimatedCost = 0;
  if (active) {
    const [stats] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${templeParticipants.approved} = false)`.mapWith(Number),
        cost: sql<string>`coalesce(sum(${templeParticipants.totalCost}) filter (where ${templeParticipants.approved} = true), 0)`.mapWith(String),
      })
      .from(templeParticipants)
      .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
      .where(eq(templeRegistrations.tripId, active.id));
    participantsPendingApproval = stats?.pending ?? 0;
    estimatedCost = Number(stats?.cost ?? 0);
  }

  return {
    users: {
      total: userTotals?.total ?? 0,
      active: userTotals?.active ?? 0,
      pending: userTotals?.pending ?? 0,
      byRole: byRole.map((row) => ({ role: row.role, count: row.count })),
    },
    trips: {
      total: tripTotals?.total ?? 0,
      active: active ? { id: active.id, date: active.date, dateConfirmed: active.dateConfirmed, registrationDeadline: active.registrationDeadline } : null,
    },
    participantsPendingApproval,
    estimatedCost,
  };
}
