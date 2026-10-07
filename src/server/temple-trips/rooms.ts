import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { ROOM_CAPACITY, ROOM_MAX_LEADERS, compareNatural, type RoomRole } from '@/lib/temple-trips/constants';
import type { Database } from '@/server/db';
import { templeParticipants, templeRegistrations, templeRooms, templeTrips } from '@/server/db/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type RoomOccupant = {
  id: string;
  fullName: string;
  email: string;
  gender: string;
  birthDate: string;
  roomRole: RoomRole | null;
  lastNames: string | null;
  firstNames: string | null;
  nationality: string | null;
};

export type RoomView = { id: string; number: string; leaders: number; occupants: RoomOccupant[] };

export type RoomsView = { includesLodging: boolean; rooms: RoomView[]; unassigned: RoomOccupant[] };

type OccupantRow = RoomOccupant & { roomId: string | null };

function occupantsOfTrip(db: Database | Tx, tripId: string): Promise<OccupantRow[]> {
  return db
    .select({
      id: templeParticipants.id,
      fullName: templeParticipants.fullName,
      email: templeParticipants.email,
      gender: templeParticipants.gender,
      birthDate: templeParticipants.birthDate,
      roomId: templeParticipants.roomId,
      roomRole: templeParticipants.roomRole,
      lastNames: templeParticipants.lastNames,
      firstNames: templeParticipants.firstNames,
      nationality: templeParticipants.nationality,
    })
    .from(templeParticipants)
    .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
    .where(and(eq(templeRegistrations.tripId, tripId), eq(templeParticipants.approved, true), eq(templeParticipants.needsLodging, true)))
    .then((rows) => rows.map((row) => ({ ...row, roomRole: row.roomRole as RoomRole | null })));
}

// Ocupantes de una habitación: líderes primero, luego huéspedes, cada grupo por apellidos/nombre.
function sortOccupants(a: RoomOccupant, b: RoomOccupant): number {
  if (a.roomRole !== b.roomRole) return a.roomRole === 'leader' ? -1 : 1;
  const an = (a.lastNames ?? a.fullName).toLocaleLowerCase();
  const bn = (b.lastNames ?? b.fullName).toLocaleLowerCase();
  return an.localeCompare(bn) || a.fullName.localeCompare(b.fullName);
}

export async function listRooms(db: Database, tripId: string): Promise<RoomsView | null> {
  const [trip] = await db.select({ includesLodging: templeTrips.includesLodging }).from(templeTrips).where(eq(templeTrips.id, tripId)).limit(1);
  if (!trip) return null;
  const [rooms, occupants] = await Promise.all([
    db.select({ id: templeRooms.id, number: templeRooms.number }).from(templeRooms).where(eq(templeRooms.tripId, tripId)),
    occupantsOfTrip(db, tripId),
  ]);
  const byRoom = new Map<string, RoomOccupant[]>();
  const unassigned: RoomOccupant[] = [];
  for (const { roomId, ...occupant } of occupants) {
    if (roomId) (byRoom.get(roomId) ?? byRoom.set(roomId, []).get(roomId)!).push(occupant);
    else unassigned.push(occupant);
  }
  const roomViews = rooms
    .sort((a, b) => compareNatural(a.number, b.number))
    .map((room) => {
      const list = (byRoom.get(room.id) ?? []).sort(sortOccupants);
      return { id: room.id, number: room.number, leaders: list.filter((o) => o.roomRole === 'leader').length, occupants: list };
    });
  unassigned.sort((a, b) => (a.lastNames ?? a.fullName).localeCompare(b.lastNames ?? b.fullName) || a.fullName.localeCompare(b.fullName));
  return { includesLodging: trip.includesLodging, rooms: roomViews, unassigned };
}

export type CreateRoomResult = { ok: true; id: string } | { ok: false; status: 404 } | { ok: false; status: 400; code: 'no_lodging' };

export async function createRoom(db: Database, tripId: string, number: string): Promise<CreateRoomResult> {
  const [trip] = await db.select({ includesLodging: templeTrips.includesLodging }).from(templeTrips).where(eq(templeTrips.id, tripId)).limit(1);
  if (!trip) return { ok: false, status: 404 };
  if (!trip.includesLodging) return { ok: false, status: 400, code: 'no_lodging' };
  const [room] = await db.insert(templeRooms).values({ tripId, number }).returning({ id: templeRooms.id });
  return { ok: true, id: room!.id };
}

