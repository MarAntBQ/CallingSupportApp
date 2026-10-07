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
// congelar los precios). El hospedaje no cuesta. Solo se cobra lo que el viaje incluye y la
// persona pide.
export function participantPrices(trip: TripCosts, wants: ParticipantWants) {
  const money = (on: boolean, cost: string | number) => (on ? round2(Number(cost) || 0) : 0);
  const priceTransport = money(trip.includesTransport && wants.wantsTransport, trip.costTransport);
  const priceBreakfast = money(trip.includesBreakfast && wants.wantsBreakfast, trip.costBreakfast);
  const priceLunch = money(trip.includesLunch && wants.wantsLunch, trip.costLunch);
  return { priceTransport, priceBreakfast, priceLunch, totalCost: round2(priceTransport + priceBreakfast + priceLunch) };
}
