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