// Borrar una habitacion limpia la habitacion Y EL ROL de sus ocupantes (la FK solo anula room_id).
export async function deleteRoom(db: Database, roomId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [room] = await tx.select({ id: templeRooms.id }).from(templeRooms).where(eq(templeRooms.id, roomId)).limit(1);
    if (!room) return false;
    await tx.update(templeParticipants).set({ roomId: null, roomRole: null }).where(eq(templeParticipants.roomId, roomId));
    await tx.delete(templeRooms).where(eq(templeRooms.id, roomId));
    return true;
  });
}

export type AssignRoomResult =
  | { ok: true }
  | { ok: false; status: 404 }
  | { ok: false; status: 400; code: 'not_approved' | 'room_other_trip' | 'room_full' | 'too_many_leaders' };

function lockTrip(tx: Tx, tripId: string) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`temple-rooms:${tripId}`}))`);
}

// Asigna (o desasigna con roomId=null) un participante a una habitacion. Serializa por viaje para
// que dos asignaciones simultaneas no superen la capacidad ni el maximo de lideres.
export async function assignRoom(db: Database, participantId: string, roomId: string | null, role?: RoomRole): Promise<AssignRoomResult> {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select({
        id: templeParticipants.id,
        approved: templeParticipants.approved,
        needsLodging: templeParticipants.needsLodging,
        roomId: templeParticipants.roomId,
        roomRole: templeParticipants.roomRole,
        tripId: templeRegistrations.tripId,
      })
      .from(templeParticipants)
      .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
      .where(eq(templeParticipants.id, participantId))
      .limit(1);
    if (!person) return { ok: false, status: 404 } as const;
    await lockTrip(tx, person.tripId);

    if (roomId === null) {
      await tx.update(templeParticipants).set({ roomId: null, roomRole: null }).where(eq(templeParticipants.id, participantId));
      return { ok: true } as const;
    }

    if (!person.approved || !person.needsLodging) return { ok: false, status: 400, code: 'not_approved' } as const;
    const [room] = await tx.select({ tripId: templeRooms.tripId }).from(templeRooms).where(eq(templeRooms.id, roomId)).limit(1);
    if (!room) return { ok: false, status: 404 } as const;
    if (room.tripId !== person.tripId) return { ok: false, status: 400, code: 'room_other_trip' } as const;

    // Cuenta solo ocupantes aprobados con hospedaje: los mismos que ve la interfaz y el Excel,
    // para que el cupo no lo consuman participantes que luego se desaprobaron.
    const occupants = await tx
      .select({ id: templeParticipants.id, roomRole: templeParticipants.roomRole })
      .from(templeParticipants)
      .innerJoin(templeRegistrations, eq(templeParticipants.registrationId, templeRegistrations.id))
      .where(and(eq(templeParticipants.roomId, roomId), eq(templeParticipants.approved, true), eq(templeParticipants.needsLodging, true)));
    const others = occupants.filter((o) => o.id !== participantId);
    if (others.length + 1 > ROOM_CAPACITY) return { ok: false, status: 400, code: 'room_full' } as const;

    const finalRole: RoomRole = role ?? (person.roomRole as RoomRole | null) ?? 'guest';
    if (finalRole === 'leader') {
      const otherLeaders = others.filter((o) => o.roomRole === 'leader').length;
      if (otherLeaders + 1 > ROOM_MAX_LEADERS) return { ok: false, status: 400, code: 'too_many_leaders' } as const;
    }

    await tx.update(templeParticipants).set({ roomId, roomRole: finalRole }).where(eq(templeParticipants.id, participantId));
    return { ok: true } as const;
  });
}

export async function updateHousingData(
  db: Database,
  participantId: string,
  patch: { lastNames?: string; firstNames?: string; nationality?: string },
): Promise<boolean> {
  const set: Partial<{ lastNames: string; firstNames: string; nationality: string }> = {};
  if (patch.lastNames !== undefined) set.lastNames = patch.lastNames;
  if (patch.firstNames !== undefined) set.firstNames = patch.firstNames;
  if (patch.nationality !== undefined) set.nationality = patch.nationality;
  if (Object.keys(set).length === 0) {
    const [row] = await db.select({ id: templeParticipants.id }).from(templeParticipants).where(eq(templeParticipants.id, participantId)).limit(1);
    return Boolean(row);
  }
  const updated = await db.update(templeParticipants).set(set).where(eq(templeParticipants.id, participantId)).returning({ id: templeParticipants.id });
  return updated.length > 0;
}

export { occupantsOfTrip, sortOccupants };
