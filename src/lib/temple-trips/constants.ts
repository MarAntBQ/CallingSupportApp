export const ORDINANCES = ['baptism', 'initiatory', 'endowment', 'sealing'] as const;
export type Ordinance = (typeof ORDINANCES)[number];

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const MIN_AGE_ORDINANCES = 11;
export const ROOM_CAPACITY = 6;
export const ROOM_MAX_LEADERS = 2;
export const TEMPLE_NAME_MAX = 120;

function cap<S extends string>(value: S): Capitalize<S> {
  return (value.charAt(0).toUpperCase() + value.slice(1)) as Capitalize<S>;
}

export type QuotaKey = `quota${Capitalize<Ordinance>}${Capitalize<Gender>}`;

export function quotaKey(ordinance: Ordinance, gender: Gender): QuotaKey {
  return `quota${cap(ordinance)}${cap(gender)}`;
}

export const QUOTA_KEYS: QuotaKey[] = ORDINANCES.flatMap((ordinance) =>
  GENDERS.map((gender) => quotaKey(ordinance, gender)),
);

export function normalizeIdNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export const ROOM_ROLES = ['leader', 'guest'] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

// Orden natural de números de habitación: "2" antes que "10".
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Prellenado del modal del Excel cuando no hay apellidos/nombres guardados: parte el nombre
// completo por la mitad (primera mitad = apellidos).
export function splitFullName(fullName: string): { lastNames: string; firstNames: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const half = Math.ceil(parts.length / 2);
  return { lastNames: parts.slice(0, half).join(' '), firstNames: parts.slice(half).join(' ') };
}

// Edad en años a una fecha dada; ambas fechas en formato 'YYYY-MM-DD'. En UTC para no
// depender de la zona horaria del navegador o del servidor.
export function calculateAge(birthDate: string, atDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const at = new Date(`${atDate}T00:00:00Z`);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const months = at.getUTCMonth() - birth.getUTCMonth();
  if (months < 0 || (months === 0 && at.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

type TripCosts = {
  includesTransport: boolean;
  costTransport: string | number;
  includesBreakfast: boolean;
  costBreakfast: string | number;
  includesLunch: boolean;
  costLunch: string | number;
};

type ParticipantWants = { wantsTransport: boolean; wantsBreakfast: boolean; wantsLunch: boolean };

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Fuente única del costo de un participante (cliente para el estimado en vivo, servidor para
// congelar los precios). `priceX` es el precio UNITARIO congelado del servicio que ofrece el
// viaje (0 si no lo ofrece), independiente de si la persona lo pidió; así, al editar los
// servicios desde el panel, el total se recalcula con esos precios congelados y no con los
// actuales del viaje. El hospedaje no cuesta. `totalCost` suma solo lo que la persona pide.
export function participantPrices(trip: TripCosts, wants: ParticipantWants) {
  const unit = (offered: boolean, cost: string | number) => (offered ? round2(Number(cost) || 0) : 0);
  const priceTransport = unit(trip.includesTransport, trip.costTransport);
  const priceBreakfast = unit(trip.includesBreakfast, trip.costBreakfast);
  const priceLunch = unit(trip.includesLunch, trip.costLunch);
  return {
    priceTransport,
    priceBreakfast,
    priceLunch,
    totalCost: totalFromFrozen({ priceTransport, priceBreakfast, priceLunch }, wants),
  };
}

// Total a partir de los precios unitarios congelados y lo que la persona pide. Lo usa tanto la
// inscripción (con los precios recién congelados) como la edición desde el panel (#21).
export function totalFromFrozen(
  prices: { priceTransport: number; priceBreakfast: number; priceLunch: number },
  wants: ParticipantWants,
): number {
  return round2(
    (wants.wantsTransport ? prices.priceTransport : 0) +
      (wants.wantsBreakfast ? prices.priceBreakfast : 0) +
      (wants.wantsLunch ? prices.priceLunch : 0),
  );
}
