import 'server-only';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { compareNatural, splitFullName } from '@/lib/temple-trips/constants';
import type { Database } from '@/server/db';
import { templeRooms } from '@/server/db/schema';
import { occupantsOfTrip, sortOccupants, type RoomOccupant } from './rooms';

const HEADER_FILL = 'FFF2CEE2';
const HEADER_FONT = 'FF880E4F';
const COLUMN_WIDTHS = [24, 28, 22, 20, 8, 14, 22];
const HEADERS = ['Correo electrónico', 'Apellidos', 'Nombres', 'Sexo', 'Nacionalidad', 'F. Nacimiento día/mes/año'];

function formatBirthDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
}

function occupantCells(occupant: RoomOccupant, defaultNationality: string): [string, string, string, string, string] {
  const split = splitFullName(occupant.fullName);
  const lastNames = occupant.lastNames ?? split.lastNames;
  const firstNames = occupant.firstNames ?? split.firstNames;
  const nationality = occupant.nationality ?? defaultNationality;
  const sex = occupant.gender === 'female' ? 'F' : 'M';
  return [occupant.email, lastNames, firstNames, sex, nationality];
}

export async function buildRoomsExcel(db: Database, tripId: string, defaultNationality: string): Promise<Buffer | null> {
  const rooms = await db.select({ id: templeRooms.id, number: templeRooms.number }).from(templeRooms).where(eq(templeRooms.tripId, tripId));
  if (rooms.length === 0) return null;
  const occupants = await occupantsOfTrip(db, tripId);
  const byRoom = new Map<string, RoomOccupant[]>();
  for (const { roomId, ...occupant } of occupants) {
    if (roomId) (byRoom.get(roomId) ?? byRoom.set(roomId, []).get(roomId)!).push(occupant);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Habitaciones');
  COLUMN_WIDTHS.forEach((width, index) => (sheet.getColumn(index + 1).width = width));

  for (const room of rooms.sort((a, b) => compareNatural(a.number, b.number))) {
    const headerRow = sheet.addRow([`Habitación # ${room.number}`, ...HEADERS]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: HEADER_FONT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
    const list = (byRoom.get(room.id) ?? []).sort(sortOccupants);
    const leaders = list.filter((o) => o.roomRole === 'leader');
    const guests = list.filter((o) => o.roomRole !== 'leader');
    leaders.forEach((occupant, index) => sheet.addRow([`${index + 1}. Líder a cargo`, ...occupantCells(occupant, defaultNationality), formatBirthDate(occupant.birthDate)]));
    guests.forEach((occupant, index) => sheet.addRow([`${index + 1}. Huésped`, ...occupantCells(occupant, defaultNationality), formatBirthDate(occupant.birthDate)]));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
